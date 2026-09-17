/**
 * POST /api/blocks/reorder  --  rewrite `sortOrder` from the order given.
 *
 * The editor sends the whole new order rather than one moved index, because a drag can move a
 * block past several others and a diff of two orderings is the server's least favourite thing to
 * reconstruct. Blocks the list forgets keep their relative order and land after the ones it
 * names, so a stale client cannot lose a block; an id belonging to no block of the routine
 * rejects the whole call, because that is a bug in the caller rather than something to tidy up.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, fail, ok, readJson } from "@/lib/api";
import { ensureRoutine, reorderBlocks } from "@/lib/blocks";
import { blockReorderSchema } from "@/lib/validators";

import { type BlockListResponse, routineSummary } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return guarded<BlockListResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = blockReorderSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const blocks = await reorderBlocks(parsed.data.ids);
    if (!blocks) {
      return fail("Some values need fixing", 422, {
        ids: ["One of these ids is not a block of the active routine"],
      });
    }

    const installed = await ensureRoutine();
    return ok({ routine: routineSummary(installed.routine), blocks });
  });
}
