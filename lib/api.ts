/**
 * Shared response shapes for the route handlers.
 *
 * Every endpoint answers in one of two envelopes  --  `{ ok: true, data }` or
 * `{ ok: false, error, fields? }`  --  so the client has exactly one thing to branch on and
 * validation failures can be rendered next to the input that caused them.
 *
 * Server-only.
 */

import { NextResponse } from "next/server";
import type { z } from "zod";

import { fieldErrors, type FieldErrors } from "./validators";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; fields?: FieldErrors };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export type JsonInit = {
  status?: number;
  /** Passed through verbatim; used for Cache-Control on deterministic endpoints. */
  headers?: Record<string, string>;
};

export function ok<T>(data: T, init: JsonInit = {}): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(
  error: string,
  status = 400,
  fields?: FieldErrors,
): NextResponse<ApiErr> {
  return NextResponse.json({ ok: false as const, error, ...(fields ? { fields } : {}) }, { status });
}

/** 422 with the field map Zod produced, which is what forms render against. */
export function invalid(error: z.ZodError, message = "Some values need fixing"): NextResponse<ApiErr> {
  return fail(message, 422, fieldErrors(error));
}

/**
 * `request.json()` that answers 400 rather than throwing on a malformed body.
 *
 * Returns a tagged result instead of the value itself, because `null` is a legal JSON
 * body and should reach the schema as `null` rather than look like a parse failure.
 */
export async function readJson(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse<ApiErr> }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, response: fail("Expected a JSON request body", 400) };
  }
}

/**
 * Wraps a handler so an unexpected throw becomes a 500 in the same envelope instead of
 * Next's HTML error page  --  which a `fetch` caller cannot parse.
 *
 * The message is included because this app runs on the user's own machine and a useful
 * error beats a generic one; nothing here is exposed to a third party.
 */
export async function guarded<T>(
  run: () => Promise<NextResponse<ApiResponse<T>>>,
): Promise<NextResponse<ApiResponse<T>>> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[sadhana] request failed:", error);
    return fail(`Something went wrong on the server: ${message}`, 500);
  }
}
