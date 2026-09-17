/**
 * The block engine, and the four shipped timetables it has to keep straight.
 *
 * Two halves. The first drives `lib/schedule.ts` with hand-built blocks  --  masks, anchors,
 * ordering, overlap and gap detection, the moment lookup  --  using `clock` offsets wherever an
 * exact minute matters, so the assertions do not depend on the astronomy.
 *
 * The second half is the one that protects the routine data. `data/routines.ts` makes three
 * numeric promises about every preset and one geographic one  --  collision-free from Trivandrum
 * to Guwahati across a whole year  --  and a comment cannot keep a promise. These tests can.
 */

import { describe, expect, it } from "vitest";

import { presetBlocks, PRESET_IDS, ROUTINE_PRESETS, type RoutinePreset } from "@/data/routines";
import { buildDayPlan, DAY_INPUT_DEFAULTS, type DayInput, type DayPlan } from "@/lib/day";
import {
  alignMinute,
  ANCHOR_META,
  anchorsOf,
  describeMask,
  describeOffset,
  EVERY_DAY,
  maskDays,
  maskHas,
  maskOf,
  maskToggle,
  notificationsDue,
  resolveAnchor,
  resolveDay,
  scheduleNow,
  WEEKDAYS_ONLY,
  WEEKEND_ONLY,
  type ScheduleBlock,
} from "@/lib/schedule";
import { addDays, parseISODate, toISODate } from "@/lib/time";

/* ------------------------------------------------------------------- fixtures */

const HYDERABAD = {
  city: "Hyderabad",
  region: "Telangana",
  latitude: 17.385,
  longitude: 78.4867,
  timeZone: "Asia/Kolkata",
};

const GUWAHATI = {
  city: "Guwahati",
  region: "Assam",
  latitude: 26.1445,
  longitude: 91.7362,
  timeZone: "Asia/Kolkata",
};

const TRIVANDRUM = {
  city: "Thiruvananthapuram",
  region: "Kerala",
  latitude: 8.5241,
  longitude: 76.9366,
  timeZone: "Asia/Kolkata",
};

const TROMSO = {
  city: "Tromsø",
  region: "Troms",
  latitude: 69.6492,
  longitude: 18.9553,
  timeZone: "Europe/Oslo",
};

/** Outside the documented envelope, and kept here to check how it fails. */
const SRINAGAR = {
  city: "Srinagar",
  region: "Jammu and Kashmir",
  latitude: 34.0837,
  longitude: 74.7973,
  timeZone: "Asia/Kolkata",
};

type Place = typeof HYDERABAD;

/**
 * The date the timetables were laid out against: the March equinox, and a Friday, so the
 * weekday-masked blocks are all on.
 */
const REFERENCE = "2026-03-20";

function planFor(date: string, place: Place = HYDERABAD, preset?: RoutinePreset): DayPlan {
  const input: DayInput = {
    ...DAY_INPUT_DEFAULTS,
    ...place,
    ...(preset === undefined
      ? {}
      : {
          wakeOffsetMinutes: preset.wakeOffsetMinutes,
          sleepTargetMinutes: preset.sleepTargetMinutes,
        }),
  };
  return buildDayPlan(parseISODate(date), input);
}

let nextId = 0;

/** A block with every field filled, so a test names only what it is about. */
function makeBlock(partial: Partial<ScheduleBlock> = {}): ScheduleBlock {
  nextId += 1;
  const id = partial.id ?? nextId;
  return {
    id,
    title: `Block ${id}`,
    detail: "",
    category: "work",
    anchor: "clock",
    offsetMinutes: 600,
    durationMinutes: 30,
    fuel: "any",
    weekdayMask: EVERY_DAY,
    notify: false,
    notifyLeadMinutes: 5,
    sortOrder: id,
    icon: "dot",
    scienceIds: [],
    href: null,
    enabled: true,
    ...partial,
  };
}

/** `clock`-anchored, so start and end are the literal minutes given. */
function at(start: number, durationMinutes: number, extra: Partial<ScheduleBlock> = {}) {
  return makeBlock({ anchor: "clock", offsetMinutes: start, durationMinutes, ...extra });
}

