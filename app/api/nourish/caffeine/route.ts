/**
 * POST /api/nourish/caffeine  --  log a caffeine dose.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { createCaffeine, nourishOn, type NourishDay } from "@/lib/nourish";
import { caffeineInputSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CaffeineCreateResponse = NourishDay & {
  caffeineDose: import("@/lib/db/schema").CaffeineLog;
};

export async function POST(request: NextRequest) {
  return guarded<CaffeineCreateResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = caffeineInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const caffeineDose = await createCaffeine(parsed.data);
    const day = await nourishOn(parsed.data.date);
    return ok({ caffeineDose, ...day }, { status: 201 });
  });
}
