/**
 * Reading and writing game results.
 *
 * The Mind Gym stores one row per session: the game id, the date, and a typed
 * metrics bag (see `lib/scoring` for the shape per game). Practice runs are
 * stored but excluded from trend charts  --  they exist so the user can see their
 * warm-up without it dragging down their real scores.
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";

import { getDb, schema } from "./db";
import type { GameId, GameResult } from "./db/schema";

export type { GameId, GameResult };

export type GameInput = {
  date: string;
  game: GameId;
  atMinute?: number | null;
  durationSeconds: number;
  primaryMetric: number | null;
  metrics: Record<string, number | null>;
  isPractice?: boolean;
  notes?: string;
};

export type GameQuery = {
  game?: GameId;
  date?: string;
  from?: string;
  to?: string;
  includePractice?: boolean;
  limit?: number;
};

/* ------------------------------------------------------------------- reading */

export async function listGames(query: GameQuery = {}): Promise<GameResult[]> {
  const db = await getDb();
  const filters = [];
  if (query.game !== undefined) filters.push(eq(schema.gameResults.game, query.game));
  if (query.date !== undefined) filters.push(eq(schema.gameResults.date, query.date));
  if (query.from !== undefined) filters.push(gte(schema.gameResults.date, query.from));
  if (query.to !== undefined) filters.push(lte(schema.gameResults.date, query.to));
  if (!query.includePractice) filters.push(eq(schema.gameResults.isPractice, false));

  return db
    .select()
    .from(schema.gameResults)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.gameResults.date), desc(schema.gameResults.id))
    .limit(query.limit ?? 50);
}

export async function getGame(id: number): Promise<GameResult | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.gameResults)
    .where(eq(schema.gameResults.id, id));
  return row ?? null;
}

/** Latest result for one game, for the hub card. */
export async function latestResult(game: GameId): Promise<GameResult | null> {
  const results = await listGames({ game, limit: 1 });
  return results[0] ?? null;
}

/** Trend data for one game  --  last N results in chronological order. */
export async function gameTrend(game: GameId, limit = 30): Promise<GameResult[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.gameResults)
    .where(
      and(
        eq(schema.gameResults.game, game),
        eq(schema.gameResults.isPractice, false),
      ),
    )
    .orderBy(desc(schema.gameResults.date), desc(schema.gameResults.id))
    .limit(limit);
  return rows.reverse(); // chronological for charting
}

/* ------------------------------------------------------------------- writing */

export async function createGameResult(input: GameInput): Promise<GameResult> {
  const db = await getDb();
  const [row] = await db
    .insert(schema.gameResults)
    .values({
      date: input.date,
      game: input.game,
      atMinute: input.atMinute ?? null,
      durationSeconds: input.durationSeconds,
      primaryMetric: input.primaryMetric,
      metrics: input.metrics,
      isPractice: input.isPractice ?? false,
      notes: input.notes ?? "",
    })
    .returning();
  if (!row) throw new Error("The game result insert returned no row");
  return row;
}

export async function deleteGameResult(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(schema.gameResults)
    .where(eq(schema.gameResults.id, id))
    .returning({ id: schema.gameResults.id });
  return rows.length > 0;
}
