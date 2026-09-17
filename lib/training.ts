/**
 * Training arithmetic: what to load, which week it is, and what a session came to.
 *
 * Pure and DB-free, so the same functions answer for a set the user is typing and for a row read
 * back out of SQLite. Three ideas live here.
 *
 * **The overload suggestion.** "Add 2.5 kg once you have hit every prescribed rep" is a rule that
 * only means something if it is applied consistently, which is exactly what a person doing it from
 * memory in a noisy gym does not do. So it is computed: the last session's *working* sets for that
 * movement, all at one weight, all reaching the top of the range  --  then the suggestion, with the
 * reason and the number it came from. Anything short of that holds the weight and says which set
 * fell short, because "hold" with evidence is a decision and "hold" alone is a shrug.
 *
 * **Failing closed.** No history, a movement with no rep target, a set logged without reps: every
 * one of those returns something other than an increase. A wrong suggestion here costs a missed
 * rep at best and a strain at worst, so the ambiguous cases decline to advise.
 *
 * **The mesocycle.** `weekInCycle` is the single definition of "which week of the track is this",
 * used by `lib/rules.ts` for the deload banner and by the Train view for the session header. Two
 * copies of that formula would eventually disagree by a day and there would be no way to tell
 * which was right.
 */

import { type Exercise, type Session, sessionsForTrack } from "@/data/exercises";
import { maskHas } from "@/lib/schedule";
import { type CalendarDate, daysBetween, weekdayOf } from "@/lib/time";
import type { TrackId } from "@/lib/validators";

/* -------------------------------------------------------------------- the set */

/**
 * One logged set, in the shape both the form and the `workout_sets` row have.
 *
 * Every measurement is nullable because the four measures use different ones: a squat has reps
 * and weight, a plank has held seconds, a walk has neither. `completed: false` is how a set that
 * was planned and abandoned is recorded  --  it stays visible in the log but counts for nothing.
 */
export type LoggedSet = {
  exerciseSlug: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  holdSeconds: number | null;
  rpe: number | null;
  isWarmup: boolean;
  completed: boolean;
};

/** The sets that count towards a suggestion: done, and not a warm-up. */
export function workingSets(sets: readonly LoggedSet[]): LoggedSet[] {
  return sets.filter((set) => set.completed && !set.isWarmup);
}

/* ------------------------------------------------------------------ the volume */

export type SessionVolume = {
  /** Working sets only  --  warm-ups are work, but they are not the dose. */
  sets: number;
  reps: number;
  /** Sum of reps × kg over the working sets. The one number that compares two sessions. */
  tonnageKg: number;
  holdSeconds: number;
  /** Mean RPE across the sets that carried one, or `null` if none did. */
  meanRpe: number | null;
};

/**
 * What a session came to.
 *
 * Tonnage rather than "sets × reps" because load is the variable the programme moves: three sets
 * of eight at 40 kg and three of eight at 60 are the same on a set count and half a session apart
 * in reality. Sets without a weight contribute reps and no tonnage, which is the honest answer for
 * a push-up rather than a guess at bodyweight.
 */
export function sessionVolume(sets: readonly LoggedSet[]): SessionVolume {
  const working = workingSets(sets);
  let reps = 0;
  let tonnageKg = 0;
  let holdSeconds = 0;
  let rpeTotal = 0;
  let rpeCount = 0;

  for (const set of working) {
    if (set.reps !== null) reps += set.reps;
    if (set.reps !== null && set.weightKg !== null) tonnageKg += set.reps * set.weightKg;
    if (set.holdSeconds !== null) holdSeconds += set.holdSeconds;
    if (set.rpe !== null) {
      rpeTotal += set.rpe;
      rpeCount += 1;
    }
  }

  return {
    sets: working.length,
    reps,
    tonnageKg: Math.round(tonnageKg * 10) / 10,
    holdSeconds,
    meanRpe: rpeCount === 0 ? null : Math.round((rpeTotal / rpeCount) * 10) / 10,
  };
}

/* ---------------------------------------------------------------- the mesocycle */

/**
 * Which week of the track this date falls in, counting the start date as week 1.
 *
 * `null` when there is no start date  --  the state until a track is chosen  --  and `null` for a start
 * date in the future, which is a typo rather than week zero. Both cases mean "say nothing", which
 * is why they share a return value.
 */
export function weekInCycle(startedOn: CalendarDate | null, date: CalendarDate): number | null {
  if (startedOn === null) return null;
  const days = daysBetween(startedOn, date);
  if (days < 0) return null;
  return Math.floor(days / 7) + 1;
}

/**
 * Every fourth week. Three hard weeks is about as long as recovery keeps up with the load.
 *
 * A type predicate so a caller that has checked it can use the number in a sentence  --  the deload
 * banner in `lib/rules.ts` needs both the fact and the week it is naming.
 */
export function isDeloadWeek(week: number | null): week is number {
  return week !== null && week % 4 === 0;
}

/** The week label the Train header shows: "Week 3" or "Week 4 · deload". */
export function describeWeek(week: number | null): string | null {
  if (week === null) return null;
  return isDeloadWeek(week) ? `Week ${week} · deload` : `Week ${week}`;
}

/**
 * The set count a deload week asks for: roughly 60% of the prescribed volume, never below one.
 *
 * Volume comes down and intensity stays where it is  --  fewer sets of the same weight, not the same
 * sets done badly. Rounding up on the halves keeps a three-set exercise at two rather than one,
 * which is the difference between a lighter week and a week off.
 */
