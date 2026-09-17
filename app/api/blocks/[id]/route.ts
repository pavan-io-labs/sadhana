/**
 * PATCH /api/blocks/[id]  --  edit one block of the active routine.
 * DELETE /api/blocks/[id]  --  remove it, and with it every mark ever made against it.
 *
 * Both are scoped to the active routine by `lib/blocks.ts`, so an id belonging to a routine the
 * user is not looking at is a 404 rather than a silent edit of a timetable off screen.
 *
 * The delete is the destructive one: `blockCompletions.blockId` cascades, so the adherence
 * history for that block goes with it. The editor asks before calling this, and offers disabling
 *  --  which keeps both the row and its past  --  as the alternative.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, invalid, fail, ok, readJson } from "@/lib/api";
import { deleteBlock, ensureRoutine, updateBlock } from "@/lib/blocks";
import type { ScheduleBlock } from "@/lib/schedule";
import { blockPatchSchema } from "@/lib/validators";

import { type BlockListResponse, routineSummary } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The path segment is a string; this is the only place it stops being one. */
const idSchema = z.coerce.number().int().positive();

type Context = { params: Promise<{ id: string }> };

async function blockId(context: Context): Promise<number | null> {
  const parsed = idSchema.safeParse((await context.params).id);
  return parsed.success ? parsed.data : null;
}

/** The refreshed list, read once after the write so the editor can replace its state. */
async function listAfterWrite(): Promise<BlockListResponse> {
  const installed = await ensureRoutine();
  return { routine: routineSummary(installed.routine), blocks: installed.blocks };
}

export async function PATCH(request: NextRequest, context: Context) {
  return guarded<BlockListResponse & { block: ScheduleBlock }>(async () => {
    const id = await blockId(context);
    if (id === null) return fail("Not a block id", 400, { id: ["Expected a positive integer"] });

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = blockPatchSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);
    if (Object.keys(parsed.data).length === 0) {
      return fail("Some values need fixing", 422, { _: ["Nothing to update"] });
    }

    const block = await updateBlock(id, parsed.data);
    if (!block) return fail("No such block on this routine", 404);

    return ok({ ...(await listAfterWrite()), block });
  });
}

export async function DELETE(_request: NextRequest, context: Context) {
  return guarded<BlockListResponse>(async () => {
    const id = await blockId(context);
    if (id === null) return fail("Not a block id", 400, { id: ["Expected a positive integer"] });

    const removed = await deleteBlock(id);
    if (!removed) return fail("No such block on this routine", 404);

    return ok(await listAfterWrite());
  });
}
