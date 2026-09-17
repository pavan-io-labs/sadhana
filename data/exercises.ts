/**
 * The sessions, the movements in them, and what to eat first.
 *
 * These are the same sessions the routine presets already put on the timeline  --  same titles,
 * same weekdays, same fuel state  --  because the Train view's first job is to answer "what am I
 * doing today", and the answer has to be the one the day already promised. `data/routines.ts`
 * owns *when* a session happens; this file owns *what it consists of*. The link between them is
 * `matchSession`, which finds the session a timeline block is asking for by title.
 *
 * Why the exercise list is data rather than something the user builds: a logged set is only worth
 * anything if the same movement means the same thing across weeks, which is what makes the
 * progressive-overload suggestion in `lib/training.ts` legitimate. A free-text exercise field
 * would silently split "Bench press" and "bench press" into two histories that each look like a
 * plateau.
 *
 * The fuel guidance carries the reason, not just the verdict. "Not almonds" is the kind of
 * instruction that gets ignored precisely because it sounds arbitrary, and it is not: fat delays
 * gastric emptying, so 20 grams of it 20 minutes before intervals is still in the stomach during
 * them. Saying so is the difference between a rule and a superstition.
 */

import type { BlockFuel } from "@/lib/db/schema";
import { EVERY_DAY, maskOf } from "@/lib/schedule";
import type { TrackId } from "@/lib/validators";

/* ------------------------------------------------------------------ movements */

/**
 * What a movement is, for logging purposes.
 *
 * `progresses` is the field that matters: it marks the loaded lifts where adding 2.5 kg is a
 * meaningful decision, and excludes the ones where it is not. Suggesting extra load on a Surya
 * Namaskar round or a walk would be nonsense, and suggesting it on a plank would be answering a
 * question about held seconds with a number of kilos.
 */
export type Exercise = {
  slug: string;
  name: string;
  /** How the set is recorded, which decides which inputs the logger shows. */
  measure: "weight" | "reps" | "hold" | "rounds" | "time";
  /** What it loads, shown as a chip so a split reads at a glance. */
  target: string;
  sets: number;
  /** As prescribed, in words  --  a range, not a number, because the last set decides the session. */
  prescription: string;
  /**
   * The rep every working set has to reach before load goes up: the top of the prescribed range.
   *
   * `null` where the idea does not apply  --  a hold, a walk, or a set prescribed as "two short of
   * failure", which is a feeling rather than a number. `lib/training.ts` will not suggest a load
   * increase without one, so a missing target fails closed.
   */
  repTarget: number | null;
  /** Whether `lib/training.ts` should offer a load increase once every rep was hit. */
  progresses: boolean;
  /** The increment, in kilograms. Small enough to be repeatable, which is the whole point. */
  stepKg: number;
  /** One line of form, the one thing most often got wrong. */
  cue: string;
  scienceIds: readonly string[];
};

/**
 * The top of a prescribed range, read out of the prescription that states it.
 *
 * Parsing our own literals rather than a second hand-maintained number, because two fields that
 * have to agree eventually will not. Everything after the `×` is the range; the last integer in
 * it is the rep to beat. Shapes without a `×`  --  "two reps short of failure", a held time  --  have
 * no target, and `tests/training.test.ts` asserts every *progressing* exercise found one.
 */
function topOfRange(prescription: string): number | null {
  const [, range] = prescription.split("×");
  if (range === undefined) return null;
  const numbers = range.match(/\d+/g);
  if (!numbers) return null;
  return Number(numbers[numbers.length - 1]);
}


/** Shorthand for the many bodyweight movements, where most fields are the same. */
function bodyweight(
  slug: string,
  name: string,
  target: string,
  sets: number,
  prescription: string,
  cue: string,
  scienceIds: readonly string[] = ["strength-training"],
): Exercise {
  return {
    slug,
    name,
    measure: "reps",
    target,
    sets,
    prescription,
    repTarget: topOfRange(prescription),
    progresses: false,
    stepKg: 0,
    cue,
    scienceIds,
  };
}

