import { describe, expect, it } from "vitest";

import { solarDay, type Location, type SolarDay } from "@/lib/astro";
import {
  abhijitMuhurta,
  brahmaMuhurta,
  dayMuhurtaLength,
  FIXED_MUHURTA_MINUTES,
  muhurtaSet,
  nightMuhurtaLength,
  pratahSandhya,
  sayamSandhya,
  windowContains,
  windowLength,
  type Window,
} from "@/lib/muhurta";
import { addDays, MINUTES_PER_DAY, parseISODate } from "@/lib/time";

const HYDERABAD: Location = { latitude: 17.385, longitude: 78.4867, timeZone: "Asia/Kolkata" };
const TROMSO: Location = { latitude: 69.6496, longitude: 18.956, timeZone: "Europe/Oslo" };

/** Today plus yesterday, which is what the proportional night division needs. */
function daysFor(iso: string, location: Location): { today: SolarDay; previous: SolarDay } {
  const date = parseISODate(iso);
  return {
    today: solarDay(date, location),
    previous: solarDay(addDays(date, -1), location),
  };
}

/** How far before sunrise a window opens. */
function leadOn(iso: string, mode: "fixed" | "proportional"): number {
  const { today, previous } = daysFor(iso, HYDERABAD);
  const set = muhurtaSet(today, previous, mode);
  return today.sunrise! - set.brahma!.start;
}

describe("window helpers", () => {
  const w: Window = { start: 266, end: 314 };

  it("measures length as end minus start", () => {
    expect(windowLength(w)).toBe(48);
    expect(windowLength({ start: -30, end: 30 })).toBe(60);
  });

  it("includes the start and excludes the end", () => {
    expect(windowContains(w, 266)).toBe(true);
    expect(windowContains(w, 313.9)).toBe(true);
    expect(windowContains(w, 314)).toBe(false);
    expect(windowContains(w, 265.9)).toBe(false);
  });
});

describe("muhurta length", () => {
  it("is a flat 48 minutes in fixed mode", () => {
    expect(FIXED_MUHURTA_MINUTES).toBe(48);
    expect(nightMuhurtaLength(362, -333, "fixed")).toBe(48);
    expect(dayMuhurtaLength(780, "fixed")).toBe(48);
    expect(dayMuhurtaLength(null, "fixed")).toBe(48);
  });

  it("divides the real night by fifteen in proportional mode", () => {
    // Sunset 18:27 yesterday (-333 relative to today's midnight) to sunrise 06:02
    // is a 695-minute night.
    expect(nightMuhurtaLength(362, -333, "proportional")).toBeCloseTo(695 / 15, 9);
    expect(dayMuhurtaLength(780, "proportional")).toBe(52);
  });

  it("falls back to fixed when the night or day length is unusable", () => {
    expect(nightMuhurtaLength(362, 362, "proportional")).toBe(48);
    expect(nightMuhurtaLength(362, 500, "proportional")).toBe(48);
    expect(nightMuhurtaLength(Number.NaN, -333, "proportional")).toBe(48);
    expect(dayMuhurtaLength(null, "proportional")).toBe(48);
    expect(dayMuhurtaLength(0, "proportional")).toBe(48);
  });
});

describe("individual windows in fixed mode", () => {
  it("places Brahma Muhurta 96 to 48 minutes before sunrise", () => {
    expect(brahmaMuhurta(362, -333, "fixed")).toEqual({ start: 266, end: 314 });
    // Fixed mode ignores the night length entirely, which is the point of it.
    expect(brahmaMuhurta(362, -600, "fixed")).toEqual({ start: 266, end: 314 });
  });

  it("runs Pratah Sandhya from 48 minutes before sunrise up to sunrise", () => {
    const w = pratahSandhya(362, -333, "fixed");
    expect(w).toEqual({ start: 314, end: 362 });
    // The two windows abut: Brahma ends exactly where Pratah Sandhya starts.
    expect(brahmaMuhurta(362, -333, "fixed").end).toBe(w.start);
  });

  it("starts Sayam Sandhya at sunset", () => {
    expect(sayamSandhya(1107, 780, "fixed")).toEqual({ start: 1107, end: 1155 });
  });

  it("centres Abhijit Muhurta on solar noon", () => {
    expect(abhijitMuhurta(734, 780, "fixed")).toEqual({ start: 710, end: 758 });
    expect(abhijitMuhurta(734, 780, "proportional")).toEqual({ start: 708, end: 760 });
    const w = abhijitMuhurta(734, 780, "proportional");
    expect((w.start + w.end) / 2).toBe(734);
  });
});

