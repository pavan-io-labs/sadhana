/**
 * POST /api/onboarding  --  the first-run answers, applied in one pass.
 *
 * Location arrives either as a listed city id or as a coordinate the client has already
 * labelled (the city table is pure data and ships to the browser, so the picker resolves
 * names itself). Only the id form is looked up here, because only that form can be wrong.
 *
 * Order matters, and it is settings → routine → onboarded. The routine is installed after the
 * numbers it will be resolved against, and the onboarded stamp goes last, so a failure at any
 * point leaves the app asking the questions again rather than serving a day with no blocks in
 * it. Re-answering is safe: installing a preset replaces its own routine rather than adding one.
 */

import type { NextRequest } from "next/server";

import { findCity } from "@/data/cities-in";
import { guarded, invalid, fail, ok, readJson } from "@/lib/api";
import { installPreset } from "@/lib/blocks";
import {
  markOnboarded,
  type UiPreferences,
  uiPreferencesOf,
  updateSettings,
} from "@/lib/settings";
import { toISODate, todayInZone } from "@/lib/time";
import { type LocationChoice, onboardingSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type OnboardingResponse = {
  ui: UiPreferences;
  /** What was installed, so the client can name it without a second request. */
  routine: { id: number; slug: string; name: string; blocks: number };
};

/** The five columns a location resolves to, all required  --  unlike the partial patch type. */
type StoredLocation = {
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

function storedLocation(choice: LocationChoice): StoredLocation | null {
  if ("cityId" in choice) {
    const city = findCity(choice.cityId);
    if (!city) return null;
    return {
      city: city.name,
      region: city.region,
      latitude: city.latitude,
      longitude: city.longitude,
      timeZone: city.timeZone,
    };
  }
  return {
    city: choice.city,
    region: choice.region,
    latitude: choice.latitude,
    longitude: choice.longitude,
    timeZone: choice.timeZone,
  };
}

export async function POST(request: NextRequest) {
  return guarded<OnboardingResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = onboardingSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);
    const answers = parsed.data;

    const location = storedLocation(answers.location);
    if (!location) {
      return fail("Some values need fixing", 422, {
        "location.cityId": ["Not a city in the shipped table"],
      });
    }

    await updateSettings({
      ...location,
      chronotype: answers.chronotype,
      chronotypeScore: answers.chronotypeScore,
      activeTrack: answers.activeTrack,
      muhurtaMode: answers.muhurtaMode,
      wakeOffsetMinutes: answers.wakeOffsetMinutes,
      sleepTargetMinutes: answers.sleepTargetMinutes,
      // The deload counter and the 4-week ramp both count from here.
      trackStartedOn: toISODate(todayInZone(location.timeZone)),
    });

    // The routine the day is built from. Installed before the onboarded stamp, so a failure
    // here leaves the questions to be answered again rather than an empty timetable  --  and with
    // `adoptSleep: false`, because the wake offset and sleep target written above are the user's
    // own answers from the sleep step, which a preset's defaults must not overrule.
    const installed = await installPreset(answers.preset, { adoptSleep: false });

    // Separate write, and last: if anything above fails the app stays un-onboarded and the
    // user gets the form again rather than a half-configured day.
    const settings = await markOnboarded();
    return ok({
      ui: uiPreferencesOf(settings),
      routine: {
        id: installed.routine.id,
        slug: installed.routine.slug,
        name: installed.routine.name,
        blocks: installed.blocks.length,
      },
    });
  });
}
