/**
 * The block engine: anchored intentions resolved into today's actual clock times.
 *
 * A block stores an *offset from an anchor*  --  "30 minutes after sunrise", "45 before lights
 * out"  --  never a clock time. That is most of the reason this app is worth running: change
 * city, wait for the season to turn, or move the wake target, and every block re-times
 * itself correctly, forever, with nothing to edit.
 *
 * Two conventions carried over from `lib/day.ts`, and they both matter:
 *
 *  - **Minutes are a continuous line, not a 24-hour dial.** A block resolved before midnight
 *    is negative; one after midnight exceeds 1440. Nothing is wrapped here, because wrapping
 *    is exactly what loses the difference between "Brahma Muhurta at 3:20 this morning" and
 *    "3:20 tomorrow morning". `formatClock` wraps at the point of display, which is the only
 *    place a dial is the right model.
 *  - **Anchors arrive from the plan already on that line.** So resolving a block is addition,
 *    and putting the day in order is a numeric sort.
 *
 * With five independent anchors, no fixed set of offsets can be collision-free at every
 * latitude and season  --  a preset that reads cleanly in Hyderabad in March can have dinner
 * meet the evening junction in Guwahati in December. That is why overlaps are *detected*
 * here and surfaced in the Timeline rather than assumed away.
 *
 * Pure: no DB, no React, no reading of the host clock.
 */

import type { DayPlan } from "./day";
import { MINUTES_PER_DAY } from "./time";

/* ------------------------------------------------------------------ vocabulary */

export const BLOCK_CATEGORIES = [
  "sleep",
  "hygiene",
  "practice",
  "movement",
  "training",
  "light",
  "food",
  "work",
  "admin",
  "social",
  "winddown",
  "mindgym",
] as const;

export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

export const BLOCK_ANCHORS = [
  "sunrise",
  "sunset",
  "solarNoon",
  "brahmaMuhurta",
  "wake",
  "bedtime",
  "clock",
] as const;

export type BlockAnchor = (typeof BLOCK_ANCHORS)[number];

export const BLOCK_FUELS = ["empty", "light", "fed", "any"] as const;

export type BlockFuel = (typeof BLOCK_FUELS)[number];

/**
 * The icon vocabulary a block may name; the paths live in `components/blocks/block-icon.tsx`.
 *
 * Stored as free text in the database rather than a constrained column, and rendered with a
 * fallback, so adding a name here later is not a migration.
 */
export const BLOCK_ICONS = [
  "dot",
  "sun",
  "moon",
  "droplet",
  "lotus",
  "wind",
  "walk",
  "dumbbell",
  "bowl",
  "cup",
  "monitor",
  "people",
  "brain",
  "book",
  "oil",
  "bell",
] as const;

export type BlockIcon = (typeof BLOCK_ICONS)[number];

export type Described = { label: string; blurb: string };

export const CATEGORY_META: Record<BlockCategory, Described> = {
  sleep: { label: "Sleep", blurb: "Waking, lights out, and naps." },
  hygiene: { label: "Care", blurb: "Oral, nasal, skin, oil  --  the short things that compound." },
  practice: { label: "Practice", blurb: "Sitting, breath, mantra, nidra." },
  movement: { label: "Movement", blurb: "Mobility, asana, easy walking." },
  training: { label: "Training", blurb: "Strength and conditioning, where load is the point." },
  light: { label: "Light", blurb: "Daylight on the retina  --  the highest-return lever there is." },
  food: { label: "Food", blurb: "Meals, and the timing that decides what they cost." },
  work: { label: "Deep work", blurb: "The hard thing, protected." },
  admin: { label: "Admin", blurb: "Shallow work, errands, correspondence." },
  social: { label: "People", blurb: "Family, friends, obligation." },
  winddown: { label: "Wind-down", blurb: "The hour that decides how tomorrow starts." },
  mindgym: { label: "Mind Gym", blurb: "Measured cognitive tasks, not games for their own sake." },
};

export const ANCHOR_META: Record<BlockAnchor, Described> = {
  sunrise: { label: "Sunrise", blurb: "Moves with your latitude and the season." },
  sunset: { label: "Sunset", blurb: "The evening junction, Sayam Sandhya." },
  solarNoon: { label: "Solar noon", blurb: "The sun at its highest  --  not 12:00." },
  brahmaMuhurta: { label: "Brahma Muhurta", blurb: "The start of the traditional waking window." },
  wake: { label: "Wake", blurb: "Your own wake target, itself derived from sunrise." },
  bedtime: { label: "Lights out", blurb: "Counted backwards from tomorrow's wake." },
  clock: { label: "Fixed clock", blurb: "A wall-clock time that never moves. Use sparingly." },
};