/* ------------------------------------------------------------- the weekday mask */

describe("weekday masks", () => {
  it("reads bit 0 as Sunday", () => {
    expect(maskHas(EVERY_DAY, 0)).toBe(true);
    expect(maskHas(WEEKDAYS_ONLY, 0)).toBe(false);
    expect(maskHas(WEEKDAYS_ONLY, 6)).toBe(false);
    expect(maskHas(WEEKDAYS_ONLY, 3)).toBe(true);
    expect(maskHas(WEEKEND_ONLY, 0)).toBe(true);
    expect(maskHas(WEEKEND_ONLY, 6)).toBe(true);
  });

  it("round-trips days through a mask", () => {
    expect(maskOf([1, 3, 5])).toBe(0b0101010);
    expect(maskDays(maskOf([1, 3, 5]))).toEqual([1, 3, 5]);
    expect(maskDays(EVERY_DAY)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(maskOf([])).toBe(0);
    expect(maskDays(0)).toEqual([]);
  });

  it("toggles one day at a time and never sets a bit past Saturday", () => {
    expect(maskToggle(EVERY_DAY, 0)).toBe(0b1111110);
    expect(maskToggle(maskToggle(EVERY_DAY, 0), 0)).toBe(EVERY_DAY);
    expect(maskToggle(0, 6)).toBe(0b1000000);
    // Bit 7 has no weekday, so toggling it must be a no-op rather than a 255.
    expect(maskToggle(EVERY_DAY, 7)).toBe(EVERY_DAY);
  });

  it("puts the mask into words, naming the shorthands first", () => {
    expect(describeMask(EVERY_DAY)).toBe("Every day");
    expect(describeMask(0)).toBe("Never");
    expect(describeMask(WEEKDAYS_ONLY)).toBe("Weekdays");
    expect(describeMask(WEEKEND_ONLY)).toBe("Weekends");
    expect(describeMask(maskOf([1, 3, 5]))).toBe("Mon, Wed, Fri");
    expect(describeMask(maskToggle(EVERY_DAY, 0))).toBe("Every day except Sun");
    expect(describeMask(maskToggle(EVERY_DAY, 3))).toBe("Every day except Wed");
    // High bits are ignored rather than printed.
    expect(describeMask(0b11111111)).toBe("Every day");
  });
});

/* ----------------------------------------------------------------- the anchors */

describe("anchorsOf", () => {
  it("resolves the six anchors for the reference day", () => {
    const plan = planFor(REFERENCE);
    expect(plan.weekday).toBe(5); // Friday  --  every weekday-masked block is on.
    expect(plan.sun.sunrise).toBe(380);
    expect(plan.sun.solarNoon).toBe(744);
    expect(plan.sun.sunset).toBe(1107);

    expect(anchorsOf(plan)).toEqual({
      sunrise: 380,
      sunset: 1107,
      solarNoon: 744,
      brahmaMuhurta: 284, // sunrise − 96, the fixed-mode 14th muhurta of the night
      wake: 305, // sunrise − 75
      bedtime: 1280, // wake + 1440 − 465
    });
  });

  it("recovers sunrise from the personal anchors inside a polar day", () => {
    const plan = planFor("2026-06-21", TROMSO);
    expect(plan.sun.sunrise).toBeNull();
    expect(plan.sun.estimated).toBe(true);

    const anchors = anchorsOf(plan);
    // The one decision lib/day.ts already made, reused rather than re-guessed.
    expect(anchors.sunrise).toBe(plan.personal.wake - plan.personal.wakeOffsetMinutes);
    expect(anchors.brahmaMuhurta).toBe(anchors.sunrise - 96);
    expect(anchors.sunset).toBe(plan.sun.solarNoon + 360);
    expect(anchors.sunset).toBeGreaterThan(anchors.sunrise);
  });

  it("treats a clock offset as the minute itself", () => {
    const anchors = anchorsOf(planFor(REFERENCE));
    expect(resolveAnchor(anchors, "clock", 400)).toBe(400);
    expect(resolveAnchor(anchors, "sunrise", -30)).toBe(350);
    expect(resolveAnchor(anchors, "bedtime", -215)).toBe(1065);
    expect(resolveAnchor(anchors, "wake", 0)).toBe(305);
  });
});

describe("describeOffset", () => {
  // A stub formatter, so this asserts describeOffset's own wording and not time.ts's.
  const fmt = (minute: number) => `[${minute}]`;

  it("names a fixed time as fixed", () => {
    expect(describeOffset("clock", 390, fmt)).toBe("[390], fixed");
  });

  it("drops the arithmetic when the offset is zero", () => {
    expect(describeOffset("sunrise", 0, fmt)).toBe(ANCHOR_META.sunrise.label);
    expect(describeOffset("bedtime", 0, fmt)).toBe(ANCHOR_META.bedtime.label);
  });

  it("spells the span in hours and minutes, with a real minus sign", () => {
    expect(describeOffset("bedtime", -45, fmt)).toBe(`${ANCHOR_META.bedtime.label} − 45m`);
    expect(describeOffset("solarNoon", 120, fmt)).toBe(`${ANCHOR_META.solarNoon.label} + 2h`);
    expect(describeOffset("wake", 95, fmt)).toBe(`${ANCHOR_META.wake.label} + 1h 35m`);
    expect(describeOffset("sunrise", -96, fmt)).toBe(`${ANCHOR_META.sunrise.label} − 1h 36m`);
  });
});

/* ------------------------------------------------------------------ resolveDay */

describe("resolveDay", () => {
  const plan = planFor(REFERENCE);

  it("orders by start, breaking ties on the routine's own order", () => {
    const day = resolveDay(plan, [
      at(600, 30, { id: 3, sortOrder: 3 }),
      at(305, 5, { id: 2, sortOrder: 2 }),
      at(305, 5, { id: 1, sortOrder: 1 }),
    ]);
    expect(day.entries.map((entry) => entry.block.id)).toEqual([1, 2, 3]);
  });

  it("carries the anchor it resolved against, so the interface can show the arithmetic", () => {
    const day = resolveDay(plan, [makeBlock({ anchor: "sunrise", offsetMinutes: -96 })]);
    const [entry] = day.entries;
    expect(entry.anchorMinute).toBe(380);
    expect(entry.start).toBe(284);
    expect(entry.end).toBe(314);
    expect(entry.today).toBe(true);
  });

  it("sets a block off today's mask aside instead of dropping it", () => {
    const weekend = at(600, 30, { id: 1, weekdayMask: WEEKEND_ONLY });
    const weekday = at(700, 30, { id: 2, weekdayMask: WEEKDAYS_ONLY });
    const day = resolveDay(plan, [weekend, weekday]);

    expect(day.entries.map((entry) => entry.block.id)).toEqual([2]);
    expect(day.offToday.map((entry) => entry.block.id)).toEqual([1]);
    // Still resolved, so the Timeline can show what it would have been.
    expect(day.offToday[0].start).toBe(600);
    expect(day.offToday[0].today).toBe(false);
    expect(day.scheduledMinutes).toBe(30);
  });

  it("drops a disabled block from both lists unless asked for it", () => {
    const blocks = [at(600, 30, { id: 1 }), at(700, 30, { id: 2, enabled: false })];

    const without = resolveDay(plan, blocks);
    expect(without.entries).toHaveLength(1);
    expect(without.offToday).toHaveLength(0);

    const with_ = resolveDay(plan, blocks, { includeDisabled: true });
    expect(with_.entries.map((entry) => entry.block.id)).toEqual([1, 2]);
  });

  it("counts overlapping stretches once", () => {
    const day = resolveDay(plan, [at(300, 60), at(330, 90), at(500, 30)]);
    expect(day.scheduledMinutes).toBe(150); // 300–420 and 500–530
  });

  it("clamps a negative duration rather than running backwards", () => {
    const day = resolveDay(plan, [at(600, -30)]);
    expect(day.entries[0].end).toBe(600);
    expect(day.scheduledMinutes).toBe(0);
  });

  it("carries the date and weekday through from the plan", () => {
    const day = resolveDay(plan, []);
    expect(day.date).toBe(REFERENCE);
    expect(day.weekday).toBe(5);
    expect(day.entries).toEqual([]);
    expect(day.scheduledMinutes).toBe(0);
  });
});

/* -------------------------------------------------------------------- overlaps */

describe("overlap detection", () => {
  const plan = planFor(REFERENCE);

  it("reports every colliding pair, not just neighbours", () => {
    // A long work stretch swallowing two short blocks that do not touch each other. Scanning
    // only adjacent pairs would find the first and miss the second.
    const day = resolveDay(plan, [
      at(600, 180, { id: 1, title: "Deep work" }),
      at(620, 10, { id: 2, title: "Water" }),
      at(700, 10, { id: 3, title: "Stand up" }),
    ]);

    expect(day.overlaps).toHaveLength(2);
    expect(day.overlaps.map((c) => c.blockIds)).toEqual([
      [1, 2],
      [1, 3],
    ]);
    expect(day.overlaps.map((c) => c.minutes)).toEqual([10, 10]);
    expect(day.overlaps[0].kind).toBe("overlap");
    expect(day.overlaps[0].message).toBe("“Deep work” and “Water” overlap by 10 minutes.");
  });

  it("measures a partial collision from the later start to the earlier end", () => {
    const day = resolveDay(plan, [at(600, 60, { id: 1 }), at(630, 70, { id: 2 })]);
    expect(day.overlaps).toHaveLength(1);
    expect(day.overlaps[0].minutes).toBe(30);
  });

  it("does not count blocks that merely touch", () => {
    const day = resolveDay(plan, [at(600, 60, { id: 1 }), at(660, 40, { id: 2 })]);
    expect(day.overlaps).toEqual([]);
    expect(day.scheduledMinutes).toBe(100);
  });

  it("ignores a collision with a block that is off today", () => {
    const day = resolveDay(plan, [
      at(600, 60, { id: 1 }),
      at(610, 30, { id: 2, weekdayMask: WEEKEND_ONLY }),
    ]);
    expect(day.overlaps).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ gaps */

describe("gap detection", () => {
  const plan = planFor(REFERENCE); // wake 305, lights out 1280

  it("names the day's own edges as block 0", () => {
    const day = resolveDay(plan, [at(800, 30, { id: 7, title: "Lunch" })]);

    expect(day.gaps.map((c) => c.kind)).toEqual(["gap", "gap"]);
    expect(day.gaps.map((c) => c.blockIds)).toEqual([
      [0, 7],
      [7, 0],
    ]);
    expect(day.gaps.map((c) => c.minutes)).toEqual([495, 450]);
    expect(day.gaps[0].message).toBe("8h 15m unscheduled between waking and “Lunch”.");
    expect(day.gaps[1].message).toBe("7h 30m unscheduled between “Lunch” and lights out.");
  });

  it("only reports a stretch at least as long as the threshold", () => {
    const blocks = [at(800, 30, { id: 7 })];
    expect(resolveDay(plan, blocks, { gapThreshold: 460 }).gaps.map((c) => c.minutes)).toEqual([
      495,
    ]);
    expect(resolveDay(plan, blocks, { gapThreshold: 500 }).gaps).toEqual([]);
  });

  it("writes a sub-hour gap in plain minutes", () => {
    const day = resolveDay(
      plan,
      [at(800, 30, { id: 1, title: "Lunch" }), at(875, 30, { id: 2, title: "Walk" })],
      { gapThreshold: 30 },
    );
    expect(day.gaps.map((c) => c.minutes)).toEqual([495, 45, 375]);
    expect(day.gaps[1].message).toBe("45 minutes unscheduled between “Lunch” and “Walk”.");
  });

  it("counts only waking time as a gap, though every block counts as scheduled", () => {
    const day = resolveDay(plan, [
      at(100, 30, { id: 1 }), // before waking
      at(800, 30, { id: 2 }),
      at(1400, 30, { id: 3 }), // after lights out
    ]);
    expect(day.gaps.map((c) => c.blockIds)).toEqual([
      [0, 2],
      [2, 0],
    ]);
    expect(day.gaps.map((c) => c.minutes)).toEqual([495, 450]);
    expect(day.scheduledMinutes).toBe(90);
  });

  it("does not turn a swallowed block into a gap edge", () => {
    const day = resolveDay(plan, [
      at(600, 180, { id: 1, title: "Deep work" }),
      at(620, 10, { id: 2, title: "Water" }),
    ]);
    // The short block sits inside the long one, so the reach never moves backwards and the
    // gap after the pair is still measured from the long block's end.
    expect(day.gaps.map((c) => c.blockIds)).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(day.gaps.map((c) => c.minutes)).toEqual([295, 500]);
  });

  it("reports nothing when a block covers the whole waking day", () => {
    expect(resolveDay(plan, [at(305, 975)]).gaps).toEqual([]);
  });

  it("reports nothing when there is no waking day to divide", () => {
    const asleep = buildDayPlan(parseISODate(REFERENCE), {
      ...DAY_INPUT_DEFAULTS,
      ...HYDERABAD,
      sleepTargetMinutes: 1440,
    });
    expect(asleep.personal.bedtime).toBe(asleep.personal.wake);
    expect(resolveDay(asleep, [at(800, 30)]).gaps).toEqual([]);
  });
});

/* ---------------------------------------------------------------- the moment */

describe("alignMinute", () => {
  const plan = planFor(REFERENCE); // wake 305, lights out 1280

  it("leaves a reading that already falls inside the day alone", () => {
    const day = resolveDay(plan, [at(284, 20)]); // a pre-dawn sit widens the day to 284
    expect(alignMinute(day, 400)).toBe(400);
    expect(alignMinute(day, 290)).toBe(290);
  });

  it("reads a small-hours clock as tonight when the day does not reach into tomorrow", () => {
    const day = resolveDay(plan, [at(284, 20)]);
    // 00:30 is either a pre-dawn 30 or tonight's 1470. Neither is inside 284–1280, so the
    // closer of the two wins, and tonight is closer.
    expect(alignMinute(day, 30)).toBe(1470);
  });

  it("reads the same clock as tomorrow when a block runs past midnight", () => {
    const day = resolveDay(plan, [at(284, 20), at(1500, 30)]);
    expect(alignMinute(day, 30)).toBe(1470);
    expect(alignMinute(day, 1470)).toBe(1470);
  });

  it("falls back to the waking window when there are no blocks at all", () => {
    const day = resolveDay(plan, []);
    expect(alignMinute(day, 305)).toBe(305);
    expect(alignMinute(day, 1280)).toBe(1280);
    expect(alignMinute(day, 1400)).toBe(1400); // nothing nearer than staying put
  });
});

describe("scheduleNow", () => {
  const plan = planFor(REFERENCE);
  const day = resolveDay(plan, [at(600, 30, { id: 1 }), at(700, 60, { id: 2 }), at(900, 30, { id: 3 })]);

  it("finds the block containing the moment, and the one after it", () => {
    const now = scheduleNow(day, 710);
    expect(now.minute).toBe(710);
    expect(now.current.map((entry) => entry.block.id)).toEqual([2]);
    expect(now.next?.block.id).toBe(3);
    expect(now.untilNext).toBe(190);
    expect(now.remaining).toBe(50);
    expect(now.past.map((entry) => entry.block.id)).toEqual([1]);
  });

  it("treats a block's end minute as already past", () => {
    const now = scheduleNow(day, 630);
    expect(now.current).toEqual([]);
    expect(now.next?.block.id).toBe(2);
    expect(now.untilNext).toBe(70);
    expect(now.remaining).toBeNull();
    expect(now.past.map((entry) => entry.block.id)).toEqual([1]);
  });

  it("returns the day's history latest-first once everything is done", () => {
    const now = scheduleNow(day, 950);
    expect(now.current).toEqual([]);
    expect(now.next).toBeNull();
    expect(now.untilNext).toBeNull();
    expect(now.remaining).toBeNull();
    expect(now.past.map((entry) => entry.block.id)).toEqual([3, 2, 1]);
  });

  it("has nothing behind it before the first block", () => {
    const now = scheduleNow(day, 550);
    expect(now.past).toEqual([]);
    expect(now.next?.block.id).toBe(1);
    expect(now.untilNext).toBe(50);
  });

  it("counts down to the earliest end when two blocks overlap the moment", () => {
    const overlapping = resolveDay(plan, [at(700, 60, { id: 1 }), at(705, 15, { id: 2 })]);
    const now = scheduleNow(overlapping, 710);
    expect(now.current.map((entry) => entry.block.id)).toEqual([1, 2]);
    expect(now.remaining).toBe(10);
  });
});

describe("notificationsDue", () => {
  const plan = planFor(REFERENCE);
  const day = resolveDay(plan, [
    at(600, 30, { id: 1, notify: true, notifyLeadMinutes: 10 }), // due 590
    at(610, 30, { id: 5, notify: true, notifyLeadMinutes: 60 }), // due 550
    at(700, 30, { id: 2, notify: true, notifyLeadMinutes: 0 }), // due 700
    at(800, 30, { id: 3, notify: false }),
    at(650, 30, { id: 4, notify: true, weekdayMask: WEEKEND_ONLY }),
  ]);

  it("subtracts the lead time and sorts by when the reminder fires", () => {
    expect(notificationsDue(day, 500, 700)).toEqual([
      expect.objectContaining({ at: 550 }),
      expect.objectContaining({ at: 590 }),
      expect.objectContaining({ at: 700 }),
    ]);
    expect(notificationsDue(day, 500, 700).map((due) => due.entry.block.id)).toEqual([5, 1, 2]);
  });

  it("excludes blocks that do not notify, and blocks that are off today", () => {
    const ids = notificationsDue(day, 0, 1440).map((due) => due.entry.block.id);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
  });

  it("takes `from` exclusive and `to` inclusive, so polling fires each reminder once", () => {
    expect(notificationsDue(day, 590, 700).map((due) => due.at)).toEqual([700]);
    expect(notificationsDue(day, 700, 800)).toEqual([]);
    expect(notificationsDue(day, 549, 590).map((due) => due.at)).toEqual([550, 590]);
  });
});

/* ------------------------------------------------------- the shipped timetables */

/** `plantBlocks` defaults a missing anchor to sunrise, so read the seeds the same way. */
function anchorOf(seed: RoutinePreset["blocks"][number]): string {
  return seed.anchor ?? "sunrise";
}

function seedsAnchoredTo(preset: RoutinePreset, anchor: string) {
  return preset.blocks.filter((seed) => anchorOf(seed) === anchor);
}

function lastEnd(seeds: readonly RoutinePreset["blocks"][number][]): number {
  return Math.max(...seeds.map((seed) => seed.offsetMinutes + seed.durationMinutes));
}

function firstStart(seeds: readonly RoutinePreset["blocks"][number][]): number {
  return Math.min(...seeds.map((seed) => seed.offsetMinutes));
}

describe("the four presets", () => {
  it("covers every declared id exactly once", () => {
    expect(ROUTINE_PRESETS.map((preset) => preset.id)).toEqual([...PRESET_IDS]);
  });

  it.each([...ROUTINE_PRESETS])("$id is described and wakes before sunrise", (preset) => {
    expect(preset.name.length).toBeGreaterThan(0);
    expect(preset.tagline.length).toBeGreaterThan(0);
    expect(preset.description.length).toBeGreaterThan(80);
    expect(preset.wakeOffsetMinutes).toBeLessThan(0);
    expect(preset.sleepTargetMinutes).toBeGreaterThanOrEqual(420);
    expect(preset.blocks.length).toBeGreaterThan(20);
  });

  it.each([...ROUTINE_PRESETS])("$id plants ids and order positionally", (preset) => {
    const blocks = presetBlocks(preset);
    expect(blocks.map((block) => block.id)).toEqual(
      preset.blocks.map((_seed, index) => index + 1),
    );
    expect(blocks.map((block) => block.sortOrder)).toEqual(
      preset.blocks.map((_seed, index) => index),
    );
    expect(blocks.every((block) => block.enabled)).toBe(true);
  });
});

/*
 * The three numbers the module comment promises. Each is a junction between two anchor
 * families, sized against the widest seasonal swing in scope  --  so if a future edit moves a
 * block past one of these, the year sweep below would start failing somewhere obscure, and
 * these three tests say plainly which invariant was broken.
 */
describe("the timetable invariants", () => {
  it.each([...ROUTINE_PRESETS])(
    "$id closes the morning junction within Guwahati's shortest sunrise→noon span",
    (preset) => {
      const morningEnd = lastEnd(seedsAnchoredTo(preset, "sunrise"));
      const middayStart = firstStart(seedsAnchoredTo(preset, "solarNoon"));
      // 315 minutes is Guwahati's minimum, at the December solstice.
      expect(morningEnd - middayStart).toBeLessThanOrEqual(315);
    },
  );

  it.each([...ROUTINE_PRESETS])("$id closes the afternoon junction at noon + 180 / bed − 300", (preset) => {
    expect(lastEnd(seedsAnchoredTo(preset, "solarNoon"))).toBe(180);
    expect(firstStart(seedsAnchoredTo(preset, "bedtime"))).toBe(-300);
  });

  it.each([...ROUTINE_PRESETS])("$id puts dinner at bed − 215 for 30 minutes", (preset) => {
    const dinner = preset.blocks.filter((seed) => seed.title.startsWith("Dinner"));
    expect(dinner).toHaveLength(1);
    expect(anchorOf(dinner[0])).toBe("bedtime");
    expect(dinner[0].offsetMinutes).toBe(-215);
    expect(dinner[0].durationMinutes).toBe(30);
  });

  it.each([...ROUTINE_PRESETS])("$id starts daylight within 30 minutes of sunrise", (preset) => {
    const dawn = seedsAnchoredTo(preset, "sunrise").filter((seed) => seed.category === "light");
    expect(dawn).toHaveLength(1);
    expect(Math.abs(dawn[0].offsetMinutes)).toBeLessThanOrEqual(30);

    // The rule lib/rules.ts applies: within 30 minutes of sunrise *or* within an hour of
    // waking, whichever is later. Traditional and Hardcore wake too early for the second
    // limb, which is why the rule is written as a disjunction.
    const withinSunrise = dawn[0].offsetMinutes <= 30;
    const withinWaking = dawn[0].offsetMinutes <= preset.wakeOffsetMinutes + 60;
    expect(withinSunrise || withinWaking).toBe(true);
  });

  it.each([...ROUTINE_PRESETS])("$id fills the movement slot exactly once a week", (preset) => {
    const slot = preset.blocks.filter(
      (seed) => anchorOf(seed) === "bedtime" && seed.offsetMinutes === -300,
    );
    expect(slot.length).toBeGreaterThan(0);
    const masks = slot.map((seed) => seed.weekdayMask ?? EVERY_DAY);
    for (const weekday of [0, 1, 2, 3, 4, 5, 6]) {
      // Exactly one: no day without a session, and no day with two booked on top of each other.
      expect(masks.filter((mask) => maskHas(mask, weekday))).toHaveLength(1);
    }
  });
});

/* ------------------------------------------------- the presets against real days */

/** What each preset resolves to at Hyderabad on the equinox, the date they were laid out on. */
const REFERENCE_DAY: Record<string, { wake: number; bedtime: number; scheduledMinutes: number }> = {
  traditional: { wake: 305, bedtime: 1295, scheduledMinutes: 722 },
  sandhya: { wake: 350, bedtime: 1325, scheduledMinutes: 673 },
  gentle: { wake: 335, bedtime: 1295, scheduledMinutes: 706 },
  hardcore: { wake: 320, bedtime: 1280, scheduledMinutes: 712 },
};

describe("the presets on the reference day", () => {
  it.each([...ROUTINE_PRESETS])("$id resolves to its published wake, bedtime and load", (preset) => {
    const plan = planFor(REFERENCE, HYDERABAD, preset);
    const day = resolveDay(plan, presetBlocks(preset));
    const expected = REFERENCE_DAY[preset.id];

    expect(day.anchors.sunrise).toBe(380); // 06:20
    expect(day.anchors.solarNoon).toBe(744); // 12:24
    expect(day.anchors.sunset).toBe(1107); // 18:27
    expect(day.anchors.wake).toBe(expected.wake);
    expect(day.anchors.bedtime).toBe(expected.bedtime);
    expect(day.scheduledMinutes).toBe(expected.scheduledMinutes);
    expect(day.overlaps).toEqual([]);
  });

  it.each([...ROUTINE_PRESETS])("$id keeps a block across Pratah Sandhya", (preset) => {
    const plan = planFor(REFERENCE, HYDERABAD, preset);
    const day = resolveDay(plan, presetBlocks(preset));
    // The midpoint of the last muhurta before sunrise. Which block holds it differs by
    // preset  --  the sit in three of them, the daylight walk in Sandhya  --  but it is never empty.
    const junction = day.anchors.sunrise - 24;
    const holding = day.entries.filter((e) => e.start <= junction && junction < e.end);
    expect(holding.length).toBeGreaterThan(0);
  });

  it.each([...ROUTINE_PRESETS])("$id finishes eating before lib/day.ts's own cutoff", (preset) => {
    const plan = planFor(REFERENCE, HYDERABAD, preset);
    const day = resolveDay(plan, presetBlocks(preset));
    const food = day.entries.filter((entry) => entry.block.category === "food");
    expect(food.length).toBeGreaterThan(0);
    // Not a hardcoded 185: the target comes from the same settings the rules engine reads, so
    // this fails if either side of the dinner-to-bed rule moves.
    expect(Math.max(...food.map((entry) => entry.end))).toBeLessThanOrEqual(plan.personal.lastFoodBy);
  });

  it.each([...ROUTINE_PRESETS])("$id is collision-free on all seven weekdays", (preset) => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
      toISODate(addDays(parseISODate("2026-03-15"), offset)),
    );
    const seen: number[] = [];
    for (const date of week) {
      const plan = planFor(date, HYDERABAD, preset);
      seen.push(plan.weekday);
      const day = resolveDay(plan, presetBlocks(preset));
      expect(day.overlaps, `${preset.id} ${date}: ${day.overlaps[0]?.message}`).toEqual([]);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]); // the fixture really is a whole week
  });
});

/*
 * The geographic claim, checked rather than asserted.
 *
 * Failures are collected instead of thrown one at a time, so a regression prints the city, the
 * date and the pair that collided rather than only the first day of January it trips on.
 */
describe("the presets across a whole year", () => {
  const YEAR = Array.from({ length: 365 }, (_unused, index) =>
    toISODate(addDays(parseISODate("2026-01-01"), index)),
  );

  function overlapsOver(place: Place): string[] {
    const failures: string[] = [];
    for (const preset of ROUTINE_PRESETS) {
      const blocks = presetBlocks(preset);
      for (const date of YEAR) {
        for (const clash of resolveDay(planFor(date, place, preset), blocks).overlaps) {
          failures.push(`${preset.id} ${date}: ${clash.message}`);
        }
      }
    }
    return failures;
  }

  it.each([
    ["Trivandrum, 8.5°N", TRIVANDRUM],
    ["Hyderabad, 17.4°N", HYDERABAD],
    ["Guwahati, 26.1°N", GUWAHATI],
  ])("is collision-free all year at %s", (_label, place) => {
    // Guard against a degenerate sweep silently checking one day 365 times.
    expect(new Set(YEAR).size).toBe(365);
    expect([YEAR[0], YEAR[364]]).toEqual(["2026-01-01", "2026-12-31"]);

    const failures = overlapsOver(place);
    expect(failures.slice(0, 5)).toEqual([]); // a readable diff before the count
    expect(failures).toHaveLength(0);
  });

  it("degrades into a reportable squeeze rather than a scrambled day further north", () => {
    // Srinagar at 34°N is outside the documented envelope: the seasonal swing outgrows the
    // slack at the morning junction in midwinter. What matters is that the failure stays small
    // enough for the Timeline to explain, which is what the module comment claims.
    const day = resolveDay(planFor("2026-12-21", SRINAGAR, ROUTINE_PRESETS[0]), presetBlocks(ROUTINE_PRESETS[0]));
    for (const clash of day.overlaps) expect(clash.minutes).toBeLessThan(30);
  });
});
