import { describe, expect, it } from "vitest";

import {
  addDays,
  calendarDateInZone,
  datesEqual,
  daysBetween,
  formatClock,
  formatDuration,
  formatSignedDuration,
  isISODate,
  isValidTimeZone,
  MINUTES_PER_DAY,
  minuteOfDayInZone,
  normalizeDate,
  parseISODate,
  toISODate,
  todayInZone,
  tzOffsetForDate,
  tzOffsetMinutes,
  weekdayOf,
  wrapMinute,
  zonedToInstant,
} from "@/lib/time";

const KOLKATA = "Asia/Kolkata";
const LONDON = "Europe/London";
const NEW_YORK = "America/New_York";

describe("isValidTimeZone", () => {
  it("accepts real IANA zones and rejects invented ones", () => {
    expect(isValidTimeZone(KOLKATA)).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("tzOffsetMinutes", () => {
  it("is positive east of Greenwich and handles half-hour zones", () => {
    const jan = new Date("2026-01-15T12:00:00Z");
    expect(tzOffsetMinutes(jan, KOLKATA)).toBe(330);
    expect(tzOffsetMinutes(jan, "UTC")).toBe(0);
    expect(tzOffsetMinutes(jan, NEW_YORK)).toBe(-300);
  });

  it("follows northern-hemisphere DST", () => {
    const jul = new Date("2026-07-15T12:00:00Z");
    expect(tzOffsetMinutes(jul, LONDON)).toBe(60);
    expect(tzOffsetMinutes(jul, NEW_YORK)).toBe(-240);
    // India does not observe DST, so it is the same all year.
    expect(tzOffsetMinutes(jul, KOLKATA)).toBe(330);
  });
});

describe("tzOffsetForDate", () => {
  it("never shifts for Asia/Kolkata", () => {
    for (const date of ["2026-01-01", "2026-03-29", "2026-06-21", "2026-10-25"]) {
      expect(tzOffsetForDate(parseISODate(date), KOLKATA)).toBe(330);
    }
  });

  it("finds the BST start boundary on the right day", () => {
    // BST begins on the last Sunday in March, which is the 29th in 2026.
    expect(tzOffsetForDate(parseISODate("2026-03-28"), LONDON)).toBe(0);
    expect(tzOffsetForDate(parseISODate("2026-03-29"), LONDON)).toBe(60);
    expect(tzOffsetForDate(parseISODate("2026-03-30"), LONDON)).toBe(60);
  });

  it("finds the BST end boundary on the right day", () => {
    // BST ends on the last Sunday in October, the 25th in 2026. Sampling at local
    // noon is what keeps the answer stable on the transition day itself.
    expect(tzOffsetForDate(parseISODate("2026-10-24"), LONDON)).toBe(60);
    expect(tzOffsetForDate(parseISODate("2026-10-25"), LONDON)).toBe(0);
    expect(tzOffsetForDate(parseISODate("2026-10-26"), LONDON)).toBe(0);
  });
});

describe("calendarDateInZone and minuteOfDayInZone", () => {
  it("reads the local calendar day, not the UTC one", () => {
    // 20:00 UTC is already tomorrow in India.
    const instant = new Date("2026-09-05T20:00:00Z");
    expect(toISODate(calendarDateInZone(instant, KOLKATA))).toBe("2026-09-06");
    expect(toISODate(calendarDateInZone(instant, "UTC"))).toBe("2026-09-05");
    expect(minuteOfDayInZone(instant, KOLKATA)).toBe(90);
    expect(minuteOfDayInZone(instant, "UTC")).toBe(1200);
  });

  it("includes seconds as a fraction of a minute", () => {
    expect(minuteOfDayInZone(new Date("2026-09-05T00:00:30Z"), "UTC")).toBeCloseTo(0.5, 9);
  });

  it("agrees with todayInZone for the same instant", () => {
    const now = new Date("2026-09-05T20:00:00Z");
    expect(datesEqual(todayInZone(KOLKATA, now), calendarDateInZone(now, KOLKATA))).toBe(true);
  });
});

describe("zonedToInstant", () => {
  it("converts a local wall clock to the right absolute instant", () => {
    expect(zonedToInstant(parseISODate("2026-09-05"), 345, KOLKATA).toISOString()).toBe(
      "2026-09-05T00:15:00.000Z",
    );
    // 04:43 BST on the June solstice is 03:43 UTC.
    expect(zonedToInstant(parseISODate("2026-06-21"), 283, LONDON).toISOString()).toBe(
      "2026-06-21T03:43:00.000Z",
    );
  });

  it("rolls minutes outside 0-1440 into the neighbouring day", () => {
    const after = zonedToInstant(parseISODate("2026-09-05"), MINUTES_PER_DAY + 30, KOLKATA);
    expect(toISODate(calendarDateInZone(after, KOLKATA))).toBe("2026-09-06");
    expect(minuteOfDayInZone(after, KOLKATA)).toBe(30);

    const before = zonedToInstant(parseISODate("2026-09-05"), -60, KOLKATA);
    expect(toISODate(calendarDateInZone(before, KOLKATA))).toBe("2026-09-04");
    expect(minuteOfDayInZone(before, KOLKATA)).toBe(1380);
  });
});

describe("zonedToInstant across DST", () => {
  it("round-trips a valid local time on both transition days", () => {
    // 03:00 BST on the spring-forward day is 02:00 UTC.
    const spring = zonedToInstant(parseISODate("2026-03-29"), 180, LONDON);
    expect(spring.toISOString()).toBe("2026-03-29T02:00:00.000Z");
    expect(minuteOfDayInZone(spring, LONDON)).toBe(180);

    // Noon on the fall-back day is already back on GMT.
    const autumn = zonedToInstant(parseISODate("2026-10-25"), 720, LONDON);
    expect(autumn.toISOString()).toBe("2026-10-25T12:00:00.000Z");
    expect(minuteOfDayInZone(autumn, LONDON)).toBe(720);
  });

  it("keeps a wall-clock time stable either side of the transition", () => {
    // 06:00 local is 06:00 local on both days, an hour apart in absolute terms.
    const before = zonedToInstant(parseISODate("2026-03-28"), 360, LONDON);
    const after = zonedToInstant(parseISODate("2026-03-30"), 360, LONDON);
    expect(minuteOfDayInZone(before, LONDON)).toBe(360);
    expect(minuteOfDayInZone(after, LONDON)).toBe(360);
    const hoursApart = (after.getTime() - before.getTime()) / 3_600_000;
    expect(hoursApart).toBe(47);
  });
});

describe("ISO date handling", () => {
  it("round-trips valid dates", () => {
    expect(toISODate({ year: 2026, month: 9, day: 5 })).toBe("2026-09-05");
    expect(toISODate(parseISODate("2026-01-01"))).toBe("2026-01-01");
    expect(toISODate(parseISODate("2024-02-29"))).toBe("2024-02-29");
  });

  it("rejects malformed and impossible dates", () => {
    expect(isISODate("2026-09-05")).toBe(true);
    expect(isISODate("2024-02-29")).toBe(true);
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("2026-9-5")).toBe(false);
    expect(isISODate("05-09-2026")).toBe(false);
    expect(isISODate("")).toBe(false);
    expect(() => parseISODate("2026-9-5")).toThrow();
  });
});

describe("normalizeDate and addDays", () => {
  it("rolls out-of-range components into a real date", () => {
    expect(toISODate(normalizeDate({ year: 2026, month: 13, day: 1 }))).toBe("2027-01-01");
    expect(toISODate(normalizeDate({ year: 2026, month: 3, day: 0 }))).toBe("2026-02-28");
    expect(toISODate(normalizeDate({ year: 2026, month: 2, day: 30 }))).toBe("2026-03-02");
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(toISODate(addDays(parseISODate("2026-01-31"), 1))).toBe("2026-02-01");
    expect(toISODate(addDays(parseISODate("2026-12-31"), 1))).toBe("2027-01-01");
    expect(toISODate(addDays(parseISODate("2026-01-01"), -1))).toBe("2025-12-31");
    expect(toISODate(addDays(parseISODate("2024-02-28"), 1))).toBe("2024-02-29");
    expect(toISODate(addDays(parseISODate("2026-02-28"), 1))).toBe("2026-03-01");
  });
});

describe("weekdayOf and daysBetween", () => {
  it("returns 0 for Sunday through 6 for Saturday", () => {
    expect(weekdayOf(parseISODate("2026-03-01"))).toBe(0);
    expect(weekdayOf(parseISODate("2026-09-05"))).toBe(6);
    expect(weekdayOf(parseISODate("2026-09-07"))).toBe(1);
  });

  it("counts whole days even across a DST transition", () => {
    // The classic off-by-one: a 47-hour span is still two calendar days.
    expect(daysBetween(parseISODate("2026-03-28"), parseISODate("2026-03-30"))).toBe(2);
    expect(daysBetween(parseISODate("2026-10-24"), parseISODate("2026-10-26"))).toBe(2);
    expect(daysBetween(parseISODate("2026-09-05"), parseISODate("2026-09-05"))).toBe(0);
    expect(daysBetween(parseISODate("2026-09-05"), parseISODate("2026-09-04"))).toBe(-1);
    expect(daysBetween(parseISODate("2025-09-05"), parseISODate("2026-09-05"))).toBe(365);
  });
});

describe("wrapMinute", () => {
  it("maps any value into 0-1439", () => {
    expect(wrapMinute(0)).toBe(0);
    expect(wrapMinute(1439)).toBe(1439);
    expect(wrapMinute(MINUTES_PER_DAY)).toBe(0);
    expect(wrapMinute(1500)).toBe(60);
    expect(wrapMinute(-60)).toBe(1380);
    expect(wrapMinute(-1500)).toBe(1380);
  });
});

describe("formatClock", () => {
  it("formats 12-hour times with the right meridiem", () => {
    expect(formatClock(0)).toBe("12:00 AM");
    expect(formatClock(285)).toBe("4:45 AM");
    expect(formatClock(719)).toBe("11:59 AM");
    expect(formatClock(720)).toBe("12:00 PM");
    expect(formatClock(1275)).toBe("9:15 PM");
    expect(formatClock(1439)).toBe("11:59 PM");
  });

  it("supports 24-hour and compact forms", () => {
    expect(formatClock(285, { hour24: true })).toBe("04:45");
    expect(formatClock(1275, { hour24: true })).toBe("21:15");
    expect(formatClock(285, { compact: true })).toBe("4:45am");
    expect(formatClock(1275, { compact: true })).toBe("9:15pm");
  });

  it("wraps values outside a single day and rounds fractions", () => {
    expect(formatClock(-60)).toBe("11:00 PM");
    expect(formatClock(MINUTES_PER_DAY + 60)).toBe("1:00 AM");
    expect(formatClock(284.6)).toBe("4:45 AM");
  });
});

describe("formatDuration", () => {
  it("drops empty components", () => {
    expect(formatDuration(465)).toBe("7h 45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(MINUTES_PER_DAY)).toBe("24h");
  });

  it("falls back to seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(0.25)).toBe("15s");
    expect(formatDuration(-5)).toBe("0s");
  });
});

describe("formatSignedDuration", () => {
  it("prefixes the sign and never emits a bare hyphen", () => {
    expect(formatSignedDuration(130)).toBe("+2h 10m");
    expect(formatSignedDuration(-35)).toBe("−35m");
    expect(formatSignedDuration(0)).toBe("+0s");
  });
});