describe("proportional mode across the Indian year", () => {
  it("keeps Brahma Muhurta roughly 80-110 minutes before sunrise", () => {
    // The claim the mode is documented with: dividing the real night by fifteen
    // moves the window with the season instead of pinning it at 96 minutes.
    for (const date of ["2026-03-20", "2026-06-21", "2026-09-05", "2026-12-21"]) {
      const lead = leadOn(date, "proportional");
      expect(lead).toBeGreaterThan(80);
      expect(lead).toBeLessThan(110);
    }
  });

  it("opens earlier on the long December night than the short June one", () => {
    expect(leadOn("2026-12-21", "proportional")).toBeGreaterThan(leadOn("2026-06-21", "proportional"));
    // Fixed mode, by contrast, does not move at all.
    expect(leadOn("2026-12-21", "fixed")).toBe(96);
    expect(leadOn("2026-06-21", "fixed")).toBe(96);
  });
});

describe("muhurtaSet", () => {
  it("returns contiguous pre-dawn windows that end at sunrise", () => {
    const { today, previous } = daysFor("2026-09-05", HYDERABAD);
    for (const mode of ["fixed", "proportional"] as const) {
      const set = muhurtaSet(today, previous, mode);
      expect(set.mode).toBe(mode);
      expect(set.brahma!.end).toBe(set.pratahSandhya!.start);
      expect(set.pratahSandhya!.end).toBe(today.sunrise);
      expect(windowLength(set.brahma!)).toBeCloseTo(set.nightMuhurtaMinutes, 9);
      expect(windowLength(set.pratahSandhya!)).toBeCloseTo(set.nightMuhurtaMinutes, 9);
      // Nothing in the pre-dawn set may spill past sunrise.
      expect(set.brahma!.end).toBeLessThan(today.sunrise!);
    }
  });

  it("anchors the evening and midday windows to the sun", () => {
    const { today, previous } = daysFor("2026-09-05", HYDERABAD);
    const set = muhurtaSet(today, previous, "proportional");
    expect(set.sayamSandhya!.start).toBe(today.sunset);
    expect(windowLength(set.sayamSandhya!)).toBeCloseTo(set.dayMuhurtaMinutes, 9);
    expect(windowContains(set.abhijit, today.solarNoon)).toBe(true);
    expect(set.dayMuhurtaMinutes).toBeCloseTo(today.dayLength! / 15, 9);
  });

  it("falls back to fixed muhurtas when yesterday is unknown", () => {
    const { today } = daysFor("2026-09-05", HYDERABAD);
    const set = muhurtaSet(today, null, "proportional");
    expect(set.nightMuhurtaMinutes).toBe(FIXED_MUHURTA_MINUTES);
    expect(set.brahma).toEqual({ start: today.sunrise! - 96, end: today.sunrise! - 48 });
    // The day windows still use the real day length; only the night is unknown.
    expect(set.dayMuhurtaMinutes).toBeCloseTo(today.dayLength! / 15, 9);
  });

  it("reads yesterday's sunset as a negative offset from today's midnight", () => {
    const { today, previous } = daysFor("2026-09-05", HYDERABAD);
    const set = muhurtaSet(today, previous, "proportional");
    const night = today.sunrise! - (previous.sunset! - MINUTES_PER_DAY);
    expect(set.nightMuhurtaMinutes).toBeCloseTo(night / 15, 9);
    // Sanity: an Indian September night is around eleven and a half hours.
    expect(night).toBeGreaterThan(660);
    expect(night).toBeLessThan(720);
  });

  it("drops the sun-dependent windows during polar day", () => {
    const { today, previous } = daysFor("2026-06-21", TROMSO);
    const set = muhurtaSet(today, previous, "proportional");
    expect(set.brahma).toBeNull();
    expect(set.pratahSandhya).toBeNull();
    expect(set.sayamSandhya).toBeNull();
    // Solar noon is still real, so Abhijit survives on the fixed fallback.
    expect(windowLength(set.abhijit)).toBe(FIXED_MUHURTA_MINUTES);
    expect(windowContains(set.abhijit, today.solarNoon)).toBe(true);
    expect(set.nightMuhurtaMinutes).toBe(FIXED_MUHURTA_MINUTES);
  });
});
