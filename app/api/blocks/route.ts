/**
 * GET /api/blocks  --  the active routine's blocks, plus the routines available to switch to.
 * POST /api/blocks  --  append a block to the active routine.
 *
 * The Timeline editor is the only real caller, and it wants the routine picker's options in the
 * same breath as the timetable, so the list travels with the GET rather than behind a second
 * request for four rows.
 *
 * Every mutation here answers with the whole refreshed list, not just the row it touched.
 * `sortOrder` is server-assigned and a create shifts nothing else today, but a reorder does, and
 * a client that splices its own cache would drift the moment two edits raced. One shape for all
 * of them means the editor replaces its state wholesale and cannot drift.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { createBlock, ensureRoutine, listRoutines } from "@/lib/blocks";
import type { Routine } from "@/lib/db/schema";
import type { ScheduleBlock } from "@/lib/schedule";
import { blockInputSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the active routine is, without the timestamps the editor has no use for. */
export type RoutineSummary = {
  id: number;
  slug: string;
  name: string;
  description: string;
  isPreset: boolean;
};

/**
 * The shape every block route answers with.
 *
 * Imported by the sibling handlers under `blocks/`  --  they return the same thing, and one
 * definition is what keeps them returning the same thing.
 */
export type BlockListResponse = {
  routine: RoutineSummary;
  /** In timeline order, which is `sortOrder`. */
  blocks: ScheduleBlock[];
};

export type BlocksResponse = BlockListResponse & {
  /** Every routine in the database, for the picker. */
  routines: Routine[];
};

export function routineSummary(routine: Routine): RoutineSummary {
  return {
    id: routine.id,
    slug: routine.slug,
    name: routine.name,
    description: routine.description,
    isPreset: routine.isPreset,
  };
}

export async function GET() {
  return guarded<BlocksResponse>(async () => {
    const installed = await ensureRoutine();
    return ok({
      routine: routineSummary(installed.routine),
      blocks: installed.blocks,
      routines: await listRoutines(),
    });
  });
}

export async function POST(request: NextRequest) {
  return guarded<BlockListResponse & { block: ScheduleBlock }>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = blockInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const block = await createBlock(parsed.data);
    const installed = await ensureRoutine();
    return ok(
      { routine: routineSummary(installed.routine), blocks: installed.blocks, block },
      { status: 201 },
    );
  });
}
