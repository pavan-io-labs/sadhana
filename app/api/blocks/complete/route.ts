/**
 * GET /api/blocks/complete  --  what was marked, for one date or a range.
 * POST /api/blocks/complete  --  mark a block, or unmark it.
 *
 * The tap on Today is the busiest write in the app, so the response is shaped for reconciling an
 * optimistic update: it carries the status the block now has  --  `null` when the mark was removed  -- 
 * and the whole map for that date, which is what the ring and the streak count read.
 *
 * Three modes, because a tap and a retry are different intentions. `toggle` is the tap: it sets
 * the status, or clears it when the block already carries exactly that status, so tapping a done
 * block undoes it. `set` is idempotent, which is what a retried request should be  --  a flaky
 * connection must not undo the mark it just made. `clear` is the explicit undo.
 *
 * Marking is deliberately not scoped to the active routine. A block belonging to a routine the
 * user has since switched away from can still be marked, because the mark is a record of what
 * happened on a date and the foreign key already guarantees the block exists.
 */

import type { NextRequest } from "next/server";

import { guarded, invalid, fail, ok, readJson } from "@/lib/api";
import {
  blockExists,
  clearCompletion,
  type CompletionCalendar,
  type CompletionMap,
  type CompletionStatus,
  completionsBetween,
  completionsOn,
  setCompletion,
  toggleCompletion,
} from "@/lib/blocks";
import { getSettings } from "@/lib/settings";
import { toISODate, todayInZone } from "@/lib/time";
import { completionInputSchema, completionQuerySchema, parseSearchParams } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CompletionsResponse = {
  /** The single date asked for, or the start of the range. */
  date: string;
  /** Present for a single-date read: that date's marks, keyed by block id. */
  completions: CompletionMap;
  /** Present only for a range read, keyed by date. Dates with no marks are absent. */
  calendar?: CompletionCalendar;
};

export type CompletionWriteResponse = {
  date: string;
  /** What the block now carries, or null when the mark was removed. */
  status: CompletionStatus | null;
  completions: CompletionMap;
};

export async function GET(request: NextRequest) {
  return guarded<CompletionsResponse>(async () => {
    const parsed = parseSearchParams(completionQuerySchema, request.nextUrl.searchParams);
    if (!parsed.success) return invalid(parsed.error);
    const query = parsed.data;

    // A range needs both ends. One alone is ambiguous  --  open-ended in which direction?  --  and
    // guessing would let a typo read the whole table.
    const hasFrom = query.from !== undefined;
    const hasTo = query.to !== undefined;
    if (hasFrom !== hasTo) {
      const missing = hasFrom ? "to" : "from";
      return fail("Some values need fixing", 422, {
        [missing]: ["Give both ends of the range, or neither"],
      });
    }

    if (query.from && query.to) {
      if (query.to < query.from) {
        return fail("Some values need fixing", 422, { to: ["The range ends before it starts"] });
      }
      return ok({
        date: query.from,
        completions: await completionsOn(query.from),
        calendar: await completionsBetween(query.from, query.to),
      });
    }

    const date = query.date ?? toISODate(todayInZone((await getSettings()).timeZone));
    return ok({ date, completions: await completionsOn(date) });
  });
}

export async function POST(request: NextRequest) {
  return guarded<CompletionWriteResponse>(async () => {
    const body = await readJson(request);
    if (!body.ok) return body.response;

    const parsed = completionInputSchema.safeParse(body.value);
    if (!parsed.success) return invalid(parsed.error);
    const { date, blockId, status, mode } = parsed.data;

    // A stale client marking a block that has since been deleted is ordinary; the foreign key
    // would make it a 500. Clearing needs no check  --  removing a mark that is not there is a no-op.
    if (mode !== "clear" && !(await blockExists(blockId))) {
      return fail("No such block", 404, { blockId: ["This block no longer exists"] });
    }

    let now: CompletionStatus | null;
    if (mode === "clear") {
      await clearCompletion(date, blockId);
      now = null;
    } else if (mode === "set") {
      now = await setCompletion(date, blockId, status);
    } else {
      now = await toggleCompletion(date, blockId, status);
    }

    return ok({ date, status: now, completions: await completionsOn(date) });
  });
}
