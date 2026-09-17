/**
 * The blocks table: installing a routine, reading it back, and marking blocks done.
 *
 * Server-only  --  it touches the database. The engine in `lib/schedule.ts` stays pure and knows
 * nothing about rows; this module is the seam between the two, and the only place a `Block`
 * becomes a `ScheduleBlock`.
 *
 * `activeRoutineId` on the settings row decides which routine the day is built from. It is
 * written here rather than through `updateSettings`, because it is state the app manages  -- 
 * a client that could set it to any integer could point the day at another user's routine in
 * a future multi-user version, and there is no reason to open that door now.
 */

import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { cache } from "react";

import { findPreset, type PresetId, plantBlocks } from "@/data/routines";

import { getDb, schema } from "./db";
import type { Block, BlockCompletion, Routine } from "./db/schema";
import type { BlockAnchor, BlockCategory, BlockFuel, ScheduleBlock } from "./schedule";
import { getSettings, SETTINGS_ID } from "./settings";
import type {
  BlockAnchorInput,
  BlockCategoryInput,
  BlockFuelInput,
  BlockInput,
  BlockPatch,
  OnboardingInput,
} from "./validators";

/* --------------------------------------------------- schema against the engine */

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/**
 * Four enums, each declared three times, checked against each other here.
 *
 * None of the three declarations can import another's: Drizzle needs literal arrays inside the
 * column definition, `lib/schedule.ts` must stay free of any database import, and
 * `lib/validators` must stay free of both so it can run in the browser. This module already
 * depends on all three, so it is where the duplication is made safe  --  adding a category to the
 * schema and forgetting the union is a compile error naming the line, not a row that fails to
 * render six months later.
 *
 * Assignability is transitive, so tying the wire to the engine and the engine to the schema
 * pins all three together.
 */
export type EnumsAgree = [
  Assert<Exact<BlockCategory, Block["category"]>>,
  Assert<Exact<BlockAnchor, Block["anchor"]>>,
  Assert<Exact<BlockFuel, Block["fuel"]>>,
  Assert<Exact<BlockCategoryInput, BlockCategory>>,
  Assert<Exact<BlockAnchorInput, BlockAnchor>>,
  Assert<Exact<BlockFuelInput, BlockFuel>>,
  Assert<Exact<PresetId, OnboardingInput["preset"]>>,
];

/* ------------------------------------------------------------------ row → block */

/** One row as the engine wants it. `scienceIds` is copied, not shared with the row. */
export function scheduleBlockOf(row: Block): ScheduleBlock {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    category: row.category,
    anchor: row.anchor,
    offsetMinutes: row.offsetMinutes,
    durationMinutes: row.durationMinutes,
    fuel: row.fuel,
    weekdayMask: row.weekdayMask,
    notify: row.notify,
    notifyLeadMinutes: row.notifyLeadMinutes,
    sortOrder: row.sortOrder,
    icon: row.icon,
    scienceIds: [...row.scienceIds],
    href: row.href,
    enabled: row.enabled,
  };
}

/* ------------------------------------------------------------- reading a routine */

export type InstalledRoutine = {
  routine: Routine;
  /** In timeline order, which is `sortOrder`  --  not resolved time. */
  blocks: ScheduleBlock[];
};

/** `id` breaks the tie, so two blocks sharing a `sortOrder` still come back in a stable order. */
async function blockRowsOf(routineId: number): Promise<Block[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.blocks)
    .where(eq(schema.blocks.routineId, routineId))
    .orderBy(asc(schema.blocks.sortOrder), asc(schema.blocks.id));
}

/**
 * The routine the day is currently built from, or null if there isn't one yet.
 *
 * Null covers two cases the caller treats identically: a database that has never been
 * onboarded, and an `activeRoutineId` pointing at a routine that has since been deleted.
 * Neither is an error  --  both mean "install something", which is onboarding's job.
 */
export async function activeRoutine(): Promise<InstalledRoutine | null> {
  const settings = await getSettings();
  if (settings.activeRoutineId === null) return null;

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.routines)
    .where(eq(schema.routines.id, settings.activeRoutineId))
    .limit(1);
  const routine = rows[0];
  if (!routine) return null;

  return { routine, blocks: (await blockRowsOf(routine.id)).map(scheduleBlockOf) };
}

export async function activeBlocks(): Promise<ScheduleBlock[]> {
  return (await activeRoutine())?.blocks ?? [];
}

/**
 * `activeRoutine` deduplicated for the length of one render, mirroring `renderSettings`.
 *
 * Same caveat as there: not for route handlers, which write and then read back.
 */
export const renderActiveRoutine = cache(activeRoutine);

