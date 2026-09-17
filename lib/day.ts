/**
 * The day plan: everything about one calendar day that does not depend on the user's
 * blocks or their logs.
 *
 * This is the join the rest of the app is built on  --  `solarDay` (where the sun is) plus
 * `muhurtaSet` (the traditional windows) plus the two personal anchors derived from
 * settings (wake and lights-out). Phase 2's block scheduler resolves block anchors
 * against exactly this object, and the Day Ring draws it.
 *
 * Two decisions worth stating:
 *
 *  - **Tonight's bedtime is derived from tomorrow's sunrise, not today's.** Bedtime is
 *    "the time to be asleep so that tomorrow's wake lands on target", so it has to look
 *    forward. `previousBedtime` is the backward-looking one, used to judge last night.
 *  - **All arithmetic happens in floats and is rounded once, at the end.** Rounding
 *    sunrise first and deriving from the rounded value drifts the muhurta windows by a
 *    minute, which then disagrees with what `/api/astro` reports.
 *
 * Pure: no DB, no React, no reading of the host clock except where a `now` is passed in.
 */

import { solarDay, type Location, type SolarDay } from "./astro";
import { doshaAt, doshaProgress, nextDoshaChange, type DoshaPeriod } from "./dosha";
import { muhurtaSet, windowContains, type MuhurtaMode, type Window } from "./muhurta";
import {
  addDays,
  type CalendarDate,
  MINUTES_PER_DAY,
  minuteOfDayInZone,
  calendarDateInZone,
  toISODate,
  weekdayOf,
} from "./time";

/* ------------------------------------------------------------------- input */

/**
 * The settings the day plan actually reads. Deliberately a plain shape rather than the
 * database row, so this module stays testable without a database and reusable on the
 * client.
 */
export type DayInput = {
  city: string;
  region: string;
  latitude: number;
  /** Positive east. */
  longitude: number;
  timeZone: string;
  muhurtaMode: MuhurtaMode;
  /** Wake as an offset from sunrise; negative is before it. */
  wakeOffsetMinutes: number;
  sleepTargetMinutes: number;
  caffeineCutoffHours: number;
  dinnerGapTargetMinutes: number;
};

/**
 * What the settings row ships with: Hyderabad, waking 75 minutes before sunrise on a 7¾-hour
 * night. Deliberately not one of the four presets  --  those set both numbers themselves the
 * moment one is chosen, and a default that matched one of them would read as a recommendation.
 */
export const DAY_INPUT_DEFAULTS: DayInput = {
  city: "Hyderabad",
  region: "Telangana",
  latitude: 17.385,
  longitude: 78.4867,
  timeZone: "Asia/Kolkata",
  muhurtaMode: "fixed",
  wakeOffsetMinutes: -75,
  sleepTargetMinutes: 465,
  caffeineCutoffHours: 8.5,
  dinnerGapTargetMinutes: 180,
};

/* ------------------------------------------------------------------ output */

export type LandmarkKind = "sun" | "muhurta" | "personal";

/** One tick on the Day Ring, and one line in the briefing. */
export type Landmark = {
  id: string;
  label: string;
  /** Minutes from local midnight. */
  minute: number;
  kind: LandmarkKind;
  /** One line of why it is on the dial at all. */
  detail: string;
};

export type SunSummary = {
  sunrise: number | null;
  sunset: number | null;
  solarNoon: number;
  civilDawn: number | null;
  civilDusk: number | null;
  dayLength: number | null;
  declination: number;
  /** The sun does not rise or does not set here today. */
  polar: boolean;
  /** True when the personal anchors had to fall back off solar noon. */
  estimated: boolean;
};

export type MuhurtaSummary = {
  mode: MuhurtaMode;
  brahma: Window | null;
  pratahSandhya: Window | null;
  abhijit: Window;
  sayamSandhya: Window | null;
  nightMuhurtaMinutes: number;
  dayMuhurtaMinutes: number;
};

export type PersonalSummary = {
  /** Sunrise plus the configured offset. */
  wake: number;
  /** Tonight's lights-out, on today's clock. */
  bedtime: number;
  /** Last night's lights-out, as a negative minute of today. */
  previousBedtime: number;
  sleepTargetMinutes: number;
  wakeOffsetMinutes: number;
  /** Latest caffeine that still clears before bed. */
  caffeineCutoff: number;
  /** Latest food that still leaves the target dinner-to-bed gap. */
  lastFoodBy: number;
};

