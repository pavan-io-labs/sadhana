/**
 * GET    /api/games/[id]  --  one game result.
 * DELETE /api/games/[id]  --  remove a game result.
 */

import { fail, guarded, ok } from "@/lib/api";
import { deleteGameResult, getGame, type GameResult } from "@/lib/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return guarded<{ result: GameResult }>(async () => {
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId < 1) return fail("Invalid id", 400);
    const result = await getGame(numId);
    if (!result) return fail("Game result not found", 404);
    return ok({ result });
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
    const deleted = await deleteGameResult(numId);
    if (!deleted) return fail("Game result not found", 404);
    return ok({ deleted: true as const });
  });
}
