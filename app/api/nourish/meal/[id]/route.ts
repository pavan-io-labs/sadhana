/**
 * PATCH /api/nourish/meal/[id]  --  edit a logged meal.
 * DELETE /api/nourish/meal/[id]  --  remove a logged meal.
 */

import { fail, guarded, invalid, ok, readJson } from "@/lib/api";
import { deleteMeal, updateMeal, type Meal } from "@/lib/nourish";
import { mealPatchSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guarded<{ meal: Meal }>(async () => {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) return fail("Invalid id", 400);

    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = mealPatchSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const meal = await updateMeal(numId, parsed.data);
    if (!meal) return fail("Meal not found", 404);
    return ok({ meal });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guarded<{ deleted: true }>(async () => {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) return fail("Invalid id", 400);
    const deleted = await deleteMeal(numId);
    if (!deleted) return fail("Meal not found", 404);
    return ok({ deleted: true as const });
  });
}