export const FUEL_META: Record<BlockFuel, Described> = {
  empty: {
    label: "Empty stomach",
    blurb: "Nothing solid for at least three hours. Forceful breathwork and inversions require it.",
  },
  light: {
    label: "Lightly fuelled",
    blurb: "A banana or three dates, twenty minutes before. Not almonds  --  fat slows the stomach.",
  },
  fed: {
    label: "Fed",
    blurb: "A real meal, ninety minutes to three hours earlier. Heavy lifting belongs here.",
  },
  any: { label: "Either", blurb: "Fuel does not change this one." },
};

/* ----------------------------------------------------------------- the block */

/**
 * A block as the engine sees it: the scheduling fields of the database row and nothing
 * else. `lib/blocks.ts` maps rows onto this, which is what keeps this module free of
 * Drizzle and therefore usable in the browser and in a unit test.
 */
export type ScheduleBlock = {
  id: number;
  title: string;
  detail: string;
  category: BlockCategory;
  anchor: BlockAnchor;
  /** Minutes from the anchor; negative is before it. For `clock`, minutes from midnight. */
  offsetMinutes: number;
  durationMinutes: number;
  fuel: BlockFuel;
  /** Bit 0 = Sunday through bit 6 = Saturday. 127 is every day. */
  weekdayMask: number;
  notify: boolean;
  notifyLeadMinutes: number;
  sortOrder: number;
  icon: string;
  /** Evidence card ids, resolved by the Science view. */
  scienceIds: string[];
  href: string | null;
  enabled: boolean;
};

/* -------------------------------------------------------------- weekday mask */

export const EVERY_DAY = 0b1111111;
export const WEEKDAYS_ONLY = 0b0111110;
export const WEEKEND_ONLY = 0b1000001;

/** Sunday first, matching `weekdayOf` and bit 0. */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function maskHas(mask: number, weekday: number): boolean {
  return ((mask >> weekday) & 1) === 1;
}

export function maskToggle(mask: number, weekday: number): number {
  return (mask ^ (1 << weekday)) & EVERY_DAY;
}

export function maskOf(weekdays: readonly number[]): number {
  return weekdays.reduce((mask, day) => mask | (1 << day), 0) & EVERY_DAY;
}

export function maskDays(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((day) => maskHas(mask, day));
}

/**
 * The mask in words: "Every day", "Weekdays", "Mon, Wed, Fri".
 *
 * Named shorthands first because they are what a schedule is usually made of, and reading
 * "Weekdays" is faster than parsing five abbreviations.
 */
export function describeMask(mask: number): string {
  const normalised = mask & EVERY_DAY;
  if (normalised === EVERY_DAY) return "Every day";
  if (normalised === 0) return "Never";
  if (normalised === WEEKDAYS_ONLY) return "Weekdays";
  if (normalised === WEEKEND_ONLY) return "Weekends";
  const days = maskDays(normalised).map((day) => WEEKDAY_LABELS[day]);
  return days.length === 6 ? `Every day except ${missingDay(normalised)}` : days.join(", ");
}

function missingDay(mask: number): string {
  const absent = [0, 1, 2, 3, 4, 5, 6].find((day) => !maskHas(mask, day)) ?? 0;
  return WEEKDAY_LABELS[absent];
}

/* ---------------------------------------------------------------- the anchors */

/** Every anchor a block can hang from, apart from `clock`, which needs no lookup. */
export type AnchorTable = Record<Exclude<BlockAnchor, "clock">, number>;

/**
 * The anchor values for one day.
 *
 * `sunrise` is recovered from the personal anchors rather than read from `sun.sunrise`,
 * because inside a polar day the latter is null while blocks still have to land somewhere.
 * `lib/day.ts` has already chosen the stand-in (civil dawn, then six hours before solar
 * noon) and folded it into `wake`; subtracting the offset back out reuses that one decision
 * instead of making a second, differently-wrong one here.
 */
export function anchorsOf(plan: DayPlan): AnchorTable {
  const sunrise = plan.personal.wake - plan.personal.wakeOffsetMinutes;
  return {
    sunrise,
    sunset: plan.sun.sunset ?? plan.sun.civilDusk ?? plan.sun.solarNoon + 360,
    solarNoon: plan.sun.solarNoon,
    brahmaMuhurta: plan.muhurta.brahma?.start ?? sunrise - 96,
    wake: plan.personal.wake,
    bedtime: plan.personal.bedtime,
  };
}

export function resolveAnchor(
  anchors: AnchorTable,
  anchor: BlockAnchor,
  offsetMinutes: number,
): number {
  return anchor === "clock" ? offsetMinutes : anchors[anchor] + offsetMinutes;
}

