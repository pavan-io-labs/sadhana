/**
 * POST /api/literature/save  --  save a paper to the local library.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { saveToLibrary } from "@/lib/literature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveSchema = z.object({
  source: z.enum(["europepmc", "crossref"]),
  doi: z.string().nullable().default(null),
  pmid: z.string().nullable().default(null),
  title: z.string().min(1),
  authors: z.string().default(""),
  journal: z.string().default(""),
  year: z.number().nullable().default(null),
  abstract: z.string().default(""),
  url: z.string().default(""),
  evidenceType: z.string().default("other"),
  isOpenAccess: z.boolean().default(false),
  citedByCount: z.number().nullable().default(null),
  cardIds: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  return guarded<{ saved: true }>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const parsed = saveSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);
    await saveToLibrary(parsed.data, parsed.data.cardIds);
    return ok({ saved: true as const }, { status: 201 });
  });
}
