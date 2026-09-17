/**
 * The rules engine  --  the app's first assistive voice.
 *
 * Pure and declarative: a rule sees a `RuleContext` and returns advisories or nothing. No React,
 * no database, no clock of its own. That is what makes every rule testable against a crafted
 * fixture, and it is why the engine can run on the server for Today and again in the browser as
 * the Timeline editor is dragged.
 *
 * Three properties are deliberate:
 *
 *  - **Silence beats guessing.** A rule that needs data the app has not collected yet returns
 *    nothing rather than assuming a default. Three of the ten below are gated this way, and they
 *    switch on by themselves once Nourish and the day log are recording.
 *  - **Every claim carries its citation.** `scienceIds` point into the evidence cards, so an
 *    advisory can be inspected rather than believed. The one rule with no citation is the overlap
 *    check, because "these two blocks collide" is arithmetic, not a health claim.
 *  - **A fix is a request body.** `AdvisoryFix` holds exactly the patch the client would send, so
 *    the one-tap correction is type-checked against the same schema the route validates.
 *
 * Three evidence ids cited here are not yet in `data/`: `fasted-training`,
 * `pranayama-empty-stomach` and `resting-hr-recovery`. Phase 4 defines them along with the
 * ~34 the presets already reference, and the test there asserts that every referenced id
 * resolves  --  including these.
 */

import type { DayPlan } from "./day";
import type { ResolvedBlock, ResolvedDay } from "./schedule";
import { formatDuration, parseISODate, weekdayOf } from "./time";
import { isDeloadWeek, weekInCycle } from "./training";
import type { BlockDraft, BlockPatch, SettingsPatch, TrackId } from "./validators";

/* ------------------------------------------------------------ what a rule says */

/**
 * How loudly to say it.
 *
 * `critical` is reserved for the two things that undo most of the routine's value  --  no daylight
 * after waking, and eating essentially at bedtime. Inflating severity is how an advisory panel
 * becomes something users learn to ignore.
 */
export type Severity = "critical" | "warning" | "advisory";

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, advisory: 2 };

/**
 * The one-tap correction, shaped as the request the client would send anyway.
 *
 * `navigate` is the honest option when there is no mechanical fix  --  a caffeine already drunk
 * cannot be un-drunk, and which of two colliding blocks should move is the user's call.
 */
export type AdvisoryFix =
  | { kind: "settings"; label: string; patch: SettingsPatch }
  | { kind: "block"; label: string; blockId: number; patch: BlockPatch }
  | { kind: "addBlock"; label: string; block: BlockDraft }
  | { kind: "navigate"; label: string; href: string };

export type Advisory = {
  /** Stable across renders, and unique per firing  --  suffixed with the block it is about. */
  id: string;
  /** Which rule produced it, so the interface can group and the user can mute a whole rule. */
  rule: string;
  severity: Severity;
  /** The finding, in one line. */
  message: string;
  /** The mechanism, in one or two sentences. Why this is worth a line of screen. */
  why: string;
  /** Evidence card ids. Empty only where the finding is arithmetic rather than a health claim. */
  scienceIds: string[];
  fix?: AdvisoryFix;
};

/* ----------------------------------------------------------- what a rule sees */

/** One day's log, as much of it as was filled in. */
export type DayLogSample = {
  date: string;
  /** Minutes from midnight. */
  wakeMinute: number | null;
  restingHr: number | null;
};

/** One logged intake, for the rules that judge timing rather than quantity. */
export type IntakeSample = {
  atMinute: number;
  milligrams?: number;
};

export type RuleContext = {
  plan: DayPlan;
  day: ResolvedDay;
  /** The track and when it started, for the deload rules. A null start keeps them quiet. */
  track: { id: TrackId; startedOn: string | null };
  /**
   * Recent day logs, oldest first, ending with the most recent. The resting-HR and social-jetlag
   * rules read these; absent or too short, they say nothing.
   */
  logs?: readonly DayLogSample[];
  /** Today's logged caffeine. Absent means the cutoff rule stays quiet. */
  caffeine?: readonly IntakeSample[];
};

type Rule = {
  id: string;
  run: (context: RuleContext) => Advisory[];
};

/* ------------------------------------------------------------------- helpers */

/**
 * Today's entries of one category, in start order.
 *
 * `resolveDay` has already sorted `entries` and already excluded the blocks today's weekday mask
 * turns off, so neither is re-checked here.
 */
function ofCategory(day: ResolvedDay, category: string): ResolvedBlock[] {
  return day.entries.filter((entry) => entry.block.category === category);
}

