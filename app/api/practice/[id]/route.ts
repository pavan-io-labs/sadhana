/**
 * DELETE /api/practice/[id]  --  remove a logged practice session.
 */

import { fail, guarded, ok } from "@/lib/api";
import { deletePractice } from "@/lib/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guarded<{ deleted: true }>(async () => {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) {
      return fail("Invalid practice id", 400);
    }
    const deleted = await deletePractice(numId);
    if (!deleted) return fail("Practice session not found", 404);
    return ok({ deleted: true as const });
  });
}