/** The blocks alone, sharing `renderActiveRoutine`'s single query. */
export async function renderActiveBlocks(): Promise<ScheduleBlock[]> {
  return (await renderActiveRoutine())?.blocks ?? [];
}

/* --------------------------------------------------------- installing a preset */

/**
 * Writes one of the four shipped timetables into the database and makes it the active one.
 *
 * The routine is keyed by the preset's own id as its slug, so installing the same preset
 * twice updates that one routine instead of accumulating copies. **It replaces the blocks
 * wholesale**, and because `blockCompletions.blockId` cascades, the completion history for
 * those blocks goes with them. That is right for onboarding, where there is none, and it is
 * why any later "restore this preset" button has to say so before it calls this.
 *
 * Everything happens in one transaction: a half-written routine that the settings row already
 * points at would render as a day with three blocks in it and no way to tell that from a day
 * the user had edited down to three blocks.
 *
 * **It also adopts the preset's wake offset and sleep target**, because a preset is not only a
 * timetable  --  it is a timetable authored against one particular night. Sandhya hangs its morning
 * off `wake` while its light block hangs off `sunrise`, and the two only sit where they were
 * designed to sit when wake is where Sandhya puts it, half an hour before sunrise. Install those
 * blocks against a wake of sunrise−90 and the sunrise-anchored ones slide an hour later, straight
 * into the wake-anchored ones: the routine that ships collides with itself on the day it arrives.
 * Passing `adoptSleep: false` keeps the stored night, which is what onboarding does  --  there the
 * user has just chosen a wake time, and a preset should not overrule an answer given seconds ago.
 */
export async function installPreset(
  id: PresetId,
  { adoptSleep = true }: { adoptSleep?: boolean } = {},
): Promise<InstalledRoutine> {
  const preset = findPreset(id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);

  // Before the transaction: this creates the row on a fresh database, and the update below
  // needs it to exist. Reading it while a write transaction is open is asking for a lock.
  await getSettings();

  const planted = plantBlocks(preset.blocks);
  const db = await getDb();

  const routine = await db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const found = await tx
      .select()
      .from(schema.routines)
      .where(eq(schema.routines.slug, preset.id))
      .limit(1);

    let row: Routine;
    if (found[0]) {
      const updated = await tx
        .update(schema.routines)
        // `tagline` rather than `description`: this is a subtitle in a list, and the long
        // rationale stays in `data/routines.ts` next to the science ids it cites.
        .set({ name: preset.name, description: preset.tagline, isPreset: true, updatedAt: now })
        .where(eq(schema.routines.id, found[0].id))
        .returning();
      if (!updated[0]) throw new Error(`Routine ${preset.id} vanished mid-install`);
      row = updated[0];
      await tx.delete(schema.blocks).where(eq(schema.blocks.routineId, row.id));
    } else {
      const inserted = await tx
        .insert(schema.routines)
        .values({
          slug: preset.id,
          name: preset.name,
          description: preset.tagline,
          isPreset: true,
        })
        .returning();
      if (!inserted[0]) throw new Error(`Could not create routine ${preset.id}`);
      row = inserted[0];
    }

    await tx.insert(schema.blocks).values(planted.map((block) => ({ ...block, routineId: row.id })));

    await tx
      .update(schema.settings)
      .set({
        activeRoutineId: row.id,
        ...(adoptSleep
          ? {
              wakeOffsetMinutes: preset.wakeOffsetMinutes,
              sleepTargetMinutes: preset.sleepTargetMinutes,
            }
          : {}),
        updatedAt: now,
      })
      .where(eq(schema.settings.id, SETTINGS_ID));

    return row;
  });

  return { routine, blocks: (await blockRowsOf(routine.id)).map(scheduleBlockOf) };
}

/**
 * The active routine, installing `fallback` first if there is none.
 *
 * Every read path  --  Today, the Timeline, `/api/schedule/resolve`  --  wants blocks rather than a
 * decision about what to do when there are none, and a database can reach that state without
 * onboarding ever failing: the settings row is created on first read, so any page hit before
 * onboarding finishes finds settings but no routine.
 */
export async function ensureRoutine(fallback: PresetId = "sandhya"): Promise<InstalledRoutine> {
  return (await activeRoutine()) ?? (await installPreset(fallback));
}

/* ------------------------------------------------------------------ completions */

export type CompletionStatus = BlockCompletion["status"];

/** What was marked on one date, keyed by block id. */
export type CompletionMap = Record<number, CompletionStatus>;

/**
 * Marks on one date. A plain object rather than a `Map` because it crosses to the client,
 * where it is JSON either way.
 */
