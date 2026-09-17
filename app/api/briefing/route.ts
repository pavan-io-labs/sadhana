/**
 * GET /api/briefing?kind=morning|evening  --  returns the composed briefing as JSON.
 *
 * The briefing is deterministic and composed from the user's settings,
 * today's plan, and their tracked data.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, ok, invalid } from "@/lib/api";
import { renderSettings, dayInputFromSettings } from "@/lib/settings";
import { buildDayPlan } from "@/lib/day";
import { calendarDateInZone } from "@/lib/time";
import { composeMorningBriefing, composeEveningBriefing } from "@/lib/briefing";
import { sessionsOnDate, weekInCycle, isDeloadWeek } from "@/lib/training";
import { parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  kind: z.enum(["morning", "evening"]).default("morning"),
});

export async function GET(request: NextRequest) {
  return guarded(async () => {
    const parsed = parseSearchParams(querySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);

    const settings = await renderSettings();
    const now = new Date();
    const today = calendarDateInZone(now, settings.timeZone);
    const dayInput = dayInputFromSettings(settings);
    const plan = buildDayPlan(today, dayInput);

    const week = weekInCycle(
      settings.trackStartedOn
        ? {
            year: Number(settings.trackStartedOn.slice(0, 4)),
            month: Number(settings.trackStartedOn.slice(5, 7)),
            day: Number(settings.trackStartedOn.slice(8, 10)),
          }
        : null,
      today,
    );
    const deload = isDeloadWeek(week);
    const sessions = sessionsOnDate(today, settings.activeTrack);

    const briefingInput = {
      plan,
      clock24h: settings.clock24h,
      activeTrack: settings.activeTrack,
      sessionNames: sessions.map((s) => s.name),
      isDeload: deload,
      completedBlocks: 0,
      totalBlocks: 0,
      sleepMinutes: null,
      restingHr: null,
      pvtMedianRt: null,
      caffeineMg: 0,
      lastFoodMinute: null,
      waterMl: 0,
    };

    const briefing =
      parsed.data.kind === "evening"
        ? composeEveningBriefing(briefingInput)
        : composeMorningBriefing(briefingInput);

    return ok(briefing);
  });
}
