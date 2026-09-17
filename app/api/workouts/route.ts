/**
 * GET /api/workouts  --  logged sessions, newest first, filtered by date, range or movement.
 * POST /api/workouts  --  log a session and its sets in one request.
 *
 * The Train page reads its own data on the server, so this route exists for the logger's writes
 * and for the history the overload card asks about after a save. Like the block routes it answers
 * with more than the row it touched: a POST returns the created session *and* that date's list, so
 * the view can replace its state instead of splicing a record into it.
 *
 * A session arrives whole. `lib/workouts.ts` explains why in more detail, but the short version is
 * that `suggestLoad` reads every working set of the last session and a half-written one would make
 * it confidently wrong.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { parseSearchParams, workoutInputSchema, workoutQuerySchema } from "@/lib/validators";
import { createWorkout, listWorkouts, type WorkoutRecord, workoutsOn } from "@/lib/workouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type WorkoutListResponse = {
  workouts: WorkoutRecord[];
};

export type WorkoutCreateResponse = WorkoutListResponse & {
  workout: WorkoutRecord;
};

export async function GET(request: NextRequest) {
  return guarded<WorkoutListResponse>(async () => {
    const parsed = parseSearchParams(workoutQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    return ok({ workouts: await listWorkouts(parsed.data) });
  });
}

export async function POST(request: NextRequest) {
  return guarded<WorkoutCreateResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = workoutInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const workout = await createWorkout(parsed.data);
    return ok({ workout, workouts: await workoutsOn(parsed.data.date) }, { status: 201 });
  });
}
