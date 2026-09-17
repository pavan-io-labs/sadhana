import { describe, expect, it } from "vitest";

import { julianDay, solarDay, type Location } from "@/lib/astro";
import { parseISODate, tzOffsetForDate } from "@/lib/time";

const HYDERABAD: Location = { latitude: 17.385, longitude: 78.4867, timeZone: "Asia/Kolkata" };
const DELHI: Location = { latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata" };
const CHENNAI: Location = { latitude: 13.0827, longitude: 80.2707, timeZone: "Asia/Kolkata" };
const KOLKATA: Location = { latitude: 22.5726, longitude: 88.3639, timeZone: "Asia/Kolkata" };
const MUMBAI: Location = { latitude: 19.076, longitude: 72.8777, timeZone: "Asia/Kolkata" };
const LONDON: Location = { latitude: 51.5072, longitude: -0.1276, timeZone: "Europe/London" };

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Reference sunrise/sunset taken from Open-Meteo's archive API  --  an independent
 * implementation of the same solar equations, so agreement is a real cross-check
 * rather than a self-consistency check. Two transcription notes:
 *
 * - Open-Meteo renders local time using the UTC offset in force when the request
 *   is made, not on the date asked about. The London rows were therefore read from
 *   its UTC output and shifted by that date's true offset (GMT in winter, BST in
 *   summer). Asia/Kolkata never shifts, so the Indian rows are verbatim.
 * - The reference is minute-resolution, which is what sets the tolerance below.
 */
const CASES: Array<{
  name: string;
  location: Location;
  date: string;
  sunrise: string;
  sunset: string;
}> = [
  // Equinoxes and solstices exercise the extremes of the equation of time.
  { name: "Hyderabad, Mar equinox", location: HYDERABAD, date: "2026-03-20", sunrise: "06:20", sunset: "18:27" },
  { name: "Hyderabad, Jun solstice", location: HYDERABAD, date: "2025-06-21", sunrise: "05:42", sunset: "18:53" },
  { name: "Hyderabad, Sep equinox", location: HYDERABAD, date: "2025-09-23", sunrise: "06:05", sunset: "18:11" },
  { name: "Hyderabad, Dec solstice", location: HYDERABAD, date: "2025-12-21", sunrise: "06:41", sunset: "17:46" },
  { name: "Hyderabad, early Sep", location: HYDERABAD, date: "2026-09-05", sunrise: "06:02", sunset: "18:26" },
  // Spread across Indian latitudes and longitudes, all sharing one fixed offset.
  { name: "Delhi, Jun solstice", location: DELHI, date: "2025-06-21", sunrise: "05:24", sunset: "19:21" },
  { name: "Delhi, Dec solstice", location: DELHI, date: "2025-12-21", sunrise: "07:09", sunset: "17:29" },
  { name: "Chennai, Jun solstice", location: CHENNAI, date: "2025-06-21", sunrise: "05:43", sunset: "18:37" },
  { name: "Chennai, Dec solstice", location: CHENNAI, date: "2025-12-21", sunrise: "06:26", sunset: "17:47" },
  { name: "Kolkata, early Sep", location: KOLKATA, date: "2026-09-05", sunrise: "05:20", sunset: "17:50" },
  { name: "Mumbai, early Sep", location: MUMBAI, date: "2026-09-05", sunrise: "06:24", sunset: "18:50" },
  // A high-latitude, DST-observing location, where any hour-angle error is largest.
  { name: "London, Jun solstice", location: LONDON, date: "2025-06-21", sunrise: "04:43", sunset: "21:21" },
  { name: "London, Dec solstice", location: LONDON, date: "2025-12-21", sunrise: "08:03", sunset: "15:53" },
  { name: "London, day before BST", location: LONDON, date: "2026-03-28", sunrise: "05:45", sunset: "18:27" },
  { name: "London, day after BST", location: LONDON, date: "2026-03-30", sunrise: "06:40", sunset: "19:30" },
];

describe("julianDay", () => {
  it("matches known Julian Day numbers at 00:00 UT", () => {
    // J2000.0 is JD 2451545.0 at 2000-01-01 12:00 UT, so midnight is 0.5 earlier.
    expect(julianDay({ year: 2000, month: 1, day: 1 })).toBeCloseTo(2451544.5, 6);
    expect(julianDay({ year: 1987, month: 1, day: 27 })).toBeCloseTo(2446822.5, 6);
    // Straddles the March/February branch of the algorithm.
    expect(julianDay({ year: 1988, month: 6, day: 19 })).toBeCloseTo(2447331.5, 6);
  });

  it("advances by exactly one for consecutive days, including across months", () => {
    expect(julianDay({ year: 2026, month: 3, day: 1 }) - julianDay({ year: 2026, month: 2, day: 28 })).toBe(1);
    expect(julianDay({ year: 2027, month: 1, day: 1 }) - julianDay({ year: 2026, month: 12, day: 31 })).toBe(1);
    // 2024 was a leap year, so the 29th exists and the gap is still one day.
    expect(julianDay({ year: 2024, month: 3, day: 1 }) - julianDay({ year: 2024, month: 2, day: 29 })).toBe(1);
  });
});

