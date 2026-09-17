/**
 * The write layer: installing a routine, reading it back, marking blocks, editing them.
 *
 * These are the only tests in the suite that touch a database. Each run gets its own SQLite
 * file in the OS temp directory, migrated from `drizzle/` exactly as the app migrates on
 * first request, so what is exercised here is the real schema and not a hand-built fixture.
 *
 * The test that matters most is the round trip. `tests/schedule.test.ts` pins the four shipped
 * timetables against the pure engine; this file installs one of them, loads it back out of
 * SQLite, and asserts the resolved day is identical  --  same starts, same load, no conflicts. A
 * column silently widened, a default lost in a migration, or a field dropped from
 * `scheduleBlockOf` all surface as a difference between the two paths.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findPreset, presetBlocks, type RoutinePreset } from "@/data/routines";
import { buildDayPlan, DAY_INPUT_DEFAULTS, type DayPlan } from "@/lib/day";
import { resolveDay, type ResolvedDay } from "@/lib/schedule";
import { parseISODate } from "@/lib/time";
import { blockInputSchema, type BlockInput } from "@/lib/validators";

/** Set before anything imports the client, because the URL is read on first connection. */
const dir = mkdtempSync(path.join(tmpdir(), "sadhana-blocks-"));
process.env.SADHANA_DB_URL = `file:${path.join(dir, "blocks.db")}`;

const blocks = await import("@/lib/blocks");
const db = await import("@/lib/db");
const settings = await import("@/lib/settings");

const REFERENCE = "2026-03-20";

function planFor(preset: RoutinePreset, date = REFERENCE): DayPlan {
  return buildDayPlan(parseISODate(date), {
    ...DAY_INPUT_DEFAULTS,
    wakeOffsetMinutes: preset.wakeOffsetMinutes,
    sleepTargetMinutes: preset.sleepTargetMinutes,
  });
}

/** Titles with their resolved span  --  the shape that must survive a trip through SQLite. */
function spansOf(day: ResolvedDay): string[] {
  return day.entries.map((entry) => `${entry.block.title} ${entry.start}-${entry.end}`);
}

const sandhya = findPreset("sandhya")!;

/** A valid block, built through the wire schema so the test uses the API's own defaults. */
function newBlock(over: Partial<BlockInput> = {}): BlockInput {
  return blockInputSchema.parse({
    title: "Test block",
    category: "work",
    anchor: "clock",
    offsetMinutes: 600,
    durationMinutes: 30,
    ...over,
  });
}

beforeAll(async () => {
  await db.getDb();
});

afterAll(async () => {
  await db.closeDb();
  // Windows holds the SQLite handle for a moment after `close()`, so EPERM here is a timing
  // artefact rather than a failure. Retry, then leave it to the OS's temp sweep.
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  } catch {
    /* the temp directory outlives the run; nothing the suite is testing depends on it */
  }
});

describe("installing a preset", () => {
  it("writes the routine, its blocks, and the pointer to it", async () => {
    const installed = await blocks.installPreset("sandhya");

    expect(installed.routine.slug).toBe("sandhya");
    expect(installed.routine.name).toBe(sandhya.name);
    expect(installed.routine.description).toBe(sandhya.tagline);
    expect(installed.routine.isPreset).toBe(true);
    expect(installed.blocks).toHaveLength(sandhya.blocks.length);

    const row = await settings.getSettings();
    expect(row.activeRoutineId).toBe(installed.routine.id);
  });

  it("numbers sortOrder by the preset's own order", async () => {
    const installed = await blocks.installPreset("sandhya");
    expect(installed.blocks.map((block) => block.sortOrder)).toEqual(
      sandhya.blocks.map((_seed, index) => index),
    );
    expect(installed.blocks.map((block) => block.title)).toEqual(
      sandhya.blocks.map((seed) => seed.title),
    );
  });

  it("replaces on reinstall instead of accumulating routines", async () => {
    const first = await blocks.installPreset("sandhya");
    const again = await blocks.installPreset("sandhya");

    expect(again.routine.id).toBe(first.routine.id);
    expect(again.blocks).toHaveLength(sandhya.blocks.length);
    // New rows, because the old ones were deleted rather than updated in place.
    expect(again.blocks[0]!.id).toBeGreaterThan(first.blocks[0]!.id);

    const routines = await blocks.listRoutines();
    expect(routines.filter((routine) => routine.slug === "sandhya")).toHaveLength(1);
  });

  it("keeps each preset as its own routine and switches the pointer", async () => {
    const sandhyaRoutine = await blocks.installPreset("sandhya");
    const traditional = await blocks.installPreset("traditional");

    expect(traditional.routine.id).not.toBe(sandhyaRoutine.routine.id);
    expect((await settings.getSettings()).activeRoutineId).toBe(traditional.routine.id);

    const slugs = (await blocks.listRoutines()).map((routine) => routine.slug);
    expect(slugs).toContain("sandhya");
    expect(slugs).toContain("traditional");
  });

  it("rejects a preset id that does not exist", async () => {
    // @ts-expect-error - the point is what happens when the guard is the only thing left.
    await expect(blocks.installPreset("nonesuch")).rejects.toThrow(/Unknown preset/);
  });
});

