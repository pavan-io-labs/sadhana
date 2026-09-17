/**
 * GET  /api/games  --  list game results (filtered by game/date/range).
 * POST /api/games  --  log a completed game session.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { guarded, invalid, ok, readJson } from "@/lib/api";
import { createGameResult, listGames, type GameResult } from "@/lib/games";
import { isoDateSchema, parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const gameIdSchema = z.enum(["pvt", "stroop", "nback", "gonogo", "digit-span", "corsi", "insight"]);

const gameQuerySchema = z.object({
  game: gameIdSchema.optional(),
  date: isoDateSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  includePractice: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(false)
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const gameInputSchema = z.object({
  date: isoDateSchema,
  game: gameIdSchema,
  atMinute: z.coerce.number().int().min(-720).max(2160).nullable().optional(),
  durationSeconds: z.coerce.number().int().min(0).max(7200).default(0),
  primaryMetric: z.coerce.number().nullable().default(null),
  metrics: z.record(z.string(), z.number().nullable()).default({}),
  isPractice: z.boolean().default(false),
  notes: z.string().trim().max(1000).default(""),
});

export type GamesListResponse = { results: GameResult[] };
export type GameCreateResponse = { result: GameResult };

export async function GET(request: NextRequest) {
  return guarded<GamesListResponse>(async () => {
    const parsed = parseSearchParams(gameQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    return ok({ results: await listGames(parsed.data) });
  });
}

export async function POST(request: NextRequest) {
  return guarded<GameCreateResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = gameInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);

    const result = await createGameResult(parsed.data);
    return ok({ result }, { status: 201 });
  });
}
