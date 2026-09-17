/**
 * GET /api/literature/search  --  proxied scholarly search.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, invalid, ok } from "@/lib/api";
import { searchLiterature, type LitResult } from "@/lib/literature";
import { parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const searchSchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  filter: z.enum(["meta-analysis", "systematic-review", "rct", "clinical-trial", "review", "other"]).optional(),
});

export type LitSearchResponse = { results: LitResult[] };

export async function GET(request: NextRequest) {
  return guarded<LitSearchResponse>(async () => {
    const parsed = parseSearchParams(searchSchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    const results = await searchLiterature(parsed.data.q, {
      limit: parsed.data.limit,
      filter: parsed.data.filter,
    });
    return ok({ results });
  });
}
