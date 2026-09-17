/**
 * GET /api/routines  --  every routine in the database, and which one the day is built from.
 * POST /api/routines  --  point the day at another routine, or reinstall a shipped preset.
 *
 * The two POST shapes differ in consequence, which is why they are one endpoint with a
 * discriminating body rather than two verbs on the same noun. `{ routineId }` moves a pointer:
 * nothing is written except the settings row, and switching back restores exactly what was
 * there. `{ preset, replace: true }` rebuilds that preset's blocks from `data/routines.ts`,
 * **discarding the user's edits to it and  --  by cascade  --  every mark ever made against those
 * blocks.** The literal `true` is the wire refusing to carry the destructive call by accident;
 * the interface asks first, in those words.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, fail, ok, readJson } from "@/lib/api";
import { activateRoutine, ensureRoutine, installPreset, listRoutines } from "@/lib/blocks";
import type { Routine } from "@/lib/db/schema";
import type { ScheduleBlock } from "@/lib/schedule";
import { routineSelectSchema } from "@/lib/validators";

import { type RoutineSummary, routineSummary } from "../blocks/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type RoutinesResponse = {
  active: RoutineSummary;
  routines: Routine[];
};

export type RoutineSwitchResponse = {
  active: RoutineSummary;
  /** The newly active routine's blocks, so the editor can redraw without a second request. */
  blocks: ScheduleBlock[];
  routines: Routine[];
};

export async function GET() {
  return guarded<RoutinesResponse>(async () => {
    const installed = await ensureRoutine();
    return ok({ active: routineSummary(installed.routine), routines: await listRoutines() });
  });
}

export async function POST(request: NextRequest) {
  return guarded<RoutineSwitchResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = routineSelectSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);
    const choice = parsed.data;

    const installed =
      "routineId" in choice
        ? await activateRoutine(choice.routineId)
        : await installPreset(choice.preset);

    if (!installed) {
      return fail("No such routine", 404, { routineId: ["Nothing in the table carries that id"] });
    }

    return ok({
      active: routineSummary(installed.routine),
      blocks: installed.blocks,
      routines: await listRoutines(),
    });
  });
}
