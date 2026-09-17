/**
 * GET /api/ics?date=2026-09-17  --  download today's schedule as .ics.
 *
 * Computes the day's landmarks from the schedule engine and generates a VCALENDAR
 * file that can be imported into any calendar app for OS-level alarms.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, invalid } from "@/lib/api";
import { generateIcs } from "@/lib/ics";
import { renderSettings, dayInputFromSettings } from "@/lib/settings";
import { buildDayPlan } from "@/lib/day";
import { calendarDateInZone, toISODate, parseISODate } from "@/lib/time";
import { parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const icsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(icsQuerySchema, request.nextUrl.searchParams);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const settings = await renderSettings();
    const dateStr = parsed.data.date;
    const date = dateStr
      ? parseISODate(dateStr)
      : calendarDateInZone(new Date(), settings.timeZone);

    const input = dayInputFromSettings(settings);
    const plan = buildDayPlan(date, input);

    // Convert plan landmarks (which have minute/label) to ICS blocks
    const icsBlocks = plan.landmarks
      .filter((lm) => lm.label !== "")
      .map((lm, i, arr) => ({
        title: lm.label,
        startMinute: lm.minute,
        durationMinutes: i < arr.length - 1 ? Math.max(5, arr[i + 1].minute - lm.minute) : 30,
      }));

    const icsContent = generateIcs(date, icsBlocks, settings.timeZone);
    const filename = `sadhana-${toISODate(date)}.ics`;

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return fail(String(err), 500);
  }
}