/** The rule in words: "Sunrise + 30m", "Lights out − 45m", "6:30 AM, fixed". */
export function describeOffset(
  anchor: BlockAnchor,
  offsetMinutes: number,
  formatClock: (minute: number) => string,
): string {
  if (anchor === "clock") return `${formatClock(offsetMinutes)}, fixed`;
  const label = ANCHOR_META[anchor].label;
  if (offsetMinutes === 0) return label;
  const sign = offsetMinutes < 0 ? "−" : "+";
  const size = Math.abs(offsetMinutes);
  const hours = Math.floor(size / 60);
  const minutes = size % 60;
  const span = hours === 0 ? `${minutes}m` : minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  return `${label} ${sign} ${span}`;
}

/* --------------------------------------------------------------- resolve a day */

export type ResolvedBlock = {
  block: ScheduleBlock;
  /** Minutes from local midnight. May be negative, or exceed 1440. */
  start: number;
  end: number;
  /** What the anchor itself resolved to, so the interface can explain the arithmetic. */
  anchorMinute: number;
  /** False when the block is on the routine but not on today's weekday mask. */
  today: boolean;
};

export type ConflictKind = "overlap" | "gap";

export type Conflict = {
  kind: ConflictKind;
  /** The two blocks involved: the pair that overlaps, or the pair a gap sits between. */
  blockIds: [number, number];
  /** Minutes of overlap, or minutes of unscheduled time. */
  minutes: number;
  message: string;
};

export type ResolvedDay = {
  /** ISO date, from the plan. */
  date: string;
  /** 0 = Sunday. */
  weekday: number;
  anchors: AnchorTable;
  /** Today's blocks only, ordered by start then by the routine's own order. */
  entries: ResolvedBlock[];
  /** Blocks on the routine that today's weekday mask excludes. Unordered. */
  offToday: ResolvedBlock[];
  overlaps: Conflict[];
  /** Unscheduled stretches between wake and lights out longer than `gapThreshold`. */
  gaps: Conflict[];
  /** Total scheduled minutes today, overlaps counted once. */
  scheduledMinutes: number;
};

export type ResolveOptions = {
  /** Blocks marked disabled are dropped entirely unless this is set. */
  includeDisabled?: boolean;
  /** An unscheduled waking stretch at least this long is reported. Default 90. */
  gapThreshold?: number;
};

const DEFAULT_GAP_THRESHOLD = 90;

/**
 * The whole point of the module: anchored blocks become a concrete, ordered, checked day.
 *
 * Ties break on `sortOrder` rather than id so that two blocks starting on the same minute  -- 
 * a wake block and the glass of water after it, when someone sets both to `wake + 0`  --  read
 * in the order the routine intends rather than the order they happened to be written.
 */
export function resolveDay(
  plan: DayPlan,
  blocks: readonly ScheduleBlock[],
  options: ResolveOptions = {},
): ResolvedDay {
  const anchors = anchorsOf(plan);
  const threshold = options.gapThreshold ?? DEFAULT_GAP_THRESHOLD;

  const resolved = blocks
    .filter((block) => block.enabled || options.includeDisabled === true)
    .map<ResolvedBlock>((block) => {
      const anchorMinute = block.anchor === "clock" ? 0 : anchors[block.anchor];
      const start = resolveAnchor(anchors, block.anchor, block.offsetMinutes);
      return {
        block,
        start,
        end: start + Math.max(0, block.durationMinutes),
        anchorMinute,
        today: maskHas(block.weekdayMask, plan.weekday),
      };
    });

  const entries = resolved
    .filter((entry) => entry.today)
    .sort((a, b) => a.start - b.start || a.block.sortOrder - b.block.sortOrder);

  return {
    date: plan.date,
    weekday: plan.weekday,
    anchors,
    entries,
    offToday: resolved.filter((entry) => !entry.today),
    overlaps: findOverlaps(entries),
    gaps: findGaps(entries, anchors, threshold),
    scheduledMinutes: unionMinutes(entries),
  };
}

/**
 * Every pair that genuinely collides, not just neighbours.
 *
 * A long block  --  a three-hour work stretch  --  can swallow two short ones that do not touch
 * each other, and reporting only adjacent pairs would miss the second. The list is short
 * enough that the quadratic scan costs nothing.
 */
function findOverlaps(entries: readonly ResolvedBlock[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      // Sorted by start, so once b begins after a ends nothing later can overlap a either.
      if (b.start >= a.end) break;
      const minutes = Math.min(a.end, b.end) - b.start;
      if (minutes <= 0) continue;
      out.push({
        kind: "overlap",
        blockIds: [a.block.id, b.block.id],
        minutes,
        message: `“${a.block.title}” and “${b.block.title}” overlap by ${minutes} minutes.`,
      });
    }
  }
  return out;
}

/**
 * Unscheduled stretches of waking time.
 *
 * Only between wake and lights out: the hours you are asleep are not a hole in the plan.
 * Block id `0` stands for the day's own edges, so a gap right after waking or right before
 * lights out still names both of its sides.
 */