export async function completionsOn(date: string): Promise<CompletionMap> {
  const db = await getDb();
  const rows = await db
    .select({ blockId: schema.blockCompletions.blockId, status: schema.blockCompletions.status })
    .from(schema.blockCompletions)
    .where(eq(schema.blockCompletions.date, date));

  const out: CompletionMap = {};
  for (const row of rows) out[row.blockId] = row.status;
  return out;
}

/** Several dates at once, keyed by date and then by block id. */
export type CompletionCalendar = Record<string, CompletionMap>;

/**
 * Marks across an inclusive date range  --  what the adherence heatmap reads.
 *
 * Dates are stored as `YYYY-MM-DD` text, so a string comparison is a chronological one and the
 * range needs no date arithmetic in SQL. Dates with no marks are absent rather than empty, which
 * is the distinction the heatmap draws between a missed day and one that was never reached.
 */
export async function completionsBetween(from: string, to: string): Promise<CompletionCalendar> {
  const db = await getDb();
  const rows = await db
    .select({
      date: schema.blockCompletions.date,
      blockId: schema.blockCompletions.blockId,
      status: schema.blockCompletions.status,
    })
    .from(schema.blockCompletions)
    .where(and(gte(schema.blockCompletions.date, from), lte(schema.blockCompletions.date, to)))
    .orderBy(asc(schema.blockCompletions.date));

  const out: CompletionCalendar = {};
  for (const row of rows) (out[row.date] ??= {})[row.blockId] = row.status;
  return out;
}

/**
 * Whether any routine carries this block id.
 *
 * `blockCompletions.blockId` is a real foreign key and libSQL enforces it, so marking a block
 * that is not there throws a constraint error rather than inserting a dangling row. A stale
 * client marking a block that has since been deleted is an ordinary thing to happen, though, and
 * a 404 says so far better than a 500  --  hence the check before the write.
 *
 * Deliberately not scoped to the active routine: a mark is a record of what happened on a date,
 * and switching routines afterwards does not unmake it.
 */
export async function blockExists(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.blocks.id })
    .from(schema.blocks)
    .where(eq(schema.blocks.id, id))
    .limit(1);
  return rows.length > 0;
}

/**
 * Marks one block done or skipped, replacing any earlier mark on that date.
 *
 * `at` is refreshed on conflict, so it answers "when did I last mark this" rather than "when
 * did I first". The unique index on `(date, blockId)` is what makes this idempotent  --  two taps
 * arriving together produce one row, not two.
 */
export async function setCompletion(
  date: string,
  blockId: number,
  status: CompletionStatus,
): Promise<CompletionStatus> {
  const db = await getDb();
  await db
    .insert(schema.blockCompletions)
    .values({ date, blockId, status })
    .onConflictDoUpdate({
      target: [schema.blockCompletions.date, schema.blockCompletions.blockId],
      set: { status, at: new Date().toISOString() },
    });
  return status;
}

/** Removes the mark, putting the block back to undecided. */
export async function clearCompletion(date: string, blockId: number): Promise<void> {
  const db = await getDb();
  await db
    .delete(schema.blockCompletions)
    .where(
      and(eq(schema.blockCompletions.date, date), eq(schema.blockCompletions.blockId, blockId)),
    );
}

/**
 * One tap: set the status, or clear it if the block already carries exactly that status.
 *
 * Returns the status the block now has, or null if the mark was removed  --  which is what the
 * client needs to reconcile its optimistic update. Read-then-write, so two taps landing in the
 * same millisecond can lose one; the cost is a stale tick the next refetch corrects, and the
 * alternative (a transaction per tap) buys nothing for a single user tapping their own phone.
 */
export async function toggleCompletion(
  date: string,
  blockId: number,
  status: CompletionStatus = "done",
): Promise<CompletionStatus | null> {
  const db = await getDb();
  const rows = await db
    .select({ status: schema.blockCompletions.status })
    .from(schema.blockCompletions)
    .where(
      and(eq(schema.blockCompletions.date, date), eq(schema.blockCompletions.blockId, blockId)),
    )
    .limit(1);

  if (rows[0]?.status === status) {
    await clearCompletion(date, blockId);
    return null;
  }
  return setCompletion(date, blockId, status);
}

/* ---------------------------------------------------------------- editing blocks */

/**
 * Every write below is scoped to the active routine.
 *
 * Not because Sadhana has other users to protect a routine from  --  it has one  --  but because an
 * id from a routine the user is not looking at would otherwise edit a timetable off screen, and
 * a no-op the handler can turn into a 404 is a better answer than a silent success.
 */
