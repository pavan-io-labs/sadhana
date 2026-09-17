/**
 * DELETE /api/nourish/caffeine/[id]  --  remove a logged caffeine dose.
 */

import { fail, guarded, ok } from "@/lib/api";
import { deleteCaffeine } from "@/lib/nourish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guarded<{ deleted: true }>(async () => {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) return fail("Invalid id", 400);
    const deleted = await deleteCaffeine(numId);
    if (!deleted) return fail("Caffeine dose not found", 404);
    return ok({ deleted: true as const });
  });
}
