/**
 * Reading and writing training sessions.
 *
 * The unit here is the whole session, not the set. A workout row on its own is a plan, and a set
 * without its workout has no date, so both writes go through one transaction and both reads come
 * back joined. The reason is the overload suggestion: `suggestLoad` decides from *all* of the last
 * session's working sets for a movement, so a partially written session would hand it four sets
 * where there were five and produce a confident "hold" out of an interrupted save.
 *
 * The other job is `lastPerformance`  --  the most recent session that contains a given movement,
 * which is a different question from "the most recent session". A Tuesday lifter's last bench press
 * was a week ago with three other sessions in between, and asking for the newest workout would find
 * a walk.
 */

import { and, asc, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";

import type { Exercise, Session } from "@/data/exercises";

import { getDb, schema } from "./db";
import type { Workout, WorkoutSet } from "./db/schema";
import { type LoadSuggestion, type SessionVolume, sessionVolume, suggestLoad } from "./training";
import type { WorkoutInput, WorkoutPatch, WorkoutQuery } from "./validators";

/** A session and its sets, in set order. What every read in this file returns. */
export type WorkoutRecord = Workout & { sets: WorkoutSet[] };

/**
 * Hangs the sets onto their workouts in one extra query rather than one per row.
 *
 * Sets are ordered by index inside each session, which is the order they were performed and the
 * order the logger redraws them in. Sessions with no sets come back with an empty array rather
 * than being dropped  --  an abandoned session is a fact worth keeping.
 */
async function attachSets(rows: Workout[]): Promise<WorkoutRecord[]> {
  if (rows.length === 0) return [];
  const db = await getDb();
  const sets = await db
    .select()
    .from(schema.workoutSets)
    .where(
      inArray(
        schema.workoutSets.workoutId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(schema.workoutSets.setIndex), asc(schema.workoutSets.id));

  const grouped = new Map<number, WorkoutSet[]>();
  for (const set of sets) {
    const list = grouped.get(set.workoutId);
    if (list) list.push(set);
    else grouped.set(set.workoutId, [set]);
  }
  return rows.map((row) => ({ ...row, sets: grouped.get(row.id) ?? [] }));
}

/* ------------------------------------------------------------------- reading */

/**
 * Sessions matching a query, newest first.
 *
 * `exerciseSlug` narrows to the sessions that contain a movement, which needs a first pass over
 * the sets table  --  SQLite has no trouble with the subquery, but the two-step version keeps the
 * "no history at all" case a single cheap query that returns early.
 */
export async function listWorkouts(query: WorkoutQuery): Promise<WorkoutRecord[]> {
  const db = await getDb();
  const filters = [];
  if (query.date !== undefined) filters.push(eq(schema.workouts.date, query.date));
  if (query.from !== undefined) filters.push(gte(schema.workouts.date, query.from));
  if (query.to !== undefined) filters.push(lte(schema.workouts.date, query.to));

  if (query.exerciseSlug !== undefined) {
    const ids = await db
      .selectDistinct({ id: schema.workoutSets.workoutId })
      .from(schema.workoutSets)
      .where(eq(schema.workoutSets.exerciseSlug, query.exerciseSlug));
    if (ids.length === 0) return [];
    filters.push(
      inArray(
        schema.workouts.id,
        ids.map((row) => row.id),
      ),
    );
  }

  const rows = await db
    .select()
    .from(schema.workouts)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.workouts.date), desc(schema.workouts.id))
    .limit(query.limit);
  return attachSets(rows);
}

/** One session by id, sets included. */
export async function getWorkout(id: number): Promise<WorkoutRecord | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.workouts).where(eq(schema.workouts.id, id));
  const [record] = await attachSets(rows);
  return record ?? null;
}

/** Every session on one date. Usually one; two when a track schedules mobility and a lift. */
export async function workoutsOn(date: string): Promise<WorkoutRecord[]> {
  return listWorkouts({ date, limit: 20 });
}

/* ------------------------------------------------------------------- writing */

/**
 * Logs a session and its sets together.
 *
 * One transaction, because the two halves are only meaningful as a pair  --  see the file header.
 * `.returning()` on both inserts means the response carries the ids the logger needs to edit a set
 * it has just written, without a second round trip.
 */
export async function createWorkout(input: WorkoutInput): Promise<WorkoutRecord> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.workouts)
      .values({
        date: input.date,
        track: input.track,
        sessionSlug: input.sessionSlug,
        sessionName: input.sessionName,
        startMinute: input.startMinute,
        durationMinutes: input.durationMinutes,
        fasted: input.fasted,
        sessionRpe: input.sessionRpe,
        weekInCycle: input.weekInCycle,
        isDeload: input.isDeload,
        notes: input.notes,
      })
      .returning();
    if (!row) throw new Error("The workout insert returned no row");

    const sets =
      input.sets.length === 0
        ? []
        : await tx
            .insert(schema.workoutSets)
            .values(input.sets.map((set) => ({ ...set, workoutId: row.id })))
            .returning();
    return { ...row, sets };
  });
}