async function activeRoutineIdOrThrow(): Promise<number> {
  return (await ensureRoutine()).routine.id;
}

/** Appends a block to the end of the active routine. */
export async function createBlock(input: BlockInput): Promise<ScheduleBlock> {
  const routineId = await activeRoutineIdOrThrow();
  const db = await getDb();

  const tail = await db
    .select({ next: sql<number>`coalesce(max(${schema.blocks.sortOrder}), -1) + 1` })
    .from(schema.blocks)
    .where(eq(schema.blocks.routineId, routineId));

  const rows = await db
    .insert(schema.blocks)
    .values({ ...input, routineId, sortOrder: tail[0]?.next ?? 0 })
    .returning();
  if (!rows[0]) throw new Error("Could not create the block");
  return scheduleBlockOf(rows[0]);
}

/** Applies a patch. Null means no block of the active routine carries that id. */
export async function updateBlock(id: number, patch: BlockPatch): Promise<ScheduleBlock | null> {
  const routineId = await activeRoutineIdOrThrow();
  const db = await getDb();
  const rows = await db
    .update(schema.blocks)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.blocks.id, id), eq(schema.blocks.routineId, routineId)))
    .returning();
  return rows[0] ? scheduleBlockOf(rows[0]) : null;
}

/**
 * Removes a block, and with it  --  by cascade  --  every mark ever made against it.
 *
 * That is the honest behaviour for a block the user has deleted, but it means the adherence
 * history thins out retroactively. Disabling a block instead keeps both the row and its past.
 */
export async function deleteBlock(id: number): Promise<boolean> {
  const routineId = await activeRoutineIdOrThrow();
  const db = await getDb();
  const rows = await db
    .delete(schema.blocks)
    .where(and(eq(schema.blocks.id, id), eq(schema.blocks.routineId, routineId)))
    .returning({ id: schema.blocks.id });
  return rows.length > 0;
}

/**
 * Rewrites `sortOrder` from the given order.
 *
 * Blocks of the routine that the list does not mention keep their relative order and land
 * after the ones it does, so a stale client sending yesterday's list cannot lose a block.
 * An id belonging to no block of the routine rejects the whole call  --  that is a bug in the
 * caller, and reindexing around it would hide it.
 */
export async function reorderBlocks(ids: number[]): Promise<ScheduleBlock[] | null> {
  const routineId = await activeRoutineIdOrThrow();
  const rows = await blockRowsOf(routineId);
  const known = new Set(rows.map((row) => row.id));

  const seen = new Set<number>();
  const ordered: number[] = [];
  for (const id of ids) {
    if (!known.has(id)) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const row of rows) if (!seen.has(row.id)) ordered.push(row.id);

  const db = await getDb();
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const [index, id] of ordered.entries()) {
      await tx
        .update(schema.blocks)
        .set({ sortOrder: index, updatedAt: now })
        .where(and(eq(schema.blocks.id, id), eq(schema.blocks.routineId, routineId)));
    }
  });

  return (await blockRowsOf(routineId)).map(scheduleBlockOf);
}

/** Sets `enabled` on many blocks at once  --  what the Timeline's weekday filter writes. */
export async function setBlocksEnabled(ids: number[], enabled: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  const routineId = await activeRoutineIdOrThrow();
  const db = await getDb();
  const rows = await db
    .update(schema.blocks)
    .set({ enabled, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.blocks.routineId, routineId), inArray(schema.blocks.id, ids)))
    .returning({ id: schema.blocks.id });
  return rows.length;
}

/* ------------------------------------------------------------ switching routines */

/**
 * Points the day at an existing routine. Null when no routine carries that id.
 *
 * This is the only writer of `settings.activeRoutineId` besides `installPreset`, and the
 * reason the field is not in `settingsPatchSchema`: the check that the integer names a real
 * routine can only happen against the table.
 */
export async function activateRoutine(routineId: number): Promise<InstalledRoutine | null> {
  await getSettings();
  const db = await getDb();

  const found = await db
    .select()
    .from(schema.routines)
    .where(eq(schema.routines.id, routineId))
    .limit(1);
  const routine = found[0];
  if (!routine) return null;

  await db
    .update(schema.settings)
    .set({ activeRoutineId: routine.id, updatedAt: new Date().toISOString() })
    .where(eq(schema.settings.id, SETTINGS_ID));

  return { routine, blocks: (await blockRowsOf(routine.id)).map(scheduleBlockOf) };
}

/** Every routine in the database, presets first, for the Timeline's routine picker. */
export async function listRoutines(): Promise<Routine[]> {
  const db = await getDb();
  return db.select().from(schema.routines).orderBy(asc(schema.routines.id));
}