/** A loaded lift: the only kind the overload suggestion applies to. */
function lift(
  slug: string,
  name: string,
  target: string,
  sets: number,
  prescription: string,
  cue: string,
  stepKg = 2.5,
): Exercise {
  return {
    slug,
    name,
    measure: "weight",
    target,
    sets,
    prescription,
    repTarget: topOfRange(prescription),
    progresses: true,
    stepKg,
    cue,
    scienceIds: ["strength-training", "progressive-overload"],
  };
}

/* ---------------------------------------------------------------------- fuel */

/**
 * What to eat before a session, and why that is the answer.
 *
 * One of these hangs off every session rather than off the track, because the answer genuinely
 * differs between two sessions in the same week: the Surya Namaskar rounds want an empty stomach
 * (they compress it), the intervals want something fast twenty minutes out, and the strength
 * session wants a real meal ninety minutes out. A single per-track rule would have to be wrong
 * about two of the three.
 */
export type SessionFuel = {
  /** Matches the block's own `fuel` column, so the timeline and this page cannot disagree. */
  state: BlockFuel;
  /** The instruction, in one line. */
  headline: string;
  /** The mechanism. Present because a rule whose reason is hidden gets dropped first. */
  why: string;
  /** Concrete foods, or empty when the answer is "nothing". */
  eat: readonly string[];
  /** Named and explained, because these are the plausible-looking wrong answers. */
  avoid: readonly string[];
  scienceIds: readonly string[];
};

const FUEL_EMPTY: SessionFuel = {
  state: "empty",
  headline: "Empty stomach. Water, and coffee if it is your cup for the day.",
  why: "Forward folds and twists on a full stomach are uncomfortable at best, and the tradition's insistence here happens to match the mechanics. Nothing in a 25-minute practice needs fuel that is not already in your muscles.",
  eat: [],
  avoid: [
    "Breakfast first  --  wait two hours after a meal, or do the rounds before it",
    "A large glass of anything immediately before the folds",
  ],
  scienceIds: ["surya-namaskar", "fasted-training"],
};

const FUEL_LIGHT: SessionFuel = {
  state: "light",
  headline: "Something fast, twenty minutes before. A banana, or three dates.",
  why: "Intervals run on glycogen and blood glucose, and twenty minutes is enough for simple carbohydrate to arrive without still sitting in the stomach. Fat and fibre are what break this: they slow gastric emptying, so the same calories eaten as nuts are still undigested when the first hard effort starts.",
  eat: ["A banana", "Three dates", "A small glass of juice", "Half a slice of toast with honey"],
  avoid: [
    "Almonds or any nuts  --  the fat delays emptying, which is the one thing you cannot afford here",
    "A full meal  --  ninety minutes is the gap that needs, not twenty",
    "Nothing at all, if you are training before breakfast on a hard day",
  ],
  scienceIds: ["hiit-vo2max", "pre-exercise-carbohydrate"],
};

const FUEL_FED: SessionFuel = {
  state: "fed",
  headline: "A real meal, ninety minutes before. This is the session that is never done fasted.",
  why: "Heavy strength work fasted costs more than it saves: force output drops on the later sets, which are the ones that drive the adaptation, and training in a fasted state with a real load is where most avoidable injuries in a programme come from. Ninety minutes is enough for a mixed meal to clear.",
  eat: [
    "Rice or roti with dal and a vegetable  --  the ordinary lunch",
    "Curd rice, if the session is early afternoon",
    "A banana on top if the meal was small or more than three hours ago",
  ],
  avoid: [
    "Training on nothing because it was a busy day  --  move the session instead",
    "A heavy fried meal inside two hours",
  ],
  scienceIds: ["fasted-training", "strength-training"],
};