export function deloadSets(prescribed: number): number {
  return Math.max(1, Math.round(prescribed * 0.6));
}

/* ------------------------------------------------------------- the suggestion */

/**
 * What to put on the bar, and why.
 *
 * A discriminated union rather than a number and a note, because the five answers want different
 * things on screen: an increase needs the weight it came from to be believable, a hold needs the
 * set that fell short, and a movement that does not take load needs no number at all. Making that
 * a `weightKg: number | null` plus prose would let the view render "hold at null kg".
 */
export type LoadSuggestion =
  /** No history for this movement. The prescription is the instruction; the log starts today. */
  | { kind: "start"; reason: string }
  | { kind: "increase"; weightKg: number; fromKg: number; stepKg: number; reason: string }
  | { kind: "hold"; weightKg: number; reason: string }
  /** Same weight, fewer sets  --  a deload week moves volume, not intensity. */
  | { kind: "deload"; weightKg: number; sets: number; reason: string }
  /** Bodyweight, a hold, a walk: progress is reps or time, and the app does not invent a load. */
  | { kind: "not-loaded"; reason: string };

export type SuggestOptions = {
  /** True in week 4. Suppresses every increase, whatever last week's sets looked like. */
  isDeload?: boolean;
};

/**
 * The load for the next session of one movement, from the last session's sets for it.
 *
 * The rule in one line: same movement, same weight on every working set, every one of them at the
 * top of the prescribed range  --  then add the step. Each clause is a way the suggestion can be
 * wrong, so each is checked and each has its own sentence when it fails.
 *
 * `lastSets` must be one session's sets for one exercise; the caller pulls them, because "the last
 * session" is a database question and this file does not ask those.
 */
export function suggestLoad(
  exercise: Exercise,
  lastSets: readonly LoggedSet[],
  options: SuggestOptions = {},
): LoadSuggestion {
  if (!exercise.progresses || exercise.measure !== "weight") {
    return {
      kind: "not-loaded",
      reason: `${exercise.name} progresses by ${exercise.measure === "hold" ? "time held" : "reps"}, not load  --  ${exercise.prescription}.`,
    };
  }

  const working = workingSets(lastSets).filter((set) => set.exerciseSlug === exercise.slug);
  if (working.length === 0) {
    return {
      kind: "start",
      reason: `First logged session for ${exercise.name}. Pick a weight you could lift two more times than asked, and the suggestion takes over next week.`,
    };
  }

  const weights = working.map((set) => set.weightKg);
  const first = weights[0];
  if (first === null || first === undefined) {
    return {
      kind: "start",
      reason: `Last session's sets for ${exercise.name} were logged without a weight, so there is nothing to add to.`,
    };
  }
  const weightKg = first;

  if (weights.some((value) => value !== weightKg)) {
    return {
      kind: "hold",
      weightKg,
      reason: `Last session used more than one weight for ${exercise.name}. Hold at ${weightKg} kg for every working set, then the range applies.`,
    };
  }

  if (options.isDeload === true) {
    return {
      kind: "deload",
      weightKg,
      sets: deloadSets(exercise.sets),
      reason: `Deload week: ${deloadSets(exercise.sets)} sets instead of ${exercise.sets}, same ${weightKg} kg. Volume comes down, intensity stays.`,
    };
  }

  if (exercise.repTarget === null) {
    return {
      kind: "hold",
      weightKg,
      reason: `${exercise.prescription} has no fixed rep to beat, so the increase is your call rather than the app's.`,
    };
  }
  const repTarget = exercise.repTarget;

  const short = working.find((set) => set.reps === null || set.reps < repTarget);
  if (short !== undefined) {
    const got = short.reps === null ? "no reps logged" : `${short.reps} reps`;
    return {
      kind: "hold",
      weightKg,
      reason: `Set ${short.setIndex + 1} came to ${got} against ${repTarget}. Hold ${weightKg} kg until every working set reaches the top of the range.`,
    };
  }

  const next = Math.round((weightKg + exercise.stepKg) * 100) / 100;
  return {
    kind: "increase",
    weightKg: next,
    fromKg: weightKg,
    stepKg: exercise.stepKg,
    reason: `All ${working.length} working sets hit ${repTarget} at ${weightKg} kg last session, so add ${exercise.stepKg} kg.`,
  };
}

/** The one-line version for a card, without the reasoning. */
export function describeSuggestion(suggestion: LoadSuggestion): string {
  switch (suggestion.kind) {
    case "start":
      return "Set your starting weight";
    case "increase":
      return `${suggestion.weightKg} kg  --  up ${suggestion.stepKg}`;
    case "hold":
      return `${suggestion.weightKg} kg  --  hold`;
    case "deload":
      return `${suggestion.weightKg} kg × ${suggestion.sets} sets`;
    case "not-loaded":
      return "No load to suggest";
  }
}

/* ----------------------------------------------------------------- the calendar */

/**
 * The sessions this track puts on this date.
 *
 * Usually one. Two on the days a track schedules both Surya Namaskar and a lift, which is the
 * normal shape of the hardcore week rather than an edge case  --  so the Train view lists sessions
 * instead of assuming a single one.
 */
export function sessionsOnDate(date: CalendarDate, track: TrackId): readonly Session[] {
  const weekday = weekdayOf(date);
  return sessionsForTrack(track).filter((session) => maskHas(session.weekdayMask, weekday));
}


