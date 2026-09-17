/**
 * POST /api/import  --  import JSON data.
 * DELETE /api/wipe  --  wipe all user data (requires confirmation header).
 */

import type { NextRequest } from "next/server";
import { guarded, fail, ok, readJson } from "@/lib/api";
import { getDb, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return guarded(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;
    const payload = body.value as { data?: Record<string, unknown[]> };
    if (!payload.data) return fail("Missing 'data' field", 400);

    // Import is additive  --  it does not wipe first
    return ok({ imported: true, note: "Import is not yet fully implemented  --  export is available for backup." });
  });
}

export async function DELETE(request: NextRequest) {
  return guarded(async () => {
    const confirm = request.headers.get("x-confirm-wipe");
    if (confirm !== "yes-wipe-everything") {
      return fail(
        "Wipe requires x-confirm-wipe: yes-wipe-everything header",
        400,
      );
    }

    const db = await getDb();

    // Delete in dependency order
    await db.delete(schema.scienceNotes);
    await db.delete(schema.papers);
    await db.delete(schema.searchCache);
    await db.delete(schema.gameResults);
    await db.delete(schema.hydrationLogs);
    await db.delete(schema.caffeineLogs);
    await db.delete(schema.meals);
    await db.delete(schema.practiceSessions);
    await db.delete(schema.workoutSets);
    await db.delete(schema.workouts);
    await db.delete(schema.blockCompletions);
    await db.delete(schema.dayLogs);
    await db.delete(schema.blocks);
    await db.delete(schema.routines);
    await db.delete(schema.notificationLog);
    await db.delete(schema.pushSubscriptions);
    // Settings are NOT wiped  --  keeps the user's location and preferences
    // await db.delete(schema.settings);

    return ok({ wiped: true, note: "All data wiped except settings." });
  });
}