const FUEL_ANY: SessionFuel = {
  state: "any",
  headline: "Eat or do not; this one does not care.",
  why: "Easy aerobic work at a conversational pace runs on fat oxidation and is not limited by what is in your stomach. The reason to leave it unconstrained is that a walk you have to plan a snack around is a walk that stops happening.",
  eat: [],
  avoid: ["Turning it into a workout  --  if you need fuel for it, it has stopped being this session"],
  scienceIds: ["walking-cognition", "zone-two"],
};

/* ------------------------------------------------------------------- sessions */

/**
 * One session, as the Train view logs it.
 *
 * `blockTitle` is the join back to the timeline: it is the exact title the preset gives this
 * session, so `matchSession` can look at today's blocks and know which session the day means.
 * Matching on the title rather than on a shared id is deliberate  --  a block is editable, and a
 * user who renames "Easy walk" has said something about their day that the app should follow
 * rather than override. When the title stops matching, Train falls back to the track's list and
 * asks, which is a better failure than confidently logging sets against the wrong session.
 */
export type Session = {
  slug: string;
  name: string;
  /** `null` for the sessions both tracks share. */
  track: TrackId | null;
  /** The preset block this session is the content of. */
  blockTitle: string;
  /** Sunday-first bitmask, matching `blocks.weekdayMask`. */
  weekdayMask: number;
  tagline: string;
  /** Roughly what it takes, matching the block's duration. */
  durationMinutes: number;
  fuel: SessionFuel;
  /** Empty for the sessions that are counted rather than logged set by set. */
  exercises: readonly Exercise[];
  /** Rounds, when the session is a flow rather than a set list. */
  rounds: number | null;
  /** Said before the session, not after it. */
  cautions: readonly string[];
  scienceIds: readonly string[];
};

const MOBILITY = bodyweight(
  "joint-mobility",
  "Joint mobility",
  "Ankles, hips, spine, shoulders",
  1,
  "One easy circuit, no stretching held long",
  "Move each joint through the range it will need in a moment; this is a rehearsal, not a stretch session.",
  ["morning-movement"],
);

/** The morning flow, in the two round counts the presets ship. */
function suryaSession(rounds: number, track: TrackId | null, durationMinutes: number): Session {
  return {
    slug: `surya-${rounds}`,
    name: `Surya Namaskar  --  ${rounds} rounds`,
    track,
    blockTitle: `Mobility, then ${rounds} Surya Namaskar`,
    weekdayMask: EVERY_DAY,
    tagline:
      rounds >= 12
        ? "The warm-up for the day's real session, not the session itself."
        : "The whole morning's movement, and enough on its own.",
    durationMinutes,
    fuel: FUEL_EMPTY,
    exercises: [
      MOBILITY,
      {
        slug: "surya-namaskar",
        name: "Surya Namaskar",
        measure: "rounds",
        target: "Whole body, breath-led",
        sets: 1,
        prescription: `${rounds} rounds at a nasal-breathing pace`,
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "One breath per movement. The moment you are mouth-breathing, you are going too fast  --  slow down rather than cutting rounds.",
        scienceIds: ["surya-namaskar", "morning-movement"],
      },
    ],
    rounds,
    cautions: [
      "Empty stomach, or two hours after a meal.",
      "If a round hurts rather than merely being hard, stop the round  --  this is a warm-up, and there is nothing here worth an injury.",
    ],
    scienceIds: ["surya-namaskar", "morning-movement"],
  };
}

/** A walk, in the three lengths the tracks ask for. Logged as time, not as sets. */
function walkSession(
  slug: string,
  name: string,
  blockTitle: string,
  weekdays: readonly number[],
  durationMinutes: number,
  tagline: string,
  track: TrackId,
  scienceIds: readonly string[],
): Session {
  return {
    slug,
    name,
    track,
    blockTitle,
    weekdayMask: maskOf(weekdays),
    tagline,
    durationMinutes,
    fuel: FUEL_ANY,
    exercises: [
      {
        slug: "walk",
        name: "Walk",
        measure: "time",
        target: "Aerobic base, and the head",
        sets: 1,
        prescription: `${durationMinutes} minutes at a conversational pace`,
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "If you could not hold a conversation, it is too fast. Outdoors beats a treadmill here, and without headphones beats with.",
        scienceIds,
      },
    ],
    rounds: null,
    cautions: [],
    scienceIds,
  };
}