/**
 * A preset is a timetable *plus a night*, and installing has to carry both.
 *
 * The round trip below resolves against `planFor(preset)`  --  the preset's own wake offset  --  which
 * is exactly why it never caught this. Sandhya's blocks sit correctly at its own sunrise−30 and
 * collide at the schema's sunrise−75: `daylight` hangs off `sunrise`, `pranayama` hangs off
 * `wake`, and moving one anchor without the other slides them into each other. So these cases
 * build the day the way every page builds it  --  from the settings row  --  and read the overlap count
 * the Today view's fit card puts on screen.
 */
describe("the night a preset assumes", () => {
  /** Deliberately unlike any preset's night: wake *after* sunrise, on too little sleep. */
  const MISMATCHED = { wakeOffsetMinutes: 15, sleepTargetMinutes: 400 };

  /** The day as the app assembles it: from what is stored, not from the preset in hand. */
  async function dayFromSettings(date = REFERENCE): Promise<ResolvedDay> {
    const row = await settings.getSettings();
    const plan = buildDayPlan(parseISODate(date), settings.dayInputFromSettings(row));
    return resolveDay(plan, await blocks.activeBlocks());
  }

  it("moves the stored night to the one the blocks were authored against", async () => {
    await settings.updateSettings(MISMATCHED);
    await blocks.installPreset("sandhya");

    const row = await settings.getSettings();
    expect(row.wakeOffsetMinutes).toBe(sandhya.wakeOffsetMinutes);
    expect(row.sleepTargetMinutes).toBe(sandhya.sleepTargetMinutes);
  });

  it("leaves it alone when asked to, which is what onboarding needs", async () => {
    await settings.updateSettings(MISMATCHED);
    await blocks.installPreset("sandhya", { adoptSleep: false });

    const row = await settings.getSettings();
    expect(row.wakeOffsetMinutes).toBe(MISMATCHED.wakeOffsetMinutes);
    expect(row.sleepTargetMinutes).toBe(MISMATCHED.sleepTargetMinutes);
    // And the preset's own numbers really are different, or the assertions above say nothing.
    expect(sandhya.wakeOffsetMinutes).not.toBe(MISMATCHED.wakeOffsetMinutes);
    expect(sandhya.sleepTargetMinutes).not.toBe(MISMATCHED.sleepTargetMinutes);
  });

  it.each(["traditional", "sandhya", "gentle", "hardcore"] as const)(
    "installs %s onto a mismatched night and still resolves without a collision",
    async (id) => {
      await settings.updateSettings(MISMATCHED);
      await blocks.installPreset(id);

      const day = await dayFromSettings();
      expect(day.overlaps).toEqual([]);
      expect(day.entries.length).toBeGreaterThan(0);
    },
  );
});

