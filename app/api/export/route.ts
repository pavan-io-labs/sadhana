/**
 * GET /api/export  --  full JSON export of all user data.
 */

import { guarded, ok } from "@/lib/api";
import { getDb, schema } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(async () => {
    const db = await getDb();
    const data: Record<string, unknown[]> = {};

    // Export all tables
    data.settings = await db.select().from(schema.settings);
    data.routines = await db.select().from(schema.routines);
    data.blocks = await db.select().from(schema.blocks);
    data.dayLogs = await db.select().from(schema.dayLogs);
    data.blockCompletions = await db.select().from(schema.blockCompletions);
    data.workouts = await db.select().from(schema.workouts);
    data.workoutSets = await db.select().from(schema.workoutSets);
    data.practiceSessions = await db.select().from(schema.practiceSessions);
    data.meals = await db.select().from(schema.meals);
    data.caffeineLogs = await db.select().from(schema.caffeineLogs);
    data.hydrationLogs = await db.select().from(schema.hydrationLogs);
    data.gameResults = await db.select().from(schema.gameResults);
    data.papers = await db.select().from(schema.papers);
    data.scienceNotes = await db.select().from(schema.scienceNotes);

    return ok({
      exportedAt: new Date().toISOString(),
      version: "1.0",
      data,
    });
  });
}
