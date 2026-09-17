/**
 * GET /api/schedule/resolve  --  anchored blocks turned into concrete, checked days.
 *
 * The pages that render a day do this on the server without a fetch. This endpoint exists for
 * the client-side refetch after an edit, for the week strip, and for `/selftest`  --  anywhere the
 * browser needs the resolved timetable without re-deriving sunrise for itself.
 *
 * Each element pairs the plan with the day resolved against it, rather than returning two
 * arrays to be lined up by index: `ResolvedDay.anchors` carries the six numbers a block can be
 * anchored to, but the muhurta windows, the place and the caffeine cutoff live on the plan, and
 * every caller that draws a timeline wants both.
 *
 * `nowMinute` is the clock in the *user's configured* zone, which is not necessarily the
 * browser's. `scheduleNow` in `lib/schedule.ts` is pure, so the client turns these two scalars
 * into now/next itself rather than having the server guess how stale its own snapshot is.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok } from "@/lib/api";
import { ensureRoutine } from "@/lib/blocks";
import { buildDayPlans, type DayPlan } from "@/lib/day";
import { resolveDay, type ResolvedDay } from "@/lib/schedule";
import { dayInputFromSettings, getSettings } from "@/lib/settings";
import { minuteOfDayInZone, parseISODate, toISODate, todayInZone } from "@/lib/time";
import { parseSearchParams, scheduleQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A day and the astronomy it was resolved against, kept together. */
export type ResolvedDayPayload = {
  plan: DayPlan;
  day: ResolvedDay;
};

export type ScheduleResolveResponse = {
  /** Which routine answered, so the client can label the timetable it just drew. */
  routine: { id: number; slug: string; name: string; isPreset: boolean; blocks: number };
  /** The user's own today, and the minute of it, both in their configured zone. */
  today: string;
  nowMinute: number;
  days: ResolvedDayPayload[];
};

export async function GET(request: NextRequest) {
  return guarded<ScheduleResolveResponse>(async () => {
    const parsed = parseSearchParams(scheduleQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    const query = parsed.data;

    const settings = await getSettings();
    const input = dayInputFromSettings(settings);

    // Installs the default routine on a database that has none, so a page hit before onboarding
    // finishes draws a timetable rather than an empty frame. See `ensureRoutine`.
    const routine = await ensureRoutine();

    const now = new Date();
    const today = todayInZone(settings.timeZone, now);
    const start = query.date ? parseISODate(query.date) : today;

    const plans = buildDayPlans(start, query.days, input);
    const days = plans.map<ResolvedDayPayload>((plan) => ({
      plan,
      day: resolveDay(plan, routine.blocks, {
        includeDisabled: query.includeDisabled,
        gapThreshold: query.gapThreshold,
      }),
    }));

    return ok({
      routine: {
        id: routine.routine.id,
        slug: routine.routine.slug,
        name: routine.routine.name,
        isPreset: routine.routine.isPreset,
        blocks: routine.blocks.length,
      },
      today: toISODate(today),
      nowMinute: minuteOfDayInZone(now, settings.timeZone),
      days,
    });
  });
}