describe("the round trip through SQLite", () => {
  it("resolves a stored routine exactly as the pure engine resolves the preset", async () => {
    await blocks.installPreset("sandhya");
    const stored = await blocks.activeBlocks();
    const plan = planFor(sandhya);

    const fromDb = resolveDay(plan, stored);
    const fromData = resolveDay(plan, presetBlocks(sandhya));

    expect(spansOf(fromDb)).toEqual(spansOf(fromData));
    expect(fromDb.scheduledMinutes).toBe(fromData.scheduledMinutes);
    expect(fromDb.overlaps).toEqual([]);
    // The numbers `tests/schedule.test.ts` publishes for this preset on this date.
    expect(plan.personal.wake).toBe(350);
    expect(plan.personal.bedtime).toBe(1325);
    expect(fromDb.scheduledMinutes).toBe(673);
  });

  it("carries every scheduling field, not just the ones the timeline shows", async () => {
    await blocks.installPreset("hardcore");
    const hardcore = findPreset("hardcore")!;
    const stored = await blocks.activeBlocks();

    // Compared field-by-field with ids normalised: the DB assigns its own.
    const strip = (block: (typeof stored)[number]) => ({ ...block, id: 0 });
    expect(stored.map(strip)).toEqual(presetBlocks(hardcore).map(strip));
  });

  it("reads as empty when nothing is installed, and ensureRoutine fixes that", async () => {
    const handle = await db.getDb();
    await handle
      .update(db.schema.settings)
      .set({ activeRoutineId: null })
      .where(eq(db.schema.settings.id, 1));

    expect(await blocks.activeRoutine()).toBeNull();
    expect(await blocks.activeBlocks()).toEqual([]);

    const ensured = await blocks.ensureRoutine("gentle");
    expect(ensured.routine.slug).toBe("gentle");
    expect((await settings.getSettings()).activeRoutineId).toBe(ensured.routine.id);
    // Already installed now, so a second call is a read rather than a reinstall.
    expect((await blocks.ensureRoutine("gentle")).blocks[0]!.id).toBe(ensured.blocks[0]!.id);
  });

  it("treats a pointer at a deleted routine as nothing installed", async () => {
    const installed = await blocks.installPreset("gentle");
    const handle = await db.getDb();
    await handle.delete(db.schema.routines).where(eq(db.schema.routines.id, installed.routine.id));

    expect((await settings.getSettings()).activeRoutineId).toBe(installed.routine.id);
    expect(await blocks.activeRoutine()).toBeNull();
  });
});

describe("completions", () => {
  const date = "2026-03-20";
  let blockId = 0;

  beforeAll(async () => {
    const installed = await blocks.installPreset("sandhya");
    blockId = installed.blocks[0]!.id;
  });

  it("toggles a mark on, then off", async () => {
    expect(await blocks.toggleCompletion(date, blockId)).toBe("done");
    expect(await blocks.completionsOn(date)).toEqual({ [blockId]: "done" });

    expect(await blocks.toggleCompletion(date, blockId)).toBeNull();
    expect(await blocks.completionsOn(date)).toEqual({});
  });

  it("switches status rather than clearing when the status differs", async () => {
    await blocks.setCompletion(date, blockId, "done");
    expect(await blocks.toggleCompletion(date, blockId, "skipped")).toBe("skipped");
    expect(await blocks.completionsOn(date)).toEqual({ [blockId]: "skipped" });
    await blocks.clearCompletion(date, blockId);
  });

  it("is idempotent, and keeps one row per block per date", async () => {
    await blocks.setCompletion(date, blockId, "done");
    await blocks.setCompletion(date, blockId, "done");
    await blocks.setCompletion(date, blockId, "skipped");

    const handle = await db.getDb();
    const rows = await handle
      .select()
      .from(db.schema.blockCompletions)
      .where(eq(db.schema.blockCompletions.date, date));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("skipped");
  });

  it("keeps dates apart", async () => {
    await blocks.setCompletion("2026-03-21", blockId, "done");
    expect(await blocks.completionsOn("2026-03-21")).toEqual({ [blockId]: "done" });
    expect(await blocks.completionsOn("2026-03-22")).toEqual({});
  });

  it("loses its marks when the block is deleted", async () => {
    const created = await blocks.createBlock(newBlock({ title: "Temporary" }));
    await blocks.setCompletion(date, created.id, "done");
    expect(await blocks.completionsOn(date)).toHaveProperty(String(created.id));

    expect(await blocks.deleteBlock(created.id)).toBe(true);
    expect(await blocks.completionsOn(date)).not.toHaveProperty(String(created.id));
  });
});

