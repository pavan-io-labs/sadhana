/**
 * GET  /api/practice  --  list sessions, filtered by date/range/kind.
 * POST /api/practice  --  log a finished practice.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { createPractice, listPractice, practiceOn, type PracticeSession } from "@/lib/practice";
import { parseSearchParams, practiceInputSchema, practiceQuerySchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type PracticeListResponse = { sessions: PracticeSession[] };
export type PracticeCreateResponse = PracticeListResponse & { session: PracticeSession };

export async function GET(request: NextRequest) {
  return guarded<PracticeListResponse>(async () => {
    const parsed = parseSearchParams(practiceQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    return ok({ sessions: await listPractice(parsed.data) });
  });
}

export async function POST(request: NextRequest) {
  return guarded<PracticeCreateResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = practiceInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const session = await createPractice(parsed.data);
    return ok(
      { session, sessions: await practiceOn(parsed.data.date) },
      { status: 201 },
    );
  });
}