/**
 * Every session both tracks between them contain.
 *
 * The two Surya Namaskar entries differ only in round count, and both exist because the presets
 * ship both: eight rounds is Gentle's whole morning session, twelve is Hardcore's warm-up. Same
 * movement, different meaning, and the fuel and the caution are identical  --  which is why one
 * function builds them.
 */
export const SESSIONS: readonly Session[] = [
  suryaSession(8, null, 25),
  suryaSession(12, null, 30),

  {
    slug: "strength-full-body",
    name: "Strength  --  full body",
    track: "gentle",
    blockTitle: "Strength  --  full body",
    weekdayMask: maskOf([2, 5]),
    tagline: "Twice a week, six movements, the last two reps genuinely hard.",
    durationMinutes: 45,
    fuel: FUEL_FED,
    exercises: [
      lift(
        "goblet-squat",
        "Goblet squat",
        "Quads, glutes, trunk",
        3,
        "3 × 8–10, stopping two reps short of failure",
        "Elbows inside the knees at the bottom, chest up. Depth before load  --  if the heels lift, the weight is wrong, not your ankles.",
      ),
      lift(
        "dumbbell-row",
        "One-arm dumbbell row",
        "Upper back, lats",
        3,
        "3 × 8–10 each side",
        "Pull to the hip, not the armpit, and let the shoulder blade travel. A row that only bends the elbow trains nothing.",
      ),
      lift(
        "overhead-press",
        "Overhead press",
        "Shoulders, triceps, trunk",
        3,
        "3 × 6–8",
        "Ribs down, glutes tight  --  the lower back should not be doing the pressing.",
      ),
      lift(
        "romanian-deadlift",
        "Romanian deadlift",
        "Hamstrings, glutes",
        3,
        "3 × 8–10",
        "Hinge at the hip with a flat back, bar close to the leg. Stop where the hamstrings stop, not where the floor is.",
        5,
      ),
      bodyweight(
        "push-up",
        "Push-up",
        "Chest, triceps",
        3,
        "3 sets, two reps short of failure",
        "One straight line from ear to heel. Knees down is a full version of this exercise, not a lesser one.",
      ),
      {
        slug: "plank",
        name: "Plank",
        measure: "hold",
        target: "Trunk",
        sets: 3,
        prescription: "3 × 30–45 seconds",
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "Squeeze the glutes and breathe. A plank you cannot breathe in is a breath-hold, and it is training nothing you wanted.",
        scienceIds: ["strength-training"],
      },
    ],
    rounds: null,
    cautions: [
      "This is the one session that is never done fasted. Eat ninety minutes before.",
      "Two reps short of failure on every set. Going to failure here buys very little and costs the next two days.",
    ],
    scienceIds: ["strength-training", "progressive-overload", "training-timing"],
  },

  walkSession(
    "walk-easy",
    "Easy walk",
    "Easy walk",
    [1, 3, 4, 6],
    30,
    "Not a workout, and not meant to become one.",
    "gentle",
    ["walking-cognition", "zone-two"],
  ),
  walkSession(
    "walk-long",
    "Long walk",
    "Long walk  --  an hour and a quarter",
    [0],
    75,
    "One slower, longer outing a week. Somewhere with trees, if you have the choice.",
    "gentle",
    ["walking-cognition", "nature-exposure"],
  ),

  {
    slug: "upper-body",
    name: "Upper body  --  push and pull",
    track: "hardcore",
    blockTitle: "Upper body  --  push and pull",
    weekdayMask: maskOf([1, 4]),
    tagline: "Two pressing movements, two pulling, and enough volume to pay for them.",
    durationMinutes: 75,
    fuel: FUEL_FED,
    exercises: [
      lift(
        "bench-press",
        "Bench press",
        "Chest, triceps, front delts",
        4,
        "4 × 5–8",
        "Shoulder blades pinned to the bench and feet driving into the floor. The bar path is a shallow arc to the lower chest, not a straight drop.",
      ),
      lift(
        "pull-up",
        "Pull-up or lat pulldown",
        "Lats, upper back",
        4,
        "4 × 6–10, weighted once ten is easy",
        "Start from a dead hang and pull the elbows to the ribs. Half a rep at the top is where the range you are missing lives.",
      ),
      lift(
        "overhead-press",
        "Overhead press",
        "Shoulders, triceps, trunk",
        3,
        "3 × 6–8",
        "Ribs down, glutes tight  --  the lower back should not be doing the pressing.",
      ),
      lift(
        "barbell-row",
        "Barbell row",
        "Upper back, lats, rear delts",
        3,
        "3 × 8–10",
        "Torso around 45°, and it stays there. If it rises to move the bar, the set has already ended.",
      ),
      bodyweight(
        "face-pull",
        "Face pull",
        "Rear delts, rotators",
        3,
        "3 × 12–15",
        "Pull to the forehead with the elbows high. This is the cheapest insurance a pressing day has.",
      ),
    ],
    rounds: null,
    cautions: [
      "Add two and a half kilos to a lift only once you have hit every prescribed rep of it.",
      "Fed, ninety minutes out. Heavy pressing fasted is where the avoidable injuries are.",
    ],
    scienceIds: ["strength-training", "progressive-overload", "training-timing"],
  },

  {
    slug: "lower-body",
    name: "Lower body  --  squat, hinge, carry",
    track: "hardcore",
    blockTitle: "Lower body  --  squat, hinge, carry",
    weekdayMask: maskOf([3, 6]),
    tagline: "The session that is either won or thrown away on the last set.",
    durationMinutes: 75,
    fuel: FUEL_FED,
    exercises: [
      lift(
        "back-squat",
        "Back squat",
        "Quads, glutes, trunk",
        4,
        "4 × 5–8",
        "Brace before you unrack, not after. Knees track over the toes and the depth is whatever you can hold a neutral spine to.",
        5,
      ),
      lift(
        "deadlift",
        "Deadlift",
        "Posterior chain, grip",
        3,
        "3 × 4–6",
        "Take the slack out of the bar before you pull. If the hips shoot first, the back is about to finish the lift.",
        5,
      ),
      lift(
        "split-squat",
        "Bulgarian split squat",
        "Quads, glutes, single-leg balance",
        3,
        "3 × 8–10 each side",
        "Front shin roughly vertical, weight through the mid-foot. This is the one that finds the imbalance the barbell hides.",
      ),
      {
        slug: "farmer-carry",
        name: "Farmer's carry",
        measure: "time",
        target: "Grip, trunk, everything",
        sets: 3,
        prescription: "3 × 40 metres, heavy",
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "Tall, ribs down, and do not lean away from the load. When the grip goes, the set is over  --  put it down rather than dropping it.",
        scienceIds: ["strength-training"],
      },
      {
        slug: "calf-raise",
        name: "Calf raise",
        measure: "reps",
        target: "Calves, Achilles",
        sets: 3,
        prescription: "3 × 12–15, full range",
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "All the way down, all the way up, and a pause at the top. Bouncing turns this into a tendon exercise by accident.",
        scienceIds: ["strength-training"],
      },
    ],
    rounds: null,
    cautions: [
      "Same progression rule: every prescribed rep, then add load.",
      "If sleep was under six hours, drop the top set rather than the session. Heavy squats on no sleep is the trade that never pays.",
    ],
    scienceIds: ["strength-training", "progressive-overload", "sleep-performance"],
  },

  {
    slug: "conditioning",
    name: "Conditioning  --  intervals or hill repeats",
    track: "hardcore",
    blockTitle: "Conditioning  --  intervals or hill repeats",
    weekdayMask: maskOf([2, 5]),
    tagline: "Forty minutes including the warm-up, and kept away from the lifting days' muscles.",
    durationMinutes: 40,
    fuel: FUEL_LIGHT,
    exercises: [
      {
        slug: "interval-warmup",
        name: "Warm-up",
        measure: "time",
        target: "Everything, gently",
        sets: 1,
        prescription: "10 minutes easy, building",
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "Long enough to be sweating lightly before the first hard effort. Skipping this is why the first interval always feels worst.",
        scienceIds: ["hiit-vo2max"],
      },
      {
        slug: "intervals",
        name: "Intervals",
        measure: "rounds",
        target: "VO₂max, lactate clearance",
        sets: 1,
        prescription: "6 × 1 minute hard, 2 minutes easy between",
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "Hard means the last fifteen seconds are unpleasant, not that the first is a sprint. Even splits beat a heroic first rep.",
        scienceIds: ["hiit-vo2max", "zone-two"],
      },
      {
        slug: "interval-cooldown",
        name: "Cool-down",
        measure: "time",
        target: "Recovery",
        sets: 1,
        prescription: "8 minutes easy",
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "Keep moving until the breathing is conversational again. Then stop; nothing here needs stretching.",
        scienceIds: ["recovery-supercompensation"],
      },
    ],
    rounds: 6,
    cautions: [
      "Not on the same day as a heavy lower-body session, and not within four hours of lights out.",
      "A banana or three dates twenty minutes before  --  not almonds.",
    ],
    scienceIds: ["hiit-vo2max", "training-timing"],
  },

  {
    slug: "rest",
    name: "Rest day",
    track: "hardcore",
    blockTitle: "Rest day  --  walk, stretch, nothing heavy",
    weekdayMask: maskOf([0]),
    tagline: "The adaptation happens now, not in the session.",
    durationMinutes: 30,
    fuel: FUEL_ANY,
    exercises: [
      {
        slug: "walk",
        name: "Walk",
        measure: "time",
        target: "Blood flow, and the head",
        sets: 1,
        prescription: "30 minutes, easy",
        repTarget: null,
        progresses: false,
        stepKg: 0,
        cue: "Easy enough that it does not register as training. That is the point of it.",
        scienceIds: ["walking-cognition", "recovery-supercompensation"],
      },
    ],
    rounds: null,
    cautions: [
      "Logging a session here is not a bonus. Skipping the rest day is how week five turns into an injury.",
    ],
    scienceIds: ["recovery-supercompensation"],
  },
];