describe("reading marks across a range", () => {
  let ids: number[] = [];

  beforeAll(async () => {
    const installed = await blocks.installPreset("sandhya");
    ids = installed.blocks.slice(0, 2).map((block) => block.id);

    // A week with three marked days in it, one of them outside the range read below.
    await blocks.setCompletion("2026-04-01", ids[0]!, "done");
    await blocks.setCompletion("2026-04-01", ids[1]!, "skipped");
    await blocks.setCompletion("2026-04-03", ids[0]!, "done");
    await blocks.setCompletion("2026-04-09", ids[0]!, "done");
  });

  it("keys by date and includes both ends", async () => {
    const calendar = await blocks.completionsBetween("2026-04-01", "2026-04-03");
    expect(Object.keys(calendar).sort()).toEqual(["2026-04-01", "2026-04-03"]);
    expect(calendar["2026-04-01"]).toEqual({ [ids[0]!]: "done", [ids[1]!]: "skipped" });
    expect(calendar["2026-04-03"]).toEqual({ [ids[0]!]: "done" });
  });

  it("leaves unmarked dates out rather than empty", async () => {
    const calendar = await blocks.completionsBetween("2026-04-01", "2026-04-05");
    // The 2nd, 4th and 5th were never marked, so the heatmap can tell them from a missed day.
    expect(calendar).not.toHaveProperty("2026-04-02");
    expect(calendar["2026-04-09"]).toBeUndefined();
  });

  it("compares dates as text, which for YYYY-MM-DD is chronological", async () => {
    expect(Object.keys(await blocks.completionsBetween("2026-04-04", "2026-04-30"))).toEqual([
      "2026-04-09",
    ]);
    expect(await blocks.completionsBetween("2026-05-01", "2026-05-31")).toEqual({});
  });
});

describe("blockExists", () => {
  it("answers for any routine, and stops answering after a delete", async () => {
    const installed = await blocks.installPreset("sandhya");
    expect(await blocks.blockExists(installed.blocks[0]!.id)).toBe(true);
    expect(await blocks.blockExists(999_999)).toBe(false);

    // Not scoped to the active routine: the mark outlives the switch away from it.
    await blocks.installPreset("gentle");
    expect(await blocks.blockExists(installed.blocks[0]!.id)).toBe(true);

    const doomed = await blocks.createBlock(newBlock({ title: "Doomed" }));
    await blocks.deleteBlock(doomed.id);
    expect(await blocks.blockExists(doomed.id)).toBe(false);
  });
});

