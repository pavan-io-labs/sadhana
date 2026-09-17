/**
 * GET  /api/logs?date=YYYY-MM-DD  --  the day log for a date.
 * POST /api/logs  --  upsert the day log (wake/sleep times, mood, energy, notes, etc.).
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { getDayLog, upsertDayLog, type DayLog } from "@/lib/nourish";
import { isoDateSchema, parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const logQuerySchema = z.object({ date: isoDateSchema });

const logInputSchema = z.object({
  date: isoDateSchema,
  wakeMinute: z.coerce.number().int().min(-720).max(2160).nullable().optional(),
  sleepMinute: z.coerce.number().int().min(-720).max(2160).nullable().optional(),
  sleepQuality: z.coerce.number().int().min(1).max(5).nullable().optional(),
  restingHr: z.coerce.number().int().min(20).max(250).nullable().optional(),
  mood: z.coerce.number().int().min(1).max(5).nullable().optional(),
  energy: z.coerce.number().int().min(1).max(5).nullable().optional(),
  hardTaskBeforeNoon: z.boolean().nullable().optional(),
  morningLight: z.boolean().nullable().optional(),
  notes: z.string().trim().max(2000).optional(),
  tomorrowIntention: z.string().trim().max(400).optional(),
});

export type LogResponse = { log: DayLog | null };
export type LogUpsertResponse = { log: DayLog };

export async function GET(request: NextRequest) {
  return guarded<LogResponse>(async () => {
    const parsed = parseSearchParams(logQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    return ok({ log: await getDayLog(parsed.data.date) });
  });
}

export async function POST(request: NextRequest) {
  return guarded<LogUpsertResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = logInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const { date, ...patch } = parsed.data;
    const log = await upsertDayLog(date, patch);
    return ok({ log });
  });
}