function findGaps(
  entries: readonly ResolvedBlock[],
  anchors: AnchorTable,
  threshold: number,
): Conflict[] {
  const out: Conflict[] = [];
  const dayStart = anchors.wake;
  const dayEnd = anchors.bedtime;
  if (dayEnd <= dayStart) return out;

  let reach = dayStart;
  let previous = { id: 0, title: "waking" };

  const add = (from: { id: number; title: string }, to: { id: number; title: string }, at: number) => {
    const minutes = Math.round(at - reach);
    if (minutes < threshold) return;
    out.push({
      kind: "gap",
      blockIds: [from.id, to.id],
      minutes,
      message: `${formatGap(minutes)} unscheduled between ${from.title} and ${to.title}.`,
    });
  };

  for (const entry of entries) {
    if (entry.end <= dayStart) continue;
    if (entry.start >= dayEnd) break;
    add(previous, { id: entry.block.id, title: `“${entry.block.title}”` }, entry.start);
    if (entry.end > reach) {
      reach = entry.end;
      previous = { id: entry.block.id, title: `“${entry.block.title}”` };
    }
  }
  add(previous, { id: 0, title: "lights out" }, dayEnd);
  return out;
}

function formatGap(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} minutes`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Total minutes covered, counting overlapping stretches once. */
function unionMinutes(entries: readonly ResolvedBlock[]): number {
  let total = 0;
  let reach = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const from = Math.max(entry.start, reach);
    if (entry.end > from) {
      total += entry.end - from;
      reach = entry.end;
    }
  }
  return Math.round(total);
}

/* ------------------------------------------------------------------ the moment */

/**
 * A wall-clock reading placed on the same continuous line the day's entries live on.
 *
 * One day's entries can span roughly −120 to 1560, so a bare 0–1440 reading is genuinely
 * ambiguous: 00:30 is either the tail of tonight's wind-down (1470) or a pre-dawn sit that
 * has not happened yet (30). Choose the phase that lands inside the day's own span, and
 * failing that the one closest to it.
 */
export function alignMinute(day: ResolvedDay, minute: number): number {
  const first = day.entries[0];
  const from = Math.min(day.anchors.wake, first ? first.start : day.anchors.wake);
  const to = Math.max(
    day.anchors.bedtime,
    day.entries.reduce((max, entry) => Math.max(max, entry.end), day.anchors.bedtime),
  );

  const candidates = [minute, minute + MINUTES_PER_DAY, minute - MINUTES_PER_DAY];
  const inside = candidates.find((value) => value >= from && value <= to);
  if (inside !== undefined) return inside;

  const middle = (from + to) / 2;
  return candidates.reduce((best, value) =>
    Math.abs(value - middle) < Math.abs(best - middle) ? value : best,
  );
}

export type ScheduleNow = {
  /** The aligned minute the rest of these fields were computed against. */
  minute: number;
  /** Blocks containing the moment. Usually one; more than one is an overlap. */
  current: ResolvedBlock[];
  next: ResolvedBlock | null;
  /** Minutes until `next` begins. */
  untilNext: number | null;
  /** Minutes left of the current block  --  the one ending soonest, if several. */
  remaining: number | null;
  /** Blocks whose end has passed, latest first. */
  past: ResolvedBlock[];
};

/** Where in the schedule a moment falls. Recomputed on every clock tick, so kept cheap. */
export function scheduleNow(day: ResolvedDay, rawMinute: number): ScheduleNow {
  const minute = alignMinute(day, rawMinute);
  const current = day.entries.filter((entry) => entry.start <= minute && minute < entry.end);
  const next = day.entries.find((entry) => entry.start > minute) ?? null;
  const soonestEnd = current.reduce(
    (soonest, entry) => (soonest === null ? entry.end : Math.min(soonest, entry.end)),
    null as number | null,
  );

  return {
    minute,
    current,
    next,
    untilNext: next === null ? null : Math.round(next.start - minute),
    remaining: soonestEnd === null ? null : Math.round(soonestEnd - minute),
    past: day.entries.filter((entry) => entry.end <= minute).reverse(),
  };
}

/**
 * Blocks due to notify, for a window of the day.
 *
 * Used by the push scheduler in the last phase and by the Today view to say what is about to
 * start. `from` is exclusive and `to` inclusive so that polling on a fixed interval fires
 * each reminder exactly once.
 */
export function notificationsDue(
  day: ResolvedDay,
  from: number,
  to: number,
): { entry: ResolvedBlock; at: number }[] {
  return day.entries
    .filter((entry) => entry.block.notify)
    .map((entry) => ({ entry, at: entry.start - entry.block.notifyLeadMinutes }))
    .filter((due) => due.at > from && due.at <= to)
    .sort((a, b) => a.at - b.at);
}