function lastOfCategory(day: ResolvedDay, category: string): ResolvedBlock | undefined {
  return ofCategory(day, category).at(-1);
}

/**
 * Moving a block earlier is always a subtraction from `offsetMinutes`, whatever it is anchored
 * to  --  the field is a signed offset for six anchors and a minute of the day for `clock`, and
 * both shift the same way. That is what lets one fix shape serve every rule below.
 */
function shiftedEarlier(entry: ResolvedBlock, minutes: number): BlockPatch {
  return { offsetMinutes: entry.block.offsetMinutes - minutes };
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/* --------------------------------------------------------------- the rules */

/**
 * Daylight after waking  --  the single highest-return item in the whole routine, so it is the one
 * rule that shouts.
 *
 * The window is not simply "within an hour of waking": at a wake time of sunrise−75 there is no
 * daylight to get. It opens at whichever of wake and sunrise comes later, and closes at whichever
 * of wake+60 and sunrise+30 comes later  --  so an early riser is asked for light shortly after the
 * sun arrives rather than in the dark, and a late riser is asked for it promptly.
 */
const morningLight: Rule = {
  id: "morning-light",
  run: ({ plan, day }) => {
    const { wake } = plan.personal;
    const sunrise = plan.sun.sunrise;
    if (sunrise === null) return [];

    const opens = Math.max(wake, sunrise);
    const closes = Math.max(wake + 60, sunrise + 30);
    const satisfied = ofCategory(day, "light").some(
      (entry) => entry.start < closes && entry.end > opens,
    );
    if (satisfied) return [];

    return [
      {
        id: "morning-light",
        rule: "morning-light",
        severity: "critical",
        message: "Nothing gets you outside in the first hour of light",
        why:
          "Bright outdoor light shortly after waking is what sets the circadian clock for the " +
          "day  --  it advances sleep onset that evening, steadies alertness, and no indoor lamp " +
          "is close to bright enough to substitute. It is the cheapest lever in the routine.",
        scienceIds: ["morning-light", "circadian-entrainment"],
        fix: {
          kind: "addBlock",
          label: "Add 20 minutes outdoors",
          block: {
            title: "Daylight, outdoors",
            detail: "Outside, no sunglasses. Overcast still counts.",
            category: "light",
            // Anchored to whichever of the two the window actually opens on, so the block
            // re-times itself correctly if either the wake offset or the season changes.
            anchor: wake >= sunrise ? "wake" : "sunrise",
            offsetMinutes: 10,
            durationMinutes: 20,
            icon: "sun",
            scienceIds: ["morning-light", "circadian-entrainment"],
          },
        },
      },
    ];
  },
};

/**
 * Dinner too close to lights out.
 *
 * The target is not written here: `plan.personal.lastFoodBy` is already bedtime minus the
 * configured gap, so this rule is one subtraction against a number `lib/day.ts` owns. Severity
 * turns critical only when the meal ends inside an hour of bed  --  eating essentially at bedtime,
 * which is the case that undoes most of the evening.
 */
const dinnerGap: Rule = {
  id: "dinner-gap",
  run: ({ plan, day }) => {
    const meal = lastOfCategory(day, "food");
    if (!meal) return [];

    const { bedtime, lastFoodBy } = plan.personal;
    const shortfall = meal.end - lastFoodBy;
    if (shortfall <= 0) return [];

    const gap = Math.max(0, bedtime - meal.end);
    return [
      {
        id: `dinner-gap:${meal.block.id}`,
        rule: "dinner-gap",
        severity: gap < 60 ? "critical" : "warning",
        message: `${meal.block.title} ends ${formatDuration(gap)} before lights out`,
        why:
          "Digestion raises core temperature and holds glucose and insulin up at exactly the " +
          "point the body is trying to drop all three in order to fall asleep. Eating late " +
          "delays sleep onset and shallows the first cycles, which are the deep ones. Your " +
          `target is ${formatDuration(bedtime - lastFoodBy)}.`,
        scienceIds: ["dinner-sleep-gap", "late-eating", "circadian-metabolism"],
        fix: {
          kind: "block",
          label: `Move it ${formatDuration(shortfall)} earlier`,
          blockId: meal.block.id,
          patch: shiftedEarlier(meal, shortfall),
        },
      },
    ];
  },
};

/**
 * Caffeine past the cutoff  --  the one rule with nothing mechanical to offer.
 *
 * Gated on `context.caffeine`: with nothing logged it says nothing rather than assuming the day
 * was clean. It switches on by itself once Nourish is recording.
 */
const caffeineLate: Rule = {
  id: "caffeine-late",
  run: ({ plan, caffeine }) => {
    if (!caffeine || caffeine.length === 0) return [];

    const cutoff = plan.personal.caffeineCutoff;
    const late = caffeine.filter((intake) => intake.atMinute > cutoff);
    if (late.length === 0) return [];

    const last = late.reduce((a, b) => (b.atMinute > a.atMinute ? b : a));
    const dose = last.milligrams ? `${Math.round(last.milligrams)} mg of ` : "";

    return [
      {
        id: "caffeine-late",
        rule: "caffeine-late",
        severity: "warning",
        message: `${dose}caffeine ${formatDuration(last.atMinute - cutoff)} past your cutoff`,
        why:
          "Caffeine's half-life is around five hours, so a quarter of the dose is still " +
          "circulating eight hours after the cup. It blunts deep sleep without necessarily " +
          "stopping you falling asleep, which is why the cost is easy to miss  --  it arrives as a " +
          "duller morning rather than as a bad night.",
        scienceIds: ["caffeine-half-life", "sleep-onset"],
        // No mechanical fix exists: a cup already drunk cannot be un-drunk. The honest offer is
        // the page that shows the arithmetic, so tomorrow's lands before the line.
        fix: { kind: "navigate", label: "See the cutoff", href: "/nourish" },
      },
    ];
  },
};

/**
 * A sleep target below seven hours.
 *
 * An advisory, never a refusal. The app takes the number the user set and builds the day around
 * it; saying so once is assistance, and blocking it would be paternalism.
 */
const shortSleep: Rule = {
  id: "short-sleep",
  run: ({ plan }) => {
    const target = plan.personal.sleepTargetMinutes;
    if (target >= 420) return [];

    return [
      {
        id: "short-sleep",
        rule: "short-sleep",
        severity: "advisory",
        message: `Your sleep target is ${formatDuration(target)}`,
        why:
          "Below about seven hours, vigilance decays night on night and the deficit accumulates " +
          "without feeling like it does  --  self-rated sleepiness levels off while reaction time " +
          "keeps getting worse, so the judgement you would use to notice is the thing being " +
          "degraded. The Mind Gym's vigilance task exists to show you your own version of that " +
          "curve rather than ask you to take this on faith.",
        scienceIds: ["sleep-duration", "pvt-sleep-debt"],
        fix: { kind: "settings", label: "Set it to 7h", patch: { sleepTargetMinutes: 420 } },
      },
    ];
  },
};

/**
 * A training session marked as done fasted.
 *
 * Keyed on the `training` category rather than on titles: in this app `training` is the
 * strength-and-conditioning work and `movement` is the walking and the Surya Namaskar, which are
 * meant to be done on an empty stomach. So the category is already the distinction the rule needs.
 */
const fastedTraining: Rule = {
  id: "fasted-training",
  run: ({ day }) =>
    ofCategory(day, "training")
      .filter((entry) => entry.block.fuel === "empty")
      .map((entry) => ({
        id: `fasted-training:${entry.block.id}`,
        rule: "fasted-training",
        severity: "warning" as Severity,
        message: `${entry.block.title} is set to be done fasted`,
        why:
          "Hard or long strength work fasted costs force output, and  --  more to the point  --  costs " +
          "form on the last two reps, which is where injuries come from. A banana or two or three " +
          "dates twenty minutes before is enough. Not almonds: the fat slows gastric emptying, so " +
          "they are still sitting there when you start.",
        scienceIds: ["fasted-training", "training-timing"],
        fix: {
          kind: "block",
          label: "Allow light fuel",
          blockId: entry.block.id,
          patch: { fuel: "light" },
        },
      })),
};

/**
 * A block that declares it needs an empty stomach, scheduled soon after a meal.
 *
 * The rule is arithmetic against the user's own declaration rather than a guess about what the
 * block is: `fuel: "empty"` is the schema saying this one wants nothing in the stomach, and a meal
 * ending forty minutes earlier contradicts it. That framing covers the case the tradition is
 * emphatic about  --  Kapalabhati and Bhastrika work the abdomen, and doing that against a full
 * stomach is both less effective and a reliable way to meet your lunch again  --  without needing to
 * detect which pranayama a block contains.
 *
 * `training` is excluded because `fasted-training` above already has an opinion about that
 * category, and the two would otherwise contradict each other on the same block.
 */
const emptyStomachAfterFood: Rule = {
  id: "empty-stomach",
  run: ({ day }) => {
    const meals = ofCategory(day, "food");
    if (meals.length === 0) return [];

    const out: Advisory[] = [];
    for (const entry of day.entries) {
      if (entry.block.fuel !== "empty" || entry.block.category === "training") continue;

      // The nearest meal that has already finished by the time the block starts.
      const meal = meals.filter((m) => m.end <= entry.start && entry.start - m.end < 180).at(-1);
      if (!meal) continue;

      const gap = entry.start - meal.end;
      out.push({
        id: `empty-stomach:${entry.block.id}`,
        rule: "empty-stomach",
        severity: gap < 90 ? "warning" : "advisory",
        message: `${entry.block.title} starts ${formatDuration(gap)} after ${meal.block.title}`,
        why:
          "This block is marked as needing an empty stomach, and the schedule does not give it " +
          "one. Three hours after a full meal is the standing instruction for forceful breathing; " +
          "an hour after something small is usually enough for a sit. Either move the block or " +
          "move the meal  --  which of the two should give is your call, not the app's.",
        scienceIds: ["pranayama-empty-stomach"],
        fix: { kind: "navigate", label: "Open the Timeline", href: "/timeline" },
      });
    }
    return out;
  },
};

/** Enough mornings to have a baseline worth comparing against, and the window compared to it. */
const HR_RECENT_DAYS = 3;
const HR_BASELINE_MIN = 4;

/**
 * Resting heart rate drifting up across consecutive mornings.
 *
 * Gated on `context.logs`, and gated again on there being enough of them: a baseline built from
 * two mornings is not a baseline. Until the day log has a week in it this rule is silent, which is
 * the correct thing for it to be.
 */
const restingHrDrift: Rule = {
  id: "resting-hr",
  run: ({ logs }) => {
    if (!logs) return [];

    const readings: number[] = [];
    for (const log of logs) if (log.restingHr !== null) readings.push(log.restingHr);
    if (readings.length < HR_RECENT_DAYS + HR_BASELINE_MIN) return [];

    const drift = mean(readings.slice(-HR_RECENT_DAYS)) - mean(readings.slice(0, -HR_RECENT_DAYS));
    if (drift < 5) return [];

    return [
      {
        id: "resting-hr",
        rule: "resting-hr",
        severity: "warning",
        message: `Resting heart rate is up ${Math.round(drift)} bpm over your last ${HR_RECENT_DAYS} mornings`,
        why:
          "A resting pulse that stays elevated for several mornings is one of the few cheap " +
          "signals of incomplete recovery, which is why athletes have used it for decades. It " +
          "cannot tell you why, though  --  training load, short sleep, alcohol and the start of an " +
          "illness all look identical here. Treat it as a reason to take an easier week and to " +
          "look at your sleep, not as a diagnosis.",
        scienceIds: ["recovery-supercompensation", "resting-hr-recovery"],
        fix: { kind: "navigate", label: "Open Train", href: "/train" },
      },
    ];
  },
};

/**
 * The fourth week of the hardcore track.
 *
 * Counted from `trackStartedOn` rather than from the calendar month, so week 4 means the user's
 * fourth week and not "it is late in March". A null start date keeps the rule quiet, which is the
 * state until the track is chosen in onboarding or Settings. The arithmetic comes from
 * `lib/training.ts` because the Train view puts the same week number in its header, and two copies
 * of the formula would eventually disagree by a day with no way to tell which was right.
 */
const deloadWeek: Rule = {
  id: "deload-week",
  run: ({ plan, track }) => {
    if (track.id !== "hardcore" || track.startedOn === null) return [];

    const week = weekInCycle(parseISODate(track.startedOn), parseISODate(plan.date));
    if (!isDeloadWeek(week)) return [];

    return [
      {
        id: `deload-week:${week}`,
        rule: "deload-week",
        severity: "advisory",
        message: `Week ${week} of the hardcore track  --  take it as a deload`,
        why:
          "The adaptation happens between sessions, not during them, and three hard weeks is " +
          "about as long as that process keeps up with the load. Cut volume by roughly a third " +
          "and keep the intensity: fewer sets of the same weight, not the same sets done sloppily. " +
          "Skipping the lighter week is the usual reason week five becomes an injury.",
        scienceIds: ["recovery-supercompensation", "training-timing"],
        fix: { kind: "navigate", label: "Open Train", href: "/train" },
      },
    ];
  },
};

/** Enough of each kind of morning for the two means to mean anything. */
const JETLAG_FREE_MIN = 2;
const JETLAG_WORK_MIN = 3;

/**
 * Social jetlag  --  the gap between the free-day wake time and the working-day one.
 *
 * Weekend is taken as Saturday and Sunday, which is what it is for this user; a shift worker would
 * need free days marked in the log rather than inferred from the calendar, and that is a real
 * limitation rather than an oversight. Gated on `context.logs` either way.
 */
const socialJetlag: Rule = {
  id: "social-jetlag",
  run: ({ logs }) => {
    if (!logs) return [];

    const free: number[] = [];
    const working: number[] = [];
    for (const log of logs) {
      if (log.wakeMinute === null) continue;
      const weekday = weekdayOf(parseISODate(log.date));
      (weekday === 0 || weekday === 6 ? free : working).push(log.wakeMinute);
    }
    if (free.length < JETLAG_FREE_MIN || working.length < JETLAG_WORK_MIN) return [];

    const drift = mean(free) - mean(working);
    if (drift <= 60) return [];

    return [
      {
        id: "social-jetlag",
        rule: "social-jetlag",
        severity: "advisory",
        message: `You wake ${formatDuration(drift)} later on free days`,
        why:
          "That gap is social jetlag: the body clock is being flown across a time zone twice a " +
          "week, and the Monday cost is real even when the total hours slept are fine. The fix is " +
          "usually not more discipline at the weekend  --  it is a weekday wake time you can " +
          "actually hold, which is what the chronotype setting is for.",
        scienceIds: ["sleep-regularity", "circadian-entrainment"],
        fix: { kind: "navigate", label: "Revisit your chronotype", href: "/settings" },
      },
    ];
  },
};

/**
 * Blocks that want the same minutes  --  the one rule that cites nothing.
 *
 * `resolveDay` has already found these; this rule only carries them into the same panel as
 * everything else, so the user has one place to look. Which of two colliding blocks should move is
 * not a health question and not the app's decision, hence the navigate rather than a patch.
 */
const overlaps: Rule = {
  id: "overlap",
  run: ({ day }) => {
    const titleOf = (id: number): string =>
      day.entries.find((entry) => entry.block.id === id)?.block.title ?? "A block";

    return day.overlaps.map((conflict) => {
      const [first, second] = conflict.blockIds;
      return {
        id: `overlap:${first}:${second}`,
        rule: "overlap",
        severity: "warning" as Severity,
        message: `${titleOf(first)} and ${titleOf(second)} overlap by ${formatDuration(conflict.minutes)}`,
        why:
          "Two blocks are booked over each other, so at least one of them will not happen the way " +
          "it is written. Better to decide which now than at the moment it comes round.",
        scienceIds: [],
        fix: { kind: "navigate", label: "Open the Timeline", href: "/timeline" },
      };
    });
  },
};

/* ----------------------------------------------------------------- the engine */

/**
 * Every rule. Array order is only the tie-break  --  `evaluateRules` sorts by severity  --  so a rule
 * can be added anywhere in this list without changing what the user sees first.
 */
export const RULES: readonly Rule[] = [
  morningLight,
  dinnerGap,
  caffeineLate,
  shortSleep,
  fastedTraining,
  emptyStomachAfterFood,
  restingHrDrift,
  deloadWeek,
  socialJetlag,
  overlaps,
];

/** The rule ids, in list order  --  what a Settings screen offers to mute. */
export const RULE_IDS: readonly string[] = RULES.map((rule) => rule.id);

export type EvaluateOptions = {
  /** Rule ids the user has silenced. An unknown id is ignored rather than an error. */
  muted?: readonly string[];
};

/**
 * Run every rule and return what fired, worst first.
 *
 * The sort is by severity alone, and `Array.prototype.sort` is stable, so within one severity the
 * order is the order of `RULES`  --  deterministic, which is what lets the tests assert on positions
 * and what stops the panel reshuffling itself between renders.
 *
 * Nothing here catches: a rule is a pure function over a typed context with a fixture test of its
 * own, so a throw is a bug that should be loud rather than an advisory that goes quietly missing.
 */
export function evaluateRules(context: RuleContext, options: EvaluateOptions = {}): Advisory[] {
  const muted = new Set(options.muted ?? []);
  const found: Advisory[] = [];

  for (const rule of RULES) {
    if (muted.has(rule.id)) continue;
    found.push(...rule.run(context));
  }

  return found.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * How many of each severity, for a panel header that has to say something before it is opened.
 *
 * Cheaper than making the caller reduce the list twice, and it keeps the ranking of what "worst"
 * means in this module rather than spread across the components that display it.
 */
export function severityCounts(advisories: readonly Advisory[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, advisory: 0 };
  for (const advisory of advisories) counts[advisory.severity] += 1;
  return counts;
}
