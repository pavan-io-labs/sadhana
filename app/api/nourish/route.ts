/**
 * GET  /api/nourish  --  everything on one date: meals, caffeine, hydration.
 * POST /api/nourish/meal  --  log a meal.
 * POST /api/nourish/caffeine  --  log a caffeine dose.
 * POST /api/nourish/hydration  --  set or add to the day's water.
 *
 * Separate POST endpoints rather than one with a `kind` discriminant, because meals have
 * patches and deletes while hydration has an upsert  --  the shapes are genuinely different.
 * But the GET is one call, because the Nourish view needs all three at once.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok } from "@/lib/api";
import { nourishOn, type NourishDay } from "@/lib/nourish";
import { parseSearchParams, nourishQuerySchema } from "@/lib/validators";
import { toISODate, calendarDateInZone } from "@/lib/time";
import { renderSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type NourishResponse = NourishDay;

export async function GET(request: NextRequest) {
  return guarded<NourishResponse>(async () => {
    const parsed = parseSearchParams(nourishQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    let date = parsed.data.date;
    if (!date) {
      const settings = await renderSettings();
      date = toISODate(calendarDateInZone(new Date(), settings.timeZone));
    }
    return ok(await nourishOn(date));
  });
}
