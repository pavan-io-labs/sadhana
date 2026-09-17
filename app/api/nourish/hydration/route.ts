/**
 * POST /api/nourish/hydration  --  set or increment the day's water.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { upsertHydration, type HydrationLog } from "@/lib/nourish";
import { hydrationInputSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type HydrationResponse = { hydration: HydrationLog };

export async function POST(request: NextRequest) {
  return guarded<HydrationResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = hydrationInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const hydration = await upsertHydration(parsed.data);
    return ok({ hydration });
  });
}
