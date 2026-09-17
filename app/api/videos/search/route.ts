/**
 * GET /api/videos/search?q=meditation&tag=pranayama  --  search the curated video library.
 *
 * Filters by text query and/or tag. Returns matching videos sorted by evidence tier.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, ok, invalid } from "@/lib/api";
import { VIDEOS, type Video } from "@/data/videos";
import { parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const TIER_ORDER: Record<string, number> = { strong: 0, moderate: 1, weak: 2, traditional: 3 };

export async function GET(request: NextRequest) {
  return guarded(async () => {
    const parsed = parseSearchParams(querySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);

    const { q, tag, limit } = parsed.data;
    let results: Video[] = [...VIDEOS];

    // Filter by tag
    if (tag) {
      results = results.filter((v) => v.tags.includes(tag));
    }

    // Filter by query (search title and description)
    if (q) {
      const lower = q.toLowerCase();
      results = results.filter(
        (v) =>
          v.title.toLowerCase().includes(lower) ||
          v.description.toLowerCase().includes(lower) ||
          v.tags.some((t) => t.includes(lower)),
      );
    }

    // Sort by evidence tier
    results.sort(
      (a, b) => (TIER_ORDER[a.tier] ?? 4) - (TIER_ORDER[b.tier] ?? 4),
    );

    return ok({ videos: results.slice(0, limit), total: results.length });
  });
}
