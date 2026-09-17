/**
 * Timezone-explicit date/time primitives.
 *
 * Every scheduling decision in Sadhana is made in the *user's* timezone, never the
 * server's, so nothing here reads the host offset. A "day" is a `CalendarDate`, and a
 * time inside that day is an integer count of minutes from local midnight (which may be
 * negative for pre-midnight events such as Brahma Muhurta on an early sunrise, or exceed
 * 1440 for a bedtime after midnight).
 *
 * Pure: no React, no DB, no I/O. Directly unit-testable.
 */

export type CalendarDate = {
  /** Full year, e.g. 2026 */
  year: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
};

export const MINUTES_PER_DAY = 1440;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** True when the IANA zone id is one this runtime understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone).format(new Date());
    return true;
  } catch {
    return false;
  }
}

type ZonedParts = CalendarDate & { hour: number; minute: number; second: number };

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

/**
 * Offset of `timeZone` from UTC, in minutes, at the given instant.
 * East of Greenwich is positive: Asia/Kolkata is +330.
 */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asIfUtc - truncated) / 60_000);
}

/**
 * The offset in force on a given local calendar day, sampled at local noon.
 *
 * Sampling at noon rather than midnight keeps the answer stable across DST
 * transitions, which always land near midnight or in the small hours.
 */
export function tzOffsetForDate(date: CalendarDate, timeZone: string): number {
  const noonGuess = new Date(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0));
  const first = tzOffsetMinutes(noonGuess, timeZone);
  const corrected = new Date(noonGuess.getTime() - first * 60_000);
  return tzOffsetMinutes(corrected, timeZone);
}

/** The calendar date it currently is in `timeZone`. */
export function calendarDateInZone(instant: Date, timeZone: string): CalendarDate {
  const { year, month, day } = zonedParts(instant, timeZone);
  return { year, month, day };
}

/** Minutes elapsed since local midnight in `timeZone`, as a float (seconds included). */
export function minuteOfDayInZone(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute + p.second / 60;
}

/**
 * Convert a local wall-clock time to an absolute instant.
 * `minuteOfDay` may fall outside 0-1440; it simply rolls into the neighbouring day.
 */
export function zonedToInstant(
  date: CalendarDate,
  minuteOfDay: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(date.year, date.month - 1, date.day) + Math.round(minuteOfDay * 60_000);
  const firstPass = new Date(naive - tzOffsetMinutes(new Date(naive), timeZone) * 60_000);
  return new Date(naive - tzOffsetMinutes(firstPass, timeZone) * 60_000);
}

export function toISODate(date: CalendarDate): string {
  const mm = String(date.month).padStart(2, "0");
  const dd = String(date.day).padStart(2, "0");
  return `${date.year}-${mm}-${dd}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const date = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  return toISODate(normalizeDate(date)) === value;
}

export function parseISODate(value: string): CalendarDate {
  const m = ISO_DATE.exec(value);
  if (!m) throw new Error(`Not an ISO date (YYYY-MM-DD): ${value}`);
  return normalizeDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
}

/** Rolls out-of-range months/days into a real date (so month 13 becomes January). */
export function normalizeDate(date: CalendarDate): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return normalizeDate({ ...date, day: date.day + days });
}

export function datesEqual(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** 0 = Sunday through 6 = Saturday. */
export function weekdayOf(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function todayInZone(timeZone: string, now: Date = new Date()): CalendarDate {
  return calendarDateInZone(now, timeZone);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  const ms =
    Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86_400_000);
}

/** Wraps any minute value into 0-1439. */
export function wrapMinute(minute: number): number {
  return ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export type ClockOptions = {
  /** 24-hour clock instead of am/pm. */
  hour24?: boolean;
  /** Render "am"/"pm" lowercase and unspaced, e.g. "4:45am". */
  compact?: boolean;
};

/** Format minutes-from-midnight as a clock time. Handles values outside 0-1440. */
export function formatClock(minute: number, options: ClockOptions = {}): string {
  const total = wrapMinute(Math.round(minute));
  const h24 = Math.floor(total / 60);
  const mm = String(total % 60).padStart(2, "0");
  if (options.hour24) return `${String(h24).padStart(2, "0")}:${mm}`;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return options.compact
    ? `${h12}:${mm}${suffix.toLowerCase()}`
    : `${h12}:${mm} ${suffix}`;
}

/** Format a span of minutes as "1h 20m" / "45m" / "20s". */
export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded <= 0) return `${Math.max(0, Math.round(minutes * 60))}s`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a signed gap, e.g. "+2h 10m" / "−35m". */
export function formatSignedDuration(minutes: number): string {
  const sign = minutes < 0 ? "−" : "+";
  return `${sign}${formatDuration(Math.abs(minutes))}`;
}

/**
 * A calendar date as prose: "Saturday, 5 September".
 *
 * Formatted in UTC deliberately. The input is a bare calendar date with no instant attached,
 * so interpreting it in a zone west of UTC would render the previous day.
 */
export function formatLongDate(
  date: CalendarDate,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
  locale = "en-IN",
): string {
  const instant = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(instant);
}
