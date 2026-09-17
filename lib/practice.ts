/**
 * Reading and writing practice sessions.
 *
 * The unit is one finished practice: a meditation sit, a pranayama round, a Yoga Nidra or
 * NSDR session, an abhyanga checklist, a walk, a journal, or a mantra. Unlike workouts there
 * are no child rows (sets)  --  a practice is one row with its duration and optional round count.
 *
 * `emptyStomachConfirmed` is stored, not thrown away after the gate: the log can then show a
 * session started against the caution, and `lib/rules.ts` has something real to read.
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";

import { getDb, schema } from "./db";
import type { PracticeSession } from "./db/schema";
import type { PracticeInput, PracticeQuery } from "./validators";

export type { PracticeSession };

/* ------------------------------------------------------------------- reading */

export async function listPractice(query: PracticeQuery): Promise<PracticeSession[]> {
  const db = await getDb();
  const filters = [];
  if (query.date !== undefined) filters.push(eq(schema.practiceSessions.date, query.date));
  if (query.from !== undefined) filters.push(gte(schema.practiceSessions.date, query.from));
  if (query.to !== undefined) filters.push(lte(schema.practiceSessions.date, query.to));
  if (query.kind !== undefined) filters.push(eq(schema.practiceSessions.kind, query.kind));

  return db
    .select()
    .from(schema.practiceSessions)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.practiceSessions.date), desc(schema.practiceSessions.id))
    .limit(query.limit);
}

export async function practiceOn(date: string): Promise<PracticeSession[]> {
  return listPractice({ date, limit: 50 });
}

/* ------------------------------------------------------------------- writing */

export async function createPractice(input: PracticeInput): Promise<PracticeSession> {
  const db = await getDb();
  const [row] = await db
    .insert(schema.practiceSessions)
    .values({
      date: input.date,
      kind: input.kind,
      practiceSlug: input.practiceSlug,
      startMinute: input.startMinute,
      durationSeconds: input.durationSeconds,
      rounds: input.rounds,
      emptyStomachConfirmed: input.emptyStomachConfirmed,
      notes: input.notes,
    })
    .returning();
  if (!row) throw new Error("The practice insert returned no row");
  return row;
}

export async function deletePractice(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(schema.practiceSessions)
    .where(eq(schema.practiceSessions.id, id))
    .returning({ id: schema.practiceSessions.id });
  return rows.length > 0;
}

/* ------------------------------------------------------------------- summary */

/** Total practice time today, in seconds. */
export async function practiceTotalSeconds(date: string): Promise<number> {
  const sessions = await practiceOn(date);
  return sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
}
