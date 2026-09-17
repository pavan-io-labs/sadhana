/**
 * POST /api/blocks/enabled  --  turn several blocks on or off at once.
 *
 * Disabling is the non-destructive counterpart to deleting: the row stays, its marks stay, and
 * the resolver simply stops placing it. That makes it the right answer for "not this month"
 * and for trimming a preset down to what someone will actually do, and it is why the editor
 * offers it wherever it offers a delete.
 *
 * `matched` is how many rows the update actually touched. It can be lower than `ids.length`
 * when an id names a block of another routine, which is not an error  --  the write is scoped, and
 * the refreshed list that comes back is the answer to what the routine now looks like.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { ensureRoutine, setBlocksEnabled } from "@/lib/blocks";
import { blockEnableSchema } from "@/lib/validators";

import { type BlockListResponse, routineSummary } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return guarded<BlockListResponse & { matched: number }>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = blockEnableSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const matched = await setBlocksEnabled(parsed.data.ids, parsed.data.enabled);
    const installed = await ensureRoutine();
    return ok({
      routine: routineSummary(installed.routine),
      blocks: installed.blocks,
      matched,
    });
  });
}
