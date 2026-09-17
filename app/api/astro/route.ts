/**
 * GET /api/astro  --  the day plan for a location and date range.
 *
 * With no query at all it answers for today at the saved location, which is what the
 * Today view asks for. Everything is overridable so the timeline preview can ask for a
 * different date, and Settings can preview a city before committing to it.
 *
 * On caching: the arithmetic is a few hundred floating-point operations, so persisting it
 * to SQLite would cost more than recomputing it. The answer *is* deterministic per
 * (location, date, mode) though, so it carries a private `Cache-Control` and the browser
 * does the caching for free.
 */

import type { NextRequest } from "next/server";

import { labelCoordinate } from "@/data/cities-in";
import { guarded, invalid, fail, ok } from "@/lib/api";
import { buildDayPlans, type DayInput, type DayPlan } from "@/lib/day";
import { dayInputFromSettings, getSettings } from "@/lib/settings";
import { parseISODate, todayInZone } from "@/lib/time";
import { astroQuerySchema, parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type AstroResponse = {
  /** Echoed back so the client can show what was actually computed. */
  input: DayInput;
  days: DayPlan[];
};

export async function GET(request: NextRequest) {
  return guarded<AstroResponse>(async () => {
    const parsed = parseSearchParams(astroQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    const query = parsed.data;

    // Latitude and longitude only mean something together.
    const hasLat = query.latitude !== undefined;
    const hasLon = query.longitude !== undefined;
    if (hasLat !== hasLon) {
      const missing = hasLat ? "longitude" : "latitude";
      return fail("Some values need fixing", 422, {
        [missing]: ["Give both latitude and longitude, or neither"],
      });
    }

    const settings = await getSettings();
    const base = dayInputFromSettings(settings);

    const input: DayInput = {
      ...base,
      ...(hasLat && hasLon
        ? labelFor(query.latitude!, query.longitude!, query.timeZone ?? base.timeZone)
        : {}),
      ...(query.timeZone ? { timeZone: query.timeZone } : {}),
      ...(query.mode ? { muhurtaMode: query.mode } : {}),
    };

    const start = query.date ? parseISODate(query.date) : todayInZone(input.timeZone);
    const days = buildDayPlans(start, query.days, input);

    return ok(
      { input, days },
      { headers: { "Cache-Control": "private, max-age=1800" } },
    );
  });
}

/**
 * A coordinate plus a recognisable name for it.
 *
 * The coordinate is what gets computed from; the nearest listed city only supplies a
 * label, and only when it is close enough to be honest about.
 */
function labelFor(
  latitude: number,
  longitude: number,
  timeZone: string,
): Pick<DayInput, "city" | "region" | "latitude" | "longitude" | "timeZone"> {
  return { latitude, longitude, timeZone, ...labelCoordinate(latitude, longitude) };
}
