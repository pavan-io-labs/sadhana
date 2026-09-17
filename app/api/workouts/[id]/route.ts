/**
 * PATCH /api/workouts/[id]  --  edit a logged session.
 * DELETE /api/workouts/[id]  --  remove it, and its sets with it.
 *
 * `date` and `sessionSlug` are not patchable, which `lib/validators` enforces by omitting them
 * before the partial. Moving a session to another day or relabelling which session it was would
 * rewrite the history the overload suggestion reads from underneath it; deleting and logging again
 * says the same thing out loud.
 *
 * A patch carrying `sets` replaces the whole list. That is what the logger sends  --  the session as
 * it now stands  --  and it is the only shape that cannot duplicate a set while the user is still
 * correcting one.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, guarded, invalid, ok, readJson } from "@/lib/api";
import { workoutPatchSchema } from "@/lib/validators";
import {
  deleteWorkout,
  getWorkout,
  updateWorkout,
  type WorkoutRecord,
  workoutsOn,
} from "@/lib/workouts";

import type { WorkoutListResponse } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.coerce.number().int().positive();

type Context = { params: Promise<{ id: string }> };

async function workoutId(context: Context): Promise<number | null> {
  const parsed = idSchema.safeParse((await context.params).id);
  return parsed.success ? parsed.data : null;
}

export async function PATCH(request: NextRequest, context: Context) {
  return guarded<WorkoutListResponse & { workout: WorkoutRecord }>(async () => {
    const id = await workoutId(context);
    if (id === null) return fail("Not a session id", 400, { id: ["Expected a positive integer"] });

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = workoutPatchSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);
    if (Object.keys(parsed.data).length === 0) {
      return fail("Some values need fixing", 422, { _: ["Nothing to update"] });
    }

    const workout = await updateWorkout(id, parsed.data);
    if (!workout) return fail("No such session", 404);

    return ok({ workout, workouts: await workoutsOn(workout.date) });
  });
}

export async function DELETE(_request: NextRequest, context: Context) {
  return guarded<WorkoutListResponse>(async () => {
    const id = await workoutId(context);
    if (id === null) return fail("Not a session id", 400, { id: ["Expected a positive integer"] });

    // Read the date before the row goes, so the response can carry that day's remaining sessions.
    const existing = await getWorkout(id);
    if (!existing) return fail("No such session", 404);

    const removed = await deleteWorkout(id);
    if (!removed) return fail("No such session", 404);

    return ok({ workouts: await workoutsOn(existing.date) });
  });
}