describe("editing blocks", () => {
  beforeAll(async () => {
    await blocks.installPreset("sandhya");
  });

  it("appends a new block after the last one", async () => {
    const before = await blocks.activeBlocks();
    const created = await blocks.createBlock(newBlock({ title: "Appended" }));

    expect(created.sortOrder).toBe(before.length);
    expect(created.title).toBe("Appended");
    expect(created.anchor).toBe("clock");
    expect(created.enabled).toBe(true);
    // The wire defaults, applied by the schema rather than by the column.
    expect(created.fuel).toBe("any");
    expect(created.weekdayMask).toBe(127);
    expect(created.notifyLeadMinutes).toBe(5);
    expect(created.scienceIds).toEqual([]);
    expect(created.href).toBeNull();

    const after = await blocks.activeBlocks();
    expect(after).toHaveLength(before.length + 1);
    expect(after.at(-1)!.id).toBe(created.id);
  });

  it("patches only the fields given", async () => {
    const created = await blocks.createBlock(
      newBlock({ title: "Before", detail: "kept", offsetMinutes: 400 }),
    );
    const patched = await blocks.updateBlock(created.id, { title: "After", enabled: false });

    expect(patched).not.toBeNull();
    expect(patched!.title).toBe("After");
    expect(patched!.detail).toBe("kept");
    expect(patched!.offsetMinutes).toBe(400);
    expect(patched!.enabled).toBe(false);
  });

  it("hides a disabled block from the resolver unless asked for it", async () => {
    const created = await blocks.createBlock(newBlock({ title: "Disabled", enabled: false }));
    const plan = planFor(sandhya);
    const stored = await blocks.activeBlocks();

    const titles = (day: ResolvedDay) => day.entries.map((entry) => entry.block.title);
    expect(titles(resolveDay(plan, stored))).not.toContain("Disabled");
    expect(titles(resolveDay(plan, stored, { includeDisabled: true }))).toContain("Disabled");

    await blocks.deleteBlock(created.id);
  });

  it("refuses ids that belong to no block of the active routine", async () => {
    expect(await blocks.updateBlock(999_999, { title: "Nope" })).toBeNull();
    expect(await blocks.deleteBlock(999_999)).toBe(false);
    expect(await blocks.reorderBlocks([999_999])).toBeNull();
  });

  it("deletes once", async () => {
    const created = await blocks.createBlock(newBlock({ title: "Doomed" }));
    expect(await blocks.deleteBlock(created.id)).toBe(true);
    expect(await blocks.deleteBlock(created.id)).toBe(false);
  });
});

describe("reordering", () => {
  beforeAll(async () => {
    await blocks.installPreset("sandhya");
  });

  it("renumbers from the order given", async () => {
    const before = await blocks.activeBlocks();
    const reversed = [...before].reverse().map((block) => block.id);
    const after = await blocks.reorderBlocks(reversed);

    expect(after).not.toBeNull();
    expect(after!.map((block) => block.id)).toEqual(reversed);
    expect(after!.map((block) => block.sortOrder)).toEqual(before.map((_b, index) => index));
  });

  it("puts blocks the list forgot after the ones it named", async () => {
    const before = await blocks.activeBlocks();
    const named = before.slice(0, 3).map((block) => block.id);
    const forgotten = before.slice(3).map((block) => block.id);

    const after = await blocks.reorderBlocks(named);
    expect(after!.map((block) => block.id)).toEqual([...named, ...forgotten]);
  });

  it("ignores a repeated id rather than counting it twice", async () => {
    const before = await blocks.activeBlocks();
    const first = before[0]!.id;
    const after = await blocks.reorderBlocks([first, first]);

    expect(after).toHaveLength(before.length);
    expect(after!.map((block) => block.id).indexOf(first)).toBe(0);
    expect(new Set(after!.map((block) => block.id)).size).toBe(before.length);
  });

  it("enables and disables in bulk", async () => {
    const stored = await blocks.activeBlocks();
    const ids = stored.slice(0, 4).map((block) => block.id);

    expect(await blocks.setBlocksEnabled(ids, false)).toBe(4);
    const disabled = await blocks.activeBlocks();
    expect(disabled.filter((block) => !block.enabled).map((block) => block.id)).toEqual(ids);

    expect(await blocks.setBlocksEnabled(ids, true)).toBe(4);
    expect((await blocks.activeBlocks()).every((block) => block.enabled)).toBe(true);
    expect(await blocks.setBlocksEnabled([], true)).toBe(0);
  });
});

describe("switching routines", () => {
  it("points at an existing routine and refuses one that is not there", async () => {
    const sandhyaRoutine = await blocks.installPreset("sandhya");
    const traditional = await blocks.installPreset("traditional");
    expect((await settings.getSettings()).activeRoutineId).toBe(traditional.routine.id);

    const back = await blocks.activateRoutine(sandhyaRoutine.routine.id);
    expect(back).not.toBeNull();
    expect(back!.routine.slug).toBe("sandhya");
    expect(back!.blocks).toHaveLength(sandhya.blocks.length);
    expect((await settings.getSettings()).activeRoutineId).toBe(sandhyaRoutine.routine.id);

    expect(await blocks.activateRoutine(999_999)).toBeNull();
    expect((await settings.getSettings()).activeRoutineId).toBe(sandhyaRoutine.routine.id);
  });
});