export type DayPlan = {
  /** ISO calendar date, in the user's zone. */
  date: string;
  /** 0 = Sunday. */
  weekday: number;
  timeZone: string;
  tzOffsetMinutes: number;
  place: { city: string; region: string; latitude: number; longitude: number };
  sun: SunSummary;
  muhurta: MuhurtaSummary;
  personal: PersonalSummary;
  /** Ordered by time of day. */
  landmarks: Landmark[];
};

/* --------------------------------------------------------------- assembly */

export function locationOf(input: DayInput): Location {
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    timeZone: input.timeZone,
  };
}

const r = (n: number): number => Math.round(n);

function roundWindow(w: Window | null): Window | null {
  return w === null ? null : { start: r(w.start), end: r(w.end) };
}

/**
 * Sunrise, or the best stand-in when there isn't one.
 *
 * Inside a polar day or polar night the personal anchors still have to exist  --  a user in
 * Tromsø in June needs a wake time  --  so they fall back to civil dawn, then to six hours
 * before solar noon. `estimated` is surfaced so the interface can say so rather than
 * quietly inventing a sunrise.
 */
function sunriseReference(day: SolarDay): { minute: number; estimated: boolean } {
  if (day.sunrise !== null) return { minute: day.sunrise, estimated: false };
  if (day.civilDawn !== null) return { minute: day.civilDawn, estimated: true };
  return { minute: day.solarNoon - 360, estimated: true };
}

function landmarksOf(sun: SunSummary, muhurta: MuhurtaSummary, personal: PersonalSummary): Landmark[] {
  const out: Landmark[] = [];
  const push = (
    id: string,
    label: string,
    minute: number | null | undefined,
    kind: LandmarkKind,
    detail: string,
  ) => {
    if (minute === null || minute === undefined || !Number.isFinite(minute)) return;
    out.push({ id, label, minute: r(minute), kind, detail });
  };

  push(
    "brahma",
    "Brahma Muhurta",
    muhurta.brahma?.start,
    "muhurta",
    "The 14th muhurta of the night  --  the traditional window for waking, study and meditation.",
  );
  push("wake", "Wake", personal.wake, "personal", "Sunrise offset by your wake setting.");
  push("sunrise", "Sunrise", sun.sunrise, "sun", "Everything on this dial is anchored here.");
  push(
    "abhijit",
    "Abhijit Muhurta",
    muhurta.abhijit.start,
    "muhurta",
    "The auspicious midday window, centred on solar noon  --  and the cognitive peak.",
  );
  push("solar-noon", "Solar noon", sun.solarNoon, "sun", "The sun at its highest, not 12:00.");
  push("sunset", "Sunset", sun.sunset, "sun", "Start of Sayam Sandhya, the evening junction.");
  push(
    "last-food",
    "Last food by",
    personal.lastFoodBy,
    "personal",
    "Keeps your target gap between the last meal and lights out.",
  );
  push("bedtime", "Lights out", personal.bedtime, "personal", "Set back from tomorrow's wake by your sleep target.");

  return out.sort((a, b) => a.minute - b.minute);
}

/** The core assembler. Neighbouring solar days are passed in so batches compute each once. */
function assemble(
  date: CalendarDate,
  input: DayInput,
  today: SolarDay,
  previous: SolarDay | null,
  tomorrow: SolarDay | null,
): DayPlan {
  const set = muhurtaSet(today, previous, input.muhurtaMode);
  const reference = sunriseReference(today);

  const wake = reference.minute + input.wakeOffsetMinutes;
  // Tonight's bedtime looks forward to tomorrow's wake, expressed on today's clock.
  const tomorrowWake =
    (tomorrow ? sunriseReference(tomorrow).minute : reference.minute) +
    input.wakeOffsetMinutes +
    MINUTES_PER_DAY;
  const bedtime = tomorrowWake - input.sleepTargetMinutes;

  const sun: SunSummary = {
    sunrise: today.sunrise === null ? null : r(today.sunrise),
    sunset: today.sunset === null ? null : r(today.sunset),
    solarNoon: r(today.solarNoon),
    civilDawn: today.civilDawn === null ? null : r(today.civilDawn),
    civilDusk: today.civilDusk === null ? null : r(today.civilDusk),
    dayLength: today.dayLength === null ? null : r(today.dayLength),
    declination: Number(today.declination.toFixed(4)),
    polar: today.polar,
    estimated: reference.estimated,
  };

  const muhurta: MuhurtaSummary = {
    mode: set.mode,
    brahma: roundWindow(set.brahma),
    pratahSandhya: roundWindow(set.pratahSandhya),
    abhijit: roundWindow(set.abhijit)!,
    sayamSandhya: roundWindow(set.sayamSandhya),
    nightMuhurtaMinutes: r(set.nightMuhurtaMinutes),
    dayMuhurtaMinutes: r(set.dayMuhurtaMinutes),
  };

  const personal: PersonalSummary = {
    wake: r(wake),
    bedtime: r(bedtime),
    previousBedtime: r(wake - input.sleepTargetMinutes),
    sleepTargetMinutes: input.sleepTargetMinutes,
    wakeOffsetMinutes: input.wakeOffsetMinutes,
    caffeineCutoff: r(bedtime - input.caffeineCutoffHours * 60),
    lastFoodBy: r(bedtime - input.dinnerGapTargetMinutes),
  };

  return {
    date: toISODate(date),
    weekday: weekdayOf(date),
    timeZone: input.timeZone,
    tzOffsetMinutes: today.tzOffsetMinutes,
    place: {
      city: input.city,
      region: input.region,
      latitude: input.latitude,
      longitude: input.longitude,
    },
    sun,
    muhurta,
    personal,
    landmarks: landmarksOf(sun, muhurta, personal),
  };
}