describe("solarDay", () => {
  for (const c of CASES) {
    it(`${c.name}: sunrise and sunset within 2 minutes of reference`, () => {
      const day = solarDay(parseISODate(c.date), c.location);
      expect(day.sunrise).not.toBeNull();
      expect(day.sunset).not.toBeNull();
      expect(Math.abs(day.sunrise! - minutesOf(c.sunrise))).toBeLessThanOrEqual(2);
      expect(Math.abs(day.sunset! - minutesOf(c.sunset))).toBeLessThanOrEqual(2);
    });
  }

  it("puts solar noon midway between sunrise and sunset", () => {
    const day = solarDay(parseISODate("2026-09-05"), HYDERABAD);
    const midpoint = (day.sunrise! + day.sunset!) / 2;
    expect(Math.abs(day.solarNoon - midpoint)).toBeLessThan(1);
  });

  it("puts civil twilight outside sunrise and sunset", () => {
    const day = solarDay(parseISODate("2026-09-05"), HYDERABAD);
    expect(day.civilDawn!).toBeLessThan(day.sunrise!);
    expect(day.civilDusk!).toBeGreaterThan(day.sunset!);
    // Civil twilight in the tropics is short: roughly 20-25 minutes.
    expect(day.sunrise! - day.civilDawn!).toBeGreaterThan(15);
    expect(day.sunrise! - day.civilDawn!).toBeLessThan(35);
  });

  it("reports day length growing towards the June solstice in the north", () => {
    const june = solarDay(parseISODate("2026-06-21"), DELHI);
    const december = solarDay(parseISODate("2026-12-21"), DELHI);
    expect(june.dayLength!).toBeGreaterThan(december.dayLength!);
    // Delhi swings by roughly 3h40m across the year.
    expect(june.dayLength! - december.dayLength!).toBeGreaterThan(180);
  });

  it("keeps the day-length swing smaller nearer the equator", () => {
    const swing = (l: Location) =>
      solarDay(parseISODate("2026-06-21"), l).dayLength! - solarDay(parseISODate("2026-12-21"), l).dayLength!;
    expect(swing(CHENNAI)).toBeLessThan(swing(DELHI));
    expect(swing(DELHI)).toBeLessThan(swing(LONDON));
  });

  it("flags polar day above the Arctic circle", () => {
    const tromso = solarDay(parseISODate("2026-06-21"), {
      latitude: 69.6496,
      longitude: 18.956,
      timeZone: "Europe/Oslo",
    });
    expect(tromso.polar).toBe(true);
    expect(tromso.sunrise).toBeNull();
    expect(tromso.sunset).toBeNull();
    expect(tromso.dayLength).toBeNull();
    // Solar noon is still well defined when the sun never sets.
    expect(tromso.solarNoon).toBeGreaterThan(0);
  });

  it("flags polar night above the Arctic circle in December", () => {
    const tromso = solarDay(parseISODate("2026-12-21"), {
      latitude: 69.6496,
      longitude: 18.956,
      timeZone: "Europe/Oslo",
    });
    expect(tromso.polar).toBe(true);
    expect(tromso.sunrise).toBeNull();
  });

  it("tracks the declination sign across the year", () => {
    expect(solarDay(parseISODate("2026-06-21"), HYDERABAD).declination).toBeGreaterThan(23);
    expect(solarDay(parseISODate("2026-12-21"), HYDERABAD).declination).toBeLessThan(-23);
    expect(Math.abs(solarDay(parseISODate("2026-03-20"), HYDERABAD).declination)).toBeLessThan(1);
  });

  it("shifts sunrise later at the western edge of a shared timezone", () => {
    // India runs one offset across ~28 degrees of longitude, so Mumbai's clock
    // sunrise is much later than Kolkata's on the same date.
    const kolkata = solarDay(parseISODate("2026-09-05"), KOLKATA);
    const mumbai = solarDay(parseISODate("2026-09-05"), MUMBAI);
    expect(mumbai.sunrise! - kolkata.sunrise!).toBeGreaterThan(50);
  });
});

describe("timezone handling in solarDay", () => {
  it("uses IST for Indian locations", () => {
    expect(tzOffsetForDate(parseISODate("2026-09-05"), "Asia/Kolkata")).toBe(330);
    expect(solarDay(parseISODate("2026-09-05"), HYDERABAD).tzOffsetMinutes).toBe(330);
  });

  it("follows British Summer Time across the boundary", () => {
    // BST runs from the last Sunday in March to the last Sunday in October,
    // which in 2026 means it starts on the 29th.
    const beforeDst = solarDay(parseISODate("2026-03-28"), LONDON);
    const afterDst = solarDay(parseISODate("2026-03-30"), LONDON);
    expect(beforeDst.tzOffsetMinutes).toBe(0);
    expect(afterDst.tzOffsetMinutes).toBe(60);
    // Wall-clock sunrise jumps forward roughly an hour, not a few minutes.
    expect(afterDst.sunrise! - beforeDst.sunrise!).toBeGreaterThan(45);
  });
});
