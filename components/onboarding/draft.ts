/**
 * The answers being collected, before they are worth sending anywhere.
 *
 * Kept in its own module so the flow and the individual steps can share the shape without
 * importing each other. Nothing here touches the network or the DOM: the draft is turned
 * into a `DayInput` for the live preview and into the POST body at the end, and both of
 * those conversions are pure.
 */

import { defaultCity, findCity, labelCoordinate } from "@/data/cities-in";
import { DAY_INPUT_DEFAULTS, type DayInput } from "@/lib/day";
import type {
  Chronotype,
  LocationChoice,
  OnboardingInput,
  TrackId,
} from "@/lib/validators";

export type CustomLocation = {
  kind: "custom";
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

export type LocationDraft = { kind: "city"; cityId: string } | CustomLocation;

export type Draft = {
  location: LocationDraft;
  chronotype: Chronotype;
  wakeOffsetMinutes: number;
  sleepTargetMinutes: number;
  activeTrack: TrackId;
};

/** The device's own zone, which is the best available guess for a raw coordinate. */
export function browserTimeZone(fallback = DAY_INPUT_DEFAULTS.timeZone): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

/** A coordinate turned into a draft, named after the nearest listed city where that is fair. */
export function customLocation(
  latitude: number,
  longitude: number,
  timeZone: string,
): CustomLocation {
  return { kind: "custom", latitude, longitude, timeZone, ...labelCoordinate(latitude, longitude) };
}

/** A draft location resolved to the five values every computation actually needs. */
export type ResolvedLocation = Pick<
  DayInput,
  "city" | "region" | "latitude" | "longitude" | "timeZone"
>;

export function locationOfDraft(draft: LocationDraft): ResolvedLocation {
  if (draft.kind === "custom") {
    const { city, region, latitude, longitude, timeZone } = draft;
    return { city, region, latitude, longitude, timeZone };
  }
  // A draft can only hold an id the picker offered, so the fallback is unreachable in
  // practice  --  it exists so the preview never has to render an absent location.
  const city = findCity(draft.cityId) ?? defaultCity();
  return {
    city: city.name,
    region: city.region,
    latitude: city.latitude,
    longitude: city.longitude,
    timeZone: city.timeZone,
  };
}

/** What the live preview computes against: the draft over the shipped defaults. */
export function inputOfDraft(draft: Draft): DayInput {
  return {
    ...DAY_INPUT_DEFAULTS,
    ...locationOfDraft(draft.location),
    wakeOffsetMinutes: draft.wakeOffsetMinutes,
    sleepTargetMinutes: draft.sleepTargetMinutes,
  };
}

/** The request body. `preset` follows the track, which is the only sane default. */
export function bodyOfDraft(draft: Draft): OnboardingInput {
  const location: LocationChoice =
    draft.location.kind === "city"
      ? { cityId: draft.location.cityId }
      : {
          city: draft.location.city,
          region: draft.location.region,
          latitude: draft.location.latitude,
          longitude: draft.location.longitude,
          timeZone: draft.location.timeZone,
        };

  return {
    location,
    chronotype: draft.chronotype,
    chronotypeScore: null,
    activeTrack: draft.activeTrack,
    muhurtaMode: DAY_INPUT_DEFAULTS.muhurtaMode,
    wakeOffsetMinutes: draft.wakeOffsetMinutes,
    sleepTargetMinutes: draft.sleepTargetMinutes,
    preset: draft.activeTrack,
  };
}