/* ------------------------------------------------------------ public entry */

/** One day. Computes yesterday and tomorrow too, because the plan needs both. */
export function buildDayPlan(date: CalendarDate, input: DayInput): DayPlan {
  const location = locationOf(input);
  return assemble(
    date,
    input,
    solarDay(date, location),
    solarDay(addDays(date, -1), location),
    solarDay(addDays(date, 1), location),
  );
}

/**
 * `count` consecutive days starting at `start`.
 *
 * Each date's solar day is computed once and shared with its neighbours, so a 90-day
 * request costs 92 solar computations rather than 270.
 */
export function buildDayPlans(start: CalendarDate, count: number, input: DayInput): DayPlan[] {
  const location = locationOf(input);
  const n = Math.max(1, Math.floor(count));
  const dates: CalendarDate[] = [];
  for (let i = -1; i <= n; i += 1) dates.push(addDays(start, i));
  const solar = dates.map((d) => solarDay(d, location));

  const out: DayPlan[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push(assemble(dates[i], input, solar[i], solar[i - 1], solar[i + 1] ?? null));
  }
  return out;
}

/* --------------------------------------------------------------- the moment */

/** Which of the plan's named windows a moment falls inside. */
export type ActiveWindow = "brahma" | "pratahSandhya" | "abhijit" | "sayamSandhya";

export type NowState = {
  /** The user's calendar date at this instant, which may differ from the plan's. */
  date: string;
  /** Minutes from local midnight, including seconds. */
  minute: number;
  period: DoshaPeriod;
  /** 0-1 through the current dosha period. */
  progress: number;
  next: DoshaPeriod;
  nextInMinutes: number;
  inWindows: ActiveWindow[];
  /** Minutes until the next landmark, and which one. Null after the last of the day. */
  upcoming: { landmark: Landmark; inMinutes: number } | null;
};

/**
 * Where the user is in the day, right now.
 *
 * Kept out of `DayPlan` on purpose: the plan is cacheable per location and date, while
 * this changes every minute and is recomputed on the client from a ticking clock.
 */
export function nowState(plan: DayPlan, now: Date = new Date()): NowState {
  const minute = minuteOfDayInZone(now, plan.timeZone);
  const period = doshaAt(minute);
  const change = nextDoshaChange(minute);

  const inWindows: ActiveWindow[] = [];
  const test = (id: ActiveWindow, w: Window | null) => {
    if (w && windowContains(w, minute)) inWindows.push(id);
  };
  test("brahma", plan.muhurta.brahma);
  test("pratahSandhya", plan.muhurta.pratahSandhya);
  test("abhijit", plan.muhurta.abhijit);
  test("sayamSandhya", plan.muhurta.sayamSandhya);

  const next = plan.landmarks.find((l) => l.minute > minute) ?? null;

  return {
    date: toISODate(calendarDateInZone(now, plan.timeZone)),
    minute,
    period,
    progress: doshaProgress(minute),
    next: change.next,
    nextInMinutes: change.inMinutes,
    inWindows,
    upcoming: next ? { landmark: next, inMinutes: next.minute - minute } : null,
  };
}
