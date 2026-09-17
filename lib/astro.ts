/**
 * Solar events from the NOAA General Solar Position Calculations.
 *
 * Implemented directly rather than pulled from a package: it is ~120 lines of
 * arithmetic, it must run identically on server and client, and every downstream
 * window in the app (Brahma Muhurta, wake, Abhijit, the whole timeline) is derived
 * from sunrise, so it is worth being able to read and test.
 *
 * Reference: NOAA Global Monitoring Laboratory solar calculator equations,
 * https://gml.noaa.gov/grad/solcalc/calcdetails.html
 *
 * Accuracy: within ~1 minute for latitudes below 72 degrees, which is what the unit
 * tests assert against published almanac values for Indian cities.
 *
 * All returned times are minutes from local midnight on the requested calendar date.
 * Values may be negative (event fell before local midnight) or above 1440.
 */

import { type CalendarDate, MINUTES_PER_DAY, tzOffsetForDate } from "./time";

const RAD = Math.PI / 180;

/** Apparent sunrise/sunset: 90.833 degrees accounts for refraction and solar radius. */
export const ZENITH_SUNRISE = 90.833;
/** Civil twilight. */
export const ZENITH_CIVIL = 96;

/** Julian Day at 00:00 UT on the given Gregorian calendar date. */
export function julianDay(date: CalendarDate): number {
  let y = date.year;
  let m = date.month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    date.day +
    b -
    1524.5
  );
}

function julianCentury(jd: number): number {
  return (jd - 2451545) / 36525;
}

type SolarState = {
  /** Solar declination, degrees. */
  declination: number;
  /** Equation of time, minutes. */
  equationOfTime: number;
};

/** Sun declination and equation of time at a Julian Day (fractional, UT). */
export function solarState(jd: number): SolarState {
  const t = julianCentury(jd);

  const meanLong = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const centre =
    Math.sin(meanAnom * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnom * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnom * RAD) * 0.000289;

  const trueLong = meanLong + centre;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  const meanObliq =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(omega * RAD);

  const declination =
    Math.asin(Math.sin(obliqCorr * RAD) * Math.sin(appLong * RAD)) / RAD;

  const varY = Math.tan((obliqCorr / 2) * RAD) ** 2;
  const equationOfTime =
    (4 *
      (varY * Math.sin(2 * meanLong * RAD) -
        2 * eccentricity * Math.sin(meanAnom * RAD) +
        4 * eccentricity * varY * Math.sin(meanAnom * RAD) * Math.cos(2 * meanLong * RAD) -
        0.5 * varY * varY * Math.sin(4 * meanLong * RAD) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnom * RAD))) /
    RAD;

  return { declination, equationOfTime };
}

/**
 * Hour angle at the given zenith, in degrees, or `null` when the sun never reaches
 * that zenith on the day (polar day or polar night).
 */
export function hourAngle(latitude: number, declination: number, zenith: number): number | null {
  const cosH =
    Math.cos(zenith * RAD) / (Math.cos(latitude * RAD) * Math.cos(declination * RAD)) -
    Math.tan(latitude * RAD) * Math.tan(declination * RAD);
  if (cosH > 1 || cosH < -1) return null;
  return Math.acos(cosH) / RAD;
}

export type SolarDay = {
  date: CalendarDate;
  /** Offset from UTC in minutes used for this day, e.g. 330 for IST. */
  tzOffsetMinutes: number;
  /** Local minutes from midnight. */
  sunrise: number | null;
  sunset: number | null;
  solarNoon: number;
  /** Civil dawn / dusk (sun 6 degrees below the horizon). */
  civilDawn: number | null;
  civilDusk: number | null;
  /** Sunset to sunrise, minutes. `null` when either bound is missing. */
  dayLength: number | null;
  /** Solar declination at local solar noon, degrees. */
  declination: number;
  /** True when the sun does not rise or set on this day at this latitude. */
  polar: boolean;
};

export type Location = {
  latitude: number;
  /** Positive east of Greenwich, as NOAA's equations expect. */
  longitude: number;
  timeZone: string;
};

/**
 * Solar noon in local minutes. NOAA: 720 - 4*longitude - eqTime + tzOffset.
 */
function noonFrom(longitude: number, eqTime: number, tzOffset: number): number {
  return 720 - 4 * longitude - eqTime + tzOffset;
}

/**
 * Sunrise, sunset, solar noon and civil twilight for a calendar date at a location.
 *
 * Two refinement passes: the first evaluates the sun's position at local noon, the
 * second at the estimated time of each event. That takes the residual from a couple
 * of minutes near the solstices down to a few seconds.
 */
export function solarDay(date: CalendarDate, location: Location): SolarDay {
  const tz = tzOffsetForDate(date, location.timeZone);
  const jdMidnightUt = julianDay(date) - tz / MINUTES_PER_DAY;

  // Pass 1: evaluate at local noon.
  const coarse = solarState(jdMidnightUt + 0.5);
  let noon = noonFrom(location.longitude, coarse.equationOfTime, tz);

  // Pass 2: re-evaluate at the estimated solar noon.
  const atNoon = solarState(jdMidnightUt + noon / MINUTES_PER_DAY);
  noon = noonFrom(location.longitude, atNoon.equationOfTime, tz);

  const resolve = (zenith: number, direction: -1 | 1): number | null => {
    const first = hourAngle(location.latitude, atNoon.declination, zenith);
    if (first === null) return null;
    const estimate = noon + direction * 4 * first;
    const at = solarState(jdMidnightUt + estimate / MINUTES_PER_DAY);
    const refined = hourAngle(location.latitude, at.declination, zenith);
    if (refined === null) return null;
    return noonFrom(location.longitude, at.equationOfTime, tz) + direction * 4 * refined;
  };

  const sunrise = resolve(ZENITH_SUNRISE, -1);
  const sunset = resolve(ZENITH_SUNRISE, 1);

  return {
    date,
    tzOffsetMinutes: tz,
    sunrise,
    sunset,
    solarNoon: noon,
    civilDawn: resolve(ZENITH_CIVIL, -1),
    civilDusk: resolve(ZENITH_CIVIL, 1),
    dayLength: sunrise !== null && sunset !== null ? sunset - sunrise : null,
    declination: atNoon.declination,
    polar: sunrise === null || sunset === null,
  };
}
