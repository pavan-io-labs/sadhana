/**
 * Muhurta windows.
 *
 * A muhurta is 1/30th of the span from sunrise to sunrise: fifteen divide the day and
 * fifteen the night. The two the app cares about:
 *
 *  - **Brahma Muhurta**, the 14th muhurta of the night  --  the traditional window for
 *    waking, study and meditation. Measured from the previous sunset, it runs from
 *    `sunrise - 2u` to `sunrise - u` where `u` is one fifteenth of the night.
 *  - **Abhijit Muhurta**, the 8th muhurta of the day  --  the auspicious midday window,
 *    centred on solar noon. Notably it lands inside the Pitta peak, so the tradition
 *    and the circadian evidence agree on when to do the hardest thinking.
 *
 * Two modes are offered because panchangs and texts disagree:
 *
 *  - `fixed`  --  the convention almost every published panchang uses: a muhurta is
 *    exactly 48 minutes, so Brahma Muhurta is `sunrise-96` to `sunrise-48`. Default.
 *  - `proportional`  --  the strict textual definition, dividing the real night by 15.
 *    Across the Indian year this puts the window roughly 80-110 minutes before
 *    sunrise instead of a flat 96-48.
 *
 * Pure: all inputs and outputs are minutes from local midnight.
 */

import type { SolarDay } from "./astro";

export type MuhurtaMode = "fixed" | "proportional";

/** A muhurta is a thirtieth of the sunrise-to-sunrise cycle: 48 minutes on average. */
export const FIXED_MUHURTA_MINUTES = 48;

export type Window = {
  /** Minutes from local midnight; may be negative when the window opens before midnight. */
  start: number;
  end: number;
};

export function windowLength(w: Window): number {
  return w.end - w.start;
}

export function windowContains(w: Window, minute: number): boolean {
  return minute >= w.start && minute < w.end;
}

/** One fifteenth of the night, in minutes. */
export function nightMuhurtaLength(
  sunrise: number,
  previousSunset: number,
  mode: MuhurtaMode,
): number {
  if (mode === "fixed") return FIXED_MUHURTA_MINUTES;
  // `previousSunset` is expressed relative to today's midnight, so it is negative.
  const night = sunrise - previousSunset;
  if (!Number.isFinite(night) || night <= 0) return FIXED_MUHURTA_MINUTES;
  return night / 15;
}

/** One fifteenth of the day, in minutes. */
export function dayMuhurtaLength(dayLength: number | null, mode: MuhurtaMode): number {
  if (mode === "fixed" || dayLength === null || dayLength <= 0) {
    return FIXED_MUHURTA_MINUTES;
  }
  return dayLength / 15;
}

/** The 14th muhurta of the night. */
export function brahmaMuhurta(
  sunrise: number,
  previousSunset: number,
  mode: MuhurtaMode = "fixed",
): Window {
  const u = nightMuhurtaLength(sunrise, previousSunset, mode);
  return { start: sunrise - 2 * u, end: sunrise - u };
}

/**
 * Pratah Sandhya  --  the junction between night and day, the last muhurta before
 * sunrise. This is the window the realistic working-professional preset targets:
 * still pre-dawn and quiet, but roughly an hour later than Brahma Muhurta.
 */
export function pratahSandhya(
  sunrise: number,
  previousSunset: number,
  mode: MuhurtaMode = "fixed",
): Window {
  const u = nightMuhurtaLength(sunrise, previousSunset, mode);
  return { start: sunrise - u, end: sunrise };
}

/** Sayam Sandhya  --  the evening junction, the first muhurta after sunset. */
export function sayamSandhya(
  sunset: number,
  dayLength: number | null,
  mode: MuhurtaMode = "fixed",
): Window {
  const u = dayMuhurtaLength(dayLength, mode);
  return { start: sunset, end: sunset + u };
}

/** The 8th muhurta of the day, centred on solar noon. */
export function abhijitMuhurta(
  solarNoon: number,
  dayLength: number | null,
  mode: MuhurtaMode = "fixed",
): Window {
  const half = dayMuhurtaLength(dayLength, mode) / 2;
  return { start: solarNoon - half, end: solarNoon + half };
}

export type MuhurtaSet = {
  mode: MuhurtaMode;
  brahma: Window | null;
  pratahSandhya: Window | null;
  abhijit: Window;
  sayamSandhya: Window | null;
  /** Length of one night muhurta, minutes  --  surfaced so the UI can explain the mode. */
  nightMuhurtaMinutes: number;
  dayMuhurtaMinutes: number;
};

/**
 * Every window the app needs for one day.
 *
 * `previousSolarDay` supplies yesterday's sunset for the proportional night division;
 * when it is missing (or the location is inside a polar day) the fixed 48-minute
 * muhurta is used, which is what a panchang would print anyway.
 */
export function muhurtaSet(
  today: SolarDay,
  previousSolarDay: SolarDay | null,
  mode: MuhurtaMode = "fixed",
): MuhurtaSet {
  const previousSunset =
    previousSolarDay?.sunset != null ? previousSolarDay.sunset - 1440 : null;

  const nightMuhurtaMinutes =
    today.sunrise != null && previousSunset != null
      ? nightMuhurtaLength(today.sunrise, previousSunset, mode)
      : FIXED_MUHURTA_MINUTES;

  const dayMuhurtaMinutes = dayMuhurtaLength(today.dayLength, mode);

  return {
    mode,
    brahma:
      today.sunrise != null
        ? {
            start: today.sunrise - 2 * nightMuhurtaMinutes,
            end: today.sunrise - nightMuhurtaMinutes,
          }
        : null,
    pratahSandhya:
      today.sunrise != null
        ? { start: today.sunrise - nightMuhurtaMinutes, end: today.sunrise }
        : null,
    abhijit: abhijitMuhurta(today.solarNoon, today.dayLength, mode),
    sayamSandhya:
      today.sunset != null
        ? { start: today.sunset, end: today.sunset + dayMuhurtaMinutes }
        : null,
    nightMuhurtaMinutes,
    dayMuhurtaMinutes,
  };
}
