/**
 * GET /api/settings  --  the saved row and the two projections derived from it.
 * PATCH /api/settings  --  a partial update, validated field by field.
 *
 * The Settings *page* reads the row directly on the server, so this endpoint exists for the
 * client-side mutations, for `/selftest`, and as the read half of export/import. PATCH is
 * partial by design: the page saves one section at a time, and a form that had to resend
 * every field would silently overwrite whatever another tab had just changed.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, fail, ok, readJson } from "@/lib/api";
import type { Settings } from "@/lib/db/schema";
import type { DayInput } from "@/lib/day";
import {
  dayInputFromSettings,
  getSettings,
  type UiPreferences,
  uiPreferencesOf,
  updateSettings,
} from "@/lib/settings";
import { settingsPatchSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SettingsResponse = {
  settings: Settings;
  ui: UiPreferences;
  dayInput: DayInput;
};

function envelope(settings: Settings): SettingsResponse {
  return {
    settings,
    ui: uiPreferencesOf(settings),
    dayInput: dayInputFromSettings(settings),
  };
}

export async function GET() {
  return guarded<SettingsResponse>(async () => ok(envelope(await getSettings())));
}

export async function PATCH(request: NextRequest) {
  return guarded<SettingsResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = settingsPatchSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);
    const patch = parsed.data;

    if (Object.keys(patch).length === 0) {
      return fail("Some values need fixing", 422, { _: ["Nothing to update"] });
    }

    // A coordinate is only meaningful as a pair, and moving without saying which zone you
    // moved into would silently keep computing sunrise against the old offset.
    const hasLat = patch.latitude !== undefined;
    const hasLon = patch.longitude !== undefined;
    if (hasLat !== hasLon) {
      const missing = hasLat ? "longitude" : "latitude";
      return fail("Some values need fixing", 422, {
        [missing]: ["Give both latitude and longitude, or neither"],
      });
    }

    return ok(envelope(await updateSettings(patch)));
  });
}