/**
 * Applies a patch. `null` means no session carries that id.
 *
 * `sets`, when present, **replaces** the list rather than merging into it. A merge would need
 * stable ids for sets the logger is still editing, and it does not have them until they are saved  -- 
 * so a merge would silently duplicate a set every time the user corrected a rep count. Replacing is
 * the honest version of what the logger is actually sending: the session as it now stands.
 */
export async function updateWorkout(
  id: number,
  patch: WorkoutPatch,
): Promise<WorkoutRecord | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    // A copy minus `sets`, because that key is not a column. Written as copy-and-delete rather
    // than rest-destructuring, which this ESLint config reads as an unused variable.
    const fields: WorkoutPatch = { ...patch };
    delete fields.sets;

    let row: Workout | undefined;
    if (Object.keys(fields).length > 0) {
      [row] = await tx
        .update(schema.workouts)
        .set(fields)
        .where(eq(schema.workouts.id, id))
        .returning();
    } else {
      [row] = await tx.select().from(schema.workouts).where(eq(schema.workouts.id, id));
    }
    if (!row) return null;

    if (patch.sets !== undefined) {
      await tx.delete(schema.workoutSets).where(eq(schema.workoutSets.workoutId, id));
      if (patch.sets.length > 0) {
        await tx
          .insert(schema.workoutSets)
          .values(patch.sets.map((set) => ({ ...set, workoutId: id })));
      }
    }

    const sets = await tx
      .select()
      .from(schema.workoutSets)
      .where(eq(schema.workoutSets.workoutId, id))
      .orderBy(asc(schema.workoutSets.setIndex), asc(schema.workoutSets.id));
    return { ...row, sets };
  });
}

/** Removes a session and, by cascade, its sets. */
export async function deleteWorkout(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(schema.workouts)
    .where(eq(schema.workouts.id, id))
    .returning({ id: schema.workouts.id });
  return rows.length > 0;
}

/* --------------------------------------------------------------- suggestions */

/** The last time a movement was performed: when, and every set of it from that session. */
export type LastPerformance = {
  date: string;
  workoutId: number;
  sessionName: string;
  sets: WorkoutSet[];
};

/**
 * The most recent session containing one movement.
 *
 * Not "the most recent session"  --  a Tuesday-and-Friday lifter's last bench press is a week back
 * with three other sessions in between, and reading the newest workout would find a walk. So the
 * join is driven from the sets table and ordered by the workout's date.
 *
 * `before` excludes today, which is what the logger wants: while a session is open, the suggestion
 * has to be about the *previous* one, or the first saved set would immediately become the history
 * the suggestion is derived from.
 */
export async function lastPerformance(
  exerciseSlug: string,
  before?: string,
): Promise<LastPerformance | null> {
  const db = await getDb();
  const filters = [eq(schema.workoutSets.exerciseSlug, exerciseSlug)];
  if (before !== undefined) filters.push(lt(schema.workouts.date, before));

  const rows = await db
    .select({ workout: schema.workouts, set: schema.workoutSets })
    .from(schema.workoutSets)
    .innerJoin(schema.workouts, eq(schema.workoutSets.workoutId, schema.workouts.id))
    .where(and(...filters))
    .orderBy(
      desc(schema.workouts.date),
      desc(schema.workouts.id),
      asc(schema.workoutSets.setIndex),
    );

  const first = rows[0];
  if (!first) return null;
  return {
    date: first.workout.date,
    workoutId: first.workout.id,
    sessionName: first.workout.sessionName,
    sets: rows.filter((row) => row.workout.id === first.workout.id).map((row) => row.set),
  };
}

/** One movement's card in the Train view: what to lift, why, and what it was last time. */
export type ExercisePlan = {
  exercise: Exercise;
  suggestion: LoadSuggestion;
  last: LastPerformance | null;
};

/**
 * The plan for every movement in a session.
 *
 * A query per exercise, which is five or six for the heaviest session in either track  --  cheap
 * against a local SQLite file and much clearer than one join that would have to pick the right row
 * per movement in SQL. If a track ever grows a twenty-movement session this becomes worth batching.
 */
export async function planSession(
  session: Session,
  options: { isDeload?: boolean; before?: string } = {},
): Promise<ExercisePlan[]> {
  return Promise.all(
    session.exercises.map(async (exercise) => {
      const last = await lastPerformance(exercise.slug, options.before);
      return {
        exercise,
        last,
        suggestion: suggestLoad(exercise, last?.sets ?? [], { isDeload: options.isDeload }),
      };
    }),
  );
}

/** What a stored session came to, for the log list and the tonnage trend. */
export function volumeOf(record: WorkoutRecord): SessionVolume {
  return sessionVolume(record.sets);
}

