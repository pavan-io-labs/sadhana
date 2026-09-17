/**
 * The assistant's server side: everything the rules engine needs, gathered once.
 *
 * `lib/rules.ts` is pure and knows nothing about the database  --  which is what makes it
 * testable, but also means somebody has to do the gathering. This module is that seam. It
 * reads the settings row and the active routine, builds the plan, resolves the day, runs the
 * engine, and returns the lot as one object.
 *
 * Every surface that judges a day goes through here  --  Today now, the briefing in Phase 5  --  so
 * the two voices are guaranteed to be reading the same day rather than each assembling their
 * own and disagreeing at the edges.
 *
 * The three gated rules stay quiet for the moment because the tables they read do not exist
 * yet: `logs` arrives with the day log and `caffeine` with Nourish. Adding them is a change to
 * `contextFor` below and to nothing else  --  `lib/rules.ts` already handles their absence, and
 * `tests/rules.test.ts` already covers both states.
 *
 * Server-only: it touches the database.
 */

import { type CompletionMap, completionsOn, ensureRoutine } from "./blocks";
import { buildDayPlan, type DayPlan } from "./day";
import { type Advisory, evaluateRules, type RuleContext } from "./rules";
import { resolveDay, type ResolvedDay } from "./schedule";
import { dayInputFromSettings, renderSettings } from "./settings";
import { type CalendarDate, toISODate, todayInZone } from "./time";

/** Which routine answered, without the blocks  --  the header needs the name, not the timetable. */
export type RoutineLabel = {
  id: number;
  slug: string;
  name: string;
  isPreset: boolean;
};

/** One day, assembled: the astronomy, the timetable, what was marked, and what the engine says. */
export type DayView = {
  /** ISO date in the user's zone. */
  date: string;
  plan: DayPlan;
  day: ResolvedDay;
  routine: RoutineLabel;
  completions: CompletionMap;
  advisories: Advisory[];
  /** For the client components that need to place "now" on the user's clock, not the browser's. */
  timeZone: string;
  clock24h: boolean;
};

/**
 * The rule context for a resolved day.
 *
 * Split out from `loadDay` so a caller that has already resolved a day  --  the timeline editor
 * previewing an edit, say  --  can ask the engine about it without a second round of queries.
 */
export function contextFor(
  plan: DayPlan,
  day: ResolvedDay,
  track: RuleContext["track"],
): RuleContext {
  return { plan, day, track };
}

/**
 * Everything Today needs, in one call.
 *
 * `ensureRoutine` rather than `activeRoutine`: a database that has never had a routine
 * installed gets the default one here, so the first page load draws a timetable instead of an
 * empty frame. Both it and `renderSettings` are request-memoised, so calling this from a page
 * that also reads settings costs one query each.
 */
export async function loadDay(now: Date = new Date()): Promise<DayView> {
  const settings = await renderSettings();
  const date = todayInZone(settings.timeZone, now);

  return viewOf(date, settings);
}

/** The same assembly for a named date, which the week strip and the briefing both want. */
export async function loadDayOn(date: CalendarDate): Promise<DayView> {
  return viewOf(date, await renderSettings());
}

async function viewOf(
  date: CalendarDate,
  settings: Awaited<ReturnType<typeof renderSettings>>,
): Promise<DayView> {
  const iso = toISODate(date);
  const plan = buildDayPlan(date, dayInputFromSettings(settings));
  const routine = await ensureRoutine();
  const day = resolveDay(plan, routine.blocks);

  const advisories = evaluateRules(
    contextFor(plan, day, { id: settings.activeTrack, startedOn: settings.trackStartedOn }),
  );

  return {
    date: iso,
    plan,
    day,
    routine: {
      id: routine.routine.id,
      slug: routine.routine.slug,
      name: routine.routine.name,
      isPreset: routine.routine.isPreset,
    },
    completions: await completionsOn(iso),
    advisories,
    timeZone: settings.timeZone,
    clock24h: settings.clock24h,
  };
}
