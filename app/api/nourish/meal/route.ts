/**
 * POST /api/nourish/meal  --  log a meal.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { createMeal, nourishOn, type NourishDay } from "@/lib/nourish";
import { mealInputSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type MealCreateResponse = NourishDay & { meal: import("@/lib/db/schema").Meal };

export async function POST(request: NextRequest) {
  return guarded<MealCreateResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = mealInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const meal = await createMeal(parsed.data);
    const day = await nourishOn(parsed.data.date);
    return ok({ meal, ...day }, { status: 201 });
  });
}