/* -------------------------------------------------------------------- lookups */

const BY_SLUG = new Map(SESSIONS.map((session) => [session.slug, session]));

/** Every distinct exercise in the catalogue, so a history view can name a slug. */
const EXERCISES_BY_SLUG = new Map(
  SESSIONS.flatMap((session) => session.exercises).map((exercise) => [exercise.slug, exercise]),
);

export function findSession(slug: string): Session | undefined {
  return BY_SLUG.get(slug);
}

export function findExercise(slug: string): Exercise | undefined {
  return EXERCISES_BY_SLUG.get(slug);
}

/** The sessions a track's week contains, plus the two everyone does. */
export function sessionsForTrack(track: TrackId): readonly Session[] {
  return SESSIONS.filter((session) => session.track === null || session.track === track);
}

/**
 * The session a timeline block is asking for, or `undefined`.
 *
 * Exact title first, because that is the case that is actually true for an unedited preset. The
 * fallback is a normalised compare, which catches the trivial divergences  --  a changed dash, a
 * different capital  --  without pretending to understand a genuinely renamed block.
 */
export function matchSession(blockTitle: string): Session | undefined {
  const exact = SESSIONS.find((session) => session.blockTitle === blockTitle);
  if (exact) return exact;

  const normalise = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const wanted = normalise(blockTitle);
  return SESSIONS.find((session) => normalise(session.blockTitle) === wanted);
}


