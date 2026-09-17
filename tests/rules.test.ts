/**
 * The rules engine  --  one crafted fixture per rule.
 *
 * Each rule is checked three ways: silent on a day that is fine, firing with the right severity
 * and citations on a day that is not, and  --  where it offers one  --  a fix that the wire actually
 * accepts. That last check is the whole point of shaping `AdvisoryFix` like a request body: every
 * fix here is parsed through the same Zod schema the route handler parses, so no rule can offer a
 * correction the API would reject.
 *
 * The last describe block is the one that guards the shipped data. All four presets are run
 * through the entire engine on every day of the reference week, and the engine has to find
 * nothing at all. A preset edit that pushes dinner too late, marks a strength session fasted,
 * schedules pranayama after breakfast or drops the morning daylight block fails here rather than
 * in front of the user.
 */

import { describe, expect, it } from "vitest";

import { presetBlocks, PRESET_IDS, ROUTINE_PRESETS } from "@/data/routines";
import { buildDayPlan, DAY_INPUT_DEFAULTS, type DayInput, type DayPlan } from "@/lib/day";
import {
  type Advisory,
  type DayLogSample,
  evaluateRules,
  type RuleContext,
  RULE_IDS,
  RULES,
  severityCounts,
} from "@/lib/rules";
import { EVERY_DAY, resolveDay, type ScheduleBlock } from "@/lib/schedule";
import { addDays, parseISODate, toISODate, weekdayOf } from "@/lib/time";
import { blockInputSchema, blockPatchSchema, settingsPatchSchema } from "@/lib/validators";

/* ------------------------------------------------------------------- fixtures */

/** The March equinox, and a Friday  --  so every weekday-masked block in the presets is on. */
const REFERENCE = "2026-03-20";

/**
 * A plan built from the shipped defaults: Hyderabad, wake at sunrise−75, a 7¾-hour night.
 *
 * Nothing below hard-codes the minutes that follow from those numbers. Every assertion reads
 * `plan.personal`, so the tests keep testing the rules rather than the astronomy.
 */
function planFor(over: Partial<DayInput> = {}, date = REFERENCE): DayPlan {
  return buildDayPlan(parseISODate(date), { ...DAY_INPUT_DEFAULTS, ...over });
}

let nextId = 0;

/** A block with every field filled, so a test names only the fields it is about. */
function makeBlock(partial: Partial<ScheduleBlock> = {}): ScheduleBlock {
  nextId += 1;
  const id = partial.id ?? nextId;
  return {
    id,
    title: `Block ${id}`,
    detail: "",
    category: "work",
    anchor: "clock",
    offsetMinutes: 600,
    durationMinutes: 30,
    fuel: "any",
    weekdayMask: EVERY_DAY,
    notify: false,
    notifyLeadMinutes: 5,
    sortOrder: id,
    icon: "dot",
    scienceIds: [],
    href: null,
    enabled: true,
    ...partial,
  };
}

/** `clock`-anchored, so the numbers a test passes are the minutes the block occupies. */
function at(start: number, durationMinutes: number, extra: Partial<ScheduleBlock> = {}) {
  return makeBlock({ anchor: "clock", offsetMinutes: start, durationMinutes, ...extra });
}

/**
 * A context with nothing logged  --  which is the state the app is in until Nourish and the day log
 * have something in them, and the state the three gated rules have to stay silent in.
 */
function contextOf(
  blocks: readonly ScheduleBlock[],
  plan: DayPlan = planFor(),
  extra: Partial<RuleContext> = {},
): RuleContext {
  return {
    plan,
    day: resolveDay(plan, blocks),
    track: { id: "gentle", startedOn: null },
    ...extra,
  };
}

/** The advisory a named rule produced, or undefined if it stayed quiet. */
function fired(context: RuleContext, rule: string): Advisory | undefined {
  return evaluateRules(context).find((advisory) => advisory.rule === rule);
}

/** A light block covering the morning window, so a fixture can be about something else. */
function daylightFor(plan: DayPlan): ScheduleBlock {
  const sunrise = plan.sun.sunrise ?? 0;
  return at(Math.max(plan.personal.wake, sunrise), 20, { category: "light", title: "Outside" });
}

/**
 * Every fix, checked against the schema the matching route would validate it with.
 *
 * This is what makes "a fix is a request body" true rather than aspirational.
 */
function expectFixParses(advisory: Advisory): void {
  const fix = advisory.fix;
  if (!fix) return;

  if (fix.kind === "settings") expect(settingsPatchSchema.safeParse(fix.patch).success).toBe(true);
  if (fix.kind === "block") expect(blockPatchSchema.safeParse(fix.patch).success).toBe(true);
  if (fix.kind === "addBlock") expect(blockInputSchema.safeParse(fix.block).success).toBe(true);
  if (fix.kind === "navigate") expect(fix.href).toMatch(/^\/[\w\-/]*$/);
}

/* ------------------------------------------------------------------ the shape */

describe("the engine", () => {
  it("lists its rules once each, and the ids match", () => {
    expect(RULE_IDS).toEqual(RULES.map((rule) => rule.id));
    expect(new Set(RULE_IDS).size).toBe(RULE_IDS.length);
    expect(RULES).toHaveLength(10);
  });

  it("returns the worst first, and keeps list order inside one severity", () => {
    const plan = planFor({ sleepTargetMinutes: 400 });
    // Nothing outdoors (critical), a training block marked fasted and two blocks on top of each
    // other (both warnings), and a sleep target under seven hours (advisory).
    const advisories = evaluateRules(
      contextOf(
        [
          at(600, 60, { category: "training", fuel: "empty" }),
          at(630, 60, { title: "Collides" }),
        ],
        plan,
      ),
    );

    expect(advisories.map((advisory) => advisory.severity)).toEqual([
      "critical",
      "warning",
      "warning",
      "advisory",
    ]);
    // `fasted-training` is listed before `overlap` in RULES, and the sort is stable.
    expect(advisories.map((advisory) => advisory.rule)).toEqual([
      "morning-light",
      "fasted-training",
      "overlap",
      "short-sleep",
    ]);
    expect(severityCounts(advisories)).toEqual({ critical: 1, warning: 2, advisory: 1 });
    for (const advisory of advisories) expectFixParses(advisory);
  });

  it("gives every advisory a unique id, and silences a muted rule", () => {
    const context = contextOf([at(600, 60), at(610, 60), at(620, 60)]);
    const advisories = evaluateRules(context);
    expect(new Set(advisories.map((advisory) => advisory.id)).size).toBe(advisories.length);

    const muted = evaluateRules(context, { muted: ["morning-light", "overlap"] });
    expect(muted).toEqual([]);
    // An id no rule carries is ignored rather than an error.
    expect(evaluateRules(context, { muted: ["nonesuch"] })).toEqual(advisories);
  });
});

/* ------------------------------------------------------------------- the rules */

describe("morning light", () => {
  const plan = planFor();
  const sunrise = plan.sun.sunrise!;
  const { wake } = plan.personal;

  it("stays quiet when a light block covers the window", () => {
    expect(fired(contextOf([daylightFor(plan)], plan), "morning-light")).toBeUndefined();
  });

  it("still fires when the only outdoor block finishes before the sun is up", () => {
    // Wake is sunrise−75 on the defaults, so a walk at wake+5 is a walk in the dark. This is the
    // case a plain "within an hour of waking" window would have got wrong.
    const early = at(wake + 5, 30, { category: "light" });
    expect(early.offsetMinutes + early.durationMinutes).toBeLessThan(sunrise);
    expect(fired(contextOf([early], plan), "morning-light")?.severity).toBe("critical");
  });

  it("counts a block that only reaches into the window", () => {
    const straddling = at(sunrise - 10, 20, { category: "light" });
    expect(fired(contextOf([straddling], plan), "morning-light")).toBeUndefined();
  });

  it("is not satisfied by another category filling the same minutes", () => {
    const indoors = at(sunrise, 40, { category: "movement", title: "Mobility indoors" });
    expect(fired(contextOf([indoors], plan), "morning-light")?.severity).toBe("critical");
  });

  it("offers a block the create endpoint would accept, anchored to whichever comes later", () => {
    const advisory = fired(contextOf([], plan), "morning-light");
    const fix = advisory?.fix;
    expect(fix?.kind).toBe("addBlock");
    if (fix?.kind !== "addBlock") return;

    // Sunrise is 75 minutes after this user wakes, so the window opens on the sun.
    expect(fix.block.anchor).toBe("sunrise");
    const parsed = blockInputSchema.parse(fix.block);
    expect(parsed.category).toBe("light");
    expect(parsed.durationMinutes).toBe(20);

    // A late riser is asked for the light against their own wake instead.
    const late = planFor({ wakeOffsetMinutes: 60 });
    expect(late.personal.wake).toBeGreaterThan(late.sun.sunrise!);
    const lateFix = fired(contextOf([], late), "morning-light")?.fix;
    if (lateFix?.kind === "addBlock") expect(lateFix.block.anchor).toBe("wake");
  });
});

describe("the dinner-to-bed gap", () => {
  const plan = planFor();
  const { bedtime, lastFoodBy } = plan.personal;
  const light = daylightFor(plan);
  const meal = (endsAt: number, extra: Partial<ScheduleBlock> = {}) =>
    at(endsAt - 30, 30, { category: "food", title: "Dinner", ...extra });

  it("stays quiet when the meal ends exactly on the target", () => {
    expect(fired(contextOf([light, meal(lastFoodBy)], plan), "dinner-gap")).toBeUndefined();
  });

  it("warns when it runs past, and offers exactly the shift that lands it back on target", () => {
    const dinner = meal(lastFoodBy + 40);
    const advisory = fired(contextOf([light, dinner], plan), "dinner-gap");

    expect(advisory?.severity).toBe("warning");
    expect(advisory?.scienceIds).toEqual([
      "dinner-sleep-gap",
      "late-eating",
      "circadian-metabolism",
    ]);

    const fix = advisory?.fix;
    expect(fix?.kind).toBe("block");
    if (fix?.kind !== "block") return;
    expect(fix.blockId).toBe(dinner.id);
    expect(fix.patch.offsetMinutes).toBe(dinner.offsetMinutes - 40);
    expect(fix.label).toBe("Move it 40m earlier");

    // Applying the patch has to actually silence the rule, not merely improve the number.
    const moved = at(fix.patch.offsetMinutes!, 30, { category: "food", id: dinner.id });
    expect(fired(contextOf([light, moved], plan), "dinner-gap")).toBeUndefined();
  });

  it("turns critical when the meal is inside an hour of lights out", () => {
    const advisory = fired(contextOf([light, meal(bedtime - 15)], plan), "dinner-gap");
    expect(advisory?.severity).toBe("critical");
    expect(advisory?.message).toContain("15m before lights out");
  });

  it("judges the last meal of the day, and only it", () => {
    const lunch = at(720, 45, { category: "food", title: "Lunch" });
    const context = contextOf([light, lunch, meal(lastFoodBy)], plan);
    expect(evaluateRules(context).filter((a) => a.rule === "dinner-gap")).toEqual([]);
  });
});

describe("caffeine past the cutoff", () => {
  const plan = planFor();
  const light = daylightFor(plan);
  const { caffeineCutoff } = plan.personal;

  it("says nothing until something has been logged", () => {
    expect(fired(contextOf([light], plan), "caffeine-late")).toBeUndefined();
    // Present but empty is a day with the log open and nothing in it, which is also not a finding.
    expect(fired(contextOf([light], plan, { caffeine: [] }), "caffeine-late")).toBeUndefined();
  });

  it("allows a cup exactly on the cutoff", () => {
    const context = contextOf([light], plan, { caffeine: [{ atMinute: caffeineCutoff }] });
    expect(fired(context, "caffeine-late")).toBeUndefined();
  });

  it("reports the latest cup once, with its dose and how far over it was", () => {
    const context = contextOf([light], plan, {
      caffeine: [
        { atMinute: caffeineCutoff - 300, milligrams: 95 },
        { atMinute: caffeineCutoff + 45, milligrams: 80 },
        { atMinute: caffeineCutoff + 90, milligrams: 64 },
      ],
    });

    const advisories = evaluateRules(context).filter((a) => a.rule === "caffeine-late");
    expect(advisories).toHaveLength(1);
    expect(advisories[0]!.message).toBe("64 mg of caffeine 1h 30m past your cutoff");
    expect(advisories[0]!.scienceIds).toEqual(["caffeine-half-life", "sleep-onset"]);
    // Nothing mechanical to offer: the cup is drunk.
    expect(advisories[0]!.fix).toEqual({
      kind: "navigate",
      label: "See the cutoff",
      href: "/nourish",
    });
  });

  it("omits the dose when only a time was logged", () => {
    const context = contextOf([light], plan, { caffeine: [{ atMinute: caffeineCutoff + 60 }] });
    expect(fired(context, "caffeine-late")?.message).toBe("caffeine 1h past your cutoff");
  });
});

describe("a short sleep target", () => {
  it("stays quiet at seven hours and speaks below it", () => {
    const seven = planFor({ sleepTargetMinutes: 420 });
    expect(fired(contextOf([daylightFor(seven)], seven), "short-sleep")).toBeUndefined();

    const six = planFor({ sleepTargetMinutes: 360 });
    const advisory = fired(contextOf([daylightFor(six)], six), "short-sleep");
    expect(advisory?.severity).toBe("advisory");
    expect(advisory?.message).toBe("Your sleep target is 6h");
    expect(advisory?.scienceIds).toEqual(["sleep-duration", "pvt-sleep-debt"]);
  });

  it("offers a settings patch the route would accept", () => {
    const six = planFor({ sleepTargetMinutes: 360 });
    const fix = fired(contextOf([daylightFor(six)], six), "short-sleep")?.fix;
    expect(fix?.kind).toBe("settings");
    if (fix?.kind !== "settings") return;
    expect(fix.patch).toEqual({ sleepTargetMinutes: 420 });
    expect(settingsPatchSchema.parse(fix.patch).sleepTargetMinutes).toBe(420);
  });
});

describe("training marked fasted", () => {
  const plan = planFor();
  const light = daylightFor(plan);

  it("fires on the training category and offers light fuel", () => {
    const session = at(600, 45, { category: "training", fuel: "empty", title: "Strength" });
    const advisory = fired(contextOf([light, session], plan), "fasted-training");

    expect(advisory?.severity).toBe("warning");
    expect(advisory?.message).toBe("Strength is set to be done fasted");
    expect(advisory?.scienceIds).toEqual(["fasted-training", "training-timing"]);

    const fix = advisory?.fix;
    expect(fix?.kind).toBe("block");
    if (fix?.kind !== "block") return;
    expect(fix.blockId).toBe(session.id);
    expect(fix.patch).toEqual({ fuel: "light" });
  });

  it("leaves movement alone  --  Surya Namaskar belongs on an empty stomach", () => {
    const rounds = at(600, 30, { category: "movement", fuel: "empty", title: "Surya Namaskar" });
    expect(fired(contextOf([light, rounds], plan), "fasted-training")).toBeUndefined();
  });

  it("says nothing when the session is fuelled at all", () => {
    for (const fuel of ["light", "fed", "any"] as const) {
      const session = at(600, 45, { category: "training", fuel });
      expect(fired(contextOf([light, session], plan), "fasted-training")).toBeUndefined();
    }
  });

  it("speaks once per session rather than once per day", () => {
    const morning = at(420, 40, { category: "training", fuel: "empty", title: "Lift" });
    const evening = at(1000, 40, { category: "training", fuel: "empty", title: "Second lift" });
    const advisories = evaluateRules(contextOf([light, morning, evening], plan)).filter(
      (advisory) => advisory.rule === "fasted-training",
    );

    expect(advisories).toHaveLength(2);
    expect(new Set(advisories.map((advisory) => advisory.id)).size).toBe(2);
  });
});

describe("a block that asked for an empty stomach", () => {
  const plan = planFor();
  const light = daylightFor(plan);
  /** Ends at 530, so every gap below is `start − 530`. */
  const breakfast = at(500, 30, { category: "food", title: "Breakfast" });

  it("warns inside ninety minutes and softens to an advisory beyond it", () => {
    const soon = at(560, 20, { category: "practice", fuel: "empty", title: "Kapalabhati" });
    const advisory = fired(contextOf([light, breakfast, soon], plan), "empty-stomach");
    expect(advisory?.severity).toBe("warning");
    expect(advisory?.message).toBe("Kapalabhati starts 30m after Breakfast");
    expect(advisory?.scienceIds).toEqual(["pranayama-empty-stomach"]);

    const later = at(620, 20, { category: "practice", fuel: "empty", title: "Kapalabhati" });
    expect(fired(contextOf([light, breakfast, later], plan), "empty-stomach")?.severity).toBe(
      "advisory",
    );
  });

  it("stops caring after three hours", () => {
    const nearly = at(709, 20, { category: "practice", fuel: "empty" });
    expect(fired(contextOf([light, breakfast, nearly], plan), "empty-stomach")).toBeDefined();

    const past = at(710, 20, { category: "practice", fuel: "empty" });
    expect(fired(contextOf([light, breakfast, past], plan), "empty-stomach")).toBeUndefined();
  });

  it("says nothing about a sit that comes before anything is eaten", () => {
    const sit = at(320, 30, { category: "practice", fuel: "empty", title: "Morning sit" });
    expect(fired(contextOf([light, breakfast, sit], plan), "empty-stomach")).toBeUndefined();
  });

  it("ignores a block that never claimed to need one", () => {
    const sit = at(560, 20, { category: "practice", fuel: "any", title: "Evening sit" });
    expect(fired(contextOf([light, breakfast, sit], plan), "empty-stomach")).toBeUndefined();
  });

  it("measures from the nearest meal, not the first", () => {
    const lunch = at(700, 45, { category: "food", title: "Lunch" });
    const breathing = at(760, 20, { category: "practice", fuel: "empty", title: "Breathing" });
    const advisory = fired(contextOf([light, breakfast, lunch, breathing], plan), "empty-stomach");
    expect(advisory?.message).toBe("Breathing starts 15m after Lunch");
  });

  it("leaves training to the fasted-training rule instead of contradicting it", () => {
    const session = at(560, 45, { category: "training", fuel: "empty", title: "Lift" });
    const rules = evaluateRules(contextOf([light, breakfast, session], plan)).map((a) => a.rule);
    expect(rules).toContain("fasted-training");
    expect(rules).not.toContain("empty-stomach");
  });
});

describe("resting heart rate drifting up", () => {
  const plan = planFor();
  const light = daylightFor(plan);

  /** Consecutive mornings ending on the reference date, oldest first  --  the documented order. */
  function hrLogs(rates: readonly (number | null)[]): DayLogSample[] {
    const last = parseISODate(REFERENCE);
    return rates.map((restingHr, index) => ({
      date: toISODate(addDays(last, index - rates.length + 1)),
      wakeMinute: null,
      restingHr,
    }));
  }

  it("waits for a week of readings before it has a baseline", () => {
    expect(fired(contextOf([light], plan), "resting-hr")).toBeUndefined();

    const six = hrLogs([50, 50, 50, 56, 56, 56]);
    expect(fired(contextOf([light], plan, { logs: six }), "resting-hr")).toBeUndefined();

    const seven = hrLogs([50, 50, 50, 50, 56, 56, 56]);
    expect(fired(contextOf([light], plan, { logs: seven }), "resting-hr")?.severity).toBe("warning");
  });

  it("reports the rise, and stays quiet under five beats", () => {
    const advisory = fired(
      contextOf([light], plan, { logs: hrLogs([50, 50, 50, 50, 56, 56, 56]) }),
      "resting-hr",
    );
    expect(advisory?.message).toBe("Resting heart rate is up 6 bpm over your last 3 mornings");
    expect(advisory?.scienceIds).toEqual(["recovery-supercompensation", "resting-hr-recovery"]);
    expect(advisory?.fix).toEqual({ kind: "navigate", label: "Open Train", href: "/train" });

    const four = hrLogs([50, 50, 50, 50, 54, 54, 54]);
    expect(fired(contextOf([light], plan, { logs: four }), "resting-hr")).toBeUndefined();
  });

  it("counts the mornings that were logged and skips the ones that were not", () => {
    // Nine days, two of them with no pulse taken: the seven that remain are still a week.
    const gappy = hrLogs([50, null, 50, 50, 50, null, 56, 56, 56]);
    expect(fired(contextOf([light], plan, { logs: gappy }), "resting-hr")?.message).toBe(
      "Resting heart rate is up 6 bpm over your last 3 mornings",
    );
  });

  it("reads the order it documents  --  newest first would invert the finding", () => {
    const rising = [50, 50, 50, 50, 56, 56, 56];
    expect(fired(contextOf([light], plan, { logs: hrLogs(rising) }), "resting-hr")).toBeDefined();
    const backwards = hrLogs([...rising].reverse());
    expect(fired(contextOf([light], plan, { logs: backwards }), "resting-hr")).toBeUndefined();
  });
});

describe("the hardcore deload week", () => {
  const plan = planFor();
  const light = daylightFor(plan);

  /** A track started `weeks` whole weeks before the reference date. */
  const started = (weeks: number) => toISODate(addDays(parseISODate(REFERENCE), -7 * weeks));

  const onTrack = (id: "gentle" | "hardcore", startedOn: string | null) =>
    fired(contextOf([light], plan, { track: { id, startedOn } }), "deload-week");

  it("needs the hardcore track and a start date", () => {
    expect(onTrack("hardcore", null)).toBeUndefined();
    expect(onTrack("gentle", started(3))).toBeUndefined();
  });

  it("fires in week four and every fourth week after", () => {
    for (const weeks of [0, 1, 2, 4, 5, 6, 8]) {
      expect(onTrack("hardcore", started(weeks))).toBeUndefined();
    }
    for (const weeks of [3, 7, 11]) {
      const advisory = onTrack("hardcore", started(weeks));
      expect(advisory?.severity).toBe("advisory");
      expect(advisory?.message).toBe(
        `Week ${weeks + 1} of the hardcore track  --  take it as a deload`,
      );
      expect(advisory?.fix).toMatchObject({ kind: "navigate", href: "/train" });
    }
  });

  it("treats a start date in the future as a typo rather than week zero", () => {
    expect(onTrack("hardcore", started(-1))).toBeUndefined();
  });
});

describe("social jetlag", () => {
  const plan = planFor();
  const light = daylightFor(plan);

  /** A fortnight of wake times: `work` on weekdays, `free` on Saturday and Sunday. */
  function wakeLogs(work: number | null, free: number | null, days = 14): DayLogSample[] {
    const last = parseISODate(REFERENCE);
    return Array.from({ length: days }, (_unused, index) => {
      const date = addDays(last, index - days + 1);
      const weekday = weekdayOf(date);
      return {
        date: toISODate(date),
        wakeMinute: weekday === 0 || weekday === 6 ? free : work,
        restingHr: null,
      };
    });
  }

  it("needs both kinds of morning before it will compare them", () => {
    expect(fired(contextOf([light], plan), "social-jetlag")).toBeUndefined();

    const workdaysOnly = wakeLogs(360, null);
    expect(fired(contextOf([light], plan, { logs: workdaysOnly }), "social-jetlag")).toBeUndefined();

    const weekendsOnly = wakeLogs(null, 480);
    expect(fired(contextOf([light], plan, { logs: weekendsOnly }), "social-jetlag")).toBeUndefined();
  });

  it("allows an hour of drift and speaks past it", () => {
    const hour = wakeLogs(360, 420);
    expect(fired(contextOf([light], plan, { logs: hour }), "social-jetlag")).toBeUndefined();

    const advisory = fired(contextOf([light], plan, { logs: wakeLogs(360, 465) }), "social-jetlag");
    expect(advisory?.severity).toBe("advisory");
    expect(advisory?.message).toBe("You wake 1h 45m later on free days");
    expect(advisory?.scienceIds).toEqual(["sleep-regularity", "circadian-entrainment"]);
    // Settings is where the chronotype lives, so that is where the offer goes.
    expect(advisory?.fix).toEqual({
      kind: "navigate",
      label: "Revisit your chronotype",
      href: "/settings",
    });
  });

  it("says nothing when the free days are the earlier ones", () => {
    const context = contextOf([light], plan, { logs: wakeLogs(480, 360) });
    expect(fired(context, "social-jetlag")).toBeUndefined();
  });
});

describe("blocks booked over each other", () => {
  const plan = planFor();
  const light = daylightFor(plan);

  it("names both, cites nothing, and offers the editor", () => {
    const work = at(600, 60, { title: "Deep work" });
    const standup = at(630, 60, { title: "Standup" });
    const advisory = fired(contextOf([light, work, standup], plan), "overlap");

    expect(advisory?.severity).toBe("warning");
    expect(advisory?.message).toBe("Deep work and Standup overlap by 30m");
    // Arithmetic, not a health claim, so there is nothing to cite.
    expect(advisory?.scienceIds).toEqual([]);
    expect(advisory?.fix).toEqual({
      kind: "navigate",
      label: "Open the Timeline",
      href: "/timeline",
    });
  });

  it("reports every colliding pair, including the ones a long block swallows", () => {
    const long = at(540, 180, { title: "Three hours" });
    const first = at(560, 20, { title: "First" });
    const second = at(660, 20, { title: "Second" });
    const advisories = evaluateRules(contextOf([light, long, first, second], plan)).filter(
      (advisory) => advisory.rule === "overlap",
    );

    expect(advisories.map((advisory) => advisory.message)).toEqual([
      "Three hours and First overlap by 20m",
      "Three hours and Second overlap by 20m",
    ]);
  });

  it("stays quiet when one block starts exactly as another ends", () => {
    expect(fired(contextOf([light, at(600, 60), at(660, 30)], plan), "overlap")).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ coverage */

describe("a day that gets everything wrong", () => {
  /** Six hours of sleep, so the day is short and every derived window moves with it. */
  const plan = planFor({ sleepTargetMinutes: 360 });
  const { bedtime, lastFoodBy, caffeineCutoff } = plan.personal;

  /** A fortnight that rises at the end and lies in on weekends  --  one array, two rules. */
  const fortnight: DayLogSample[] = Array.from({ length: 14 }, (_unused, index) => {
    const date = addDays(parseISODate(REFERENCE), index - 13);
    const weekday = weekdayOf(date);
    return {
      date: toISODate(date),
      wakeMinute: weekday === 0 || weekday === 6 ? 465 : 360,
      restingHr: index < 11 ? 50 : 56,
    };
  });

  const dinner = at(lastFoodBy + 15, 30, { category: "food", title: "Late dinner" });
  const context = contextOf(
    [
      at(600, 45, { category: "training", fuel: "empty", title: "Strength" }),
      at(700, 60, { title: "Deep work" }),
      at(730, 60, { title: "Standup" }),
      dinner,
      at(dinner.offsetMinutes + 60, 20, {
        category: "practice",
        fuel: "empty",
        title: "Breathing",
      }),
    ],
    plan,
    {
      track: { id: "hardcore", startedOn: toISODate(addDays(parseISODate(REFERENCE), -21)) },
      logs: fortnight,
      caffeine: [{ atMinute: caffeineCutoff + 90, milligrams: 80 }],
    },
  );

  it("fires all ten rules at once", () => {
    // Adding a rule to `RULES` without giving it something to fire on here fails this, which is
    // the intent: the coverage day is meant to keep pace with the engine.
    const advisories = evaluateRules(context);
    expect(new Set(advisories.map((advisory) => advisory.rule))).toEqual(new Set(RULE_IDS));
    expect(bedtime).toBeGreaterThan(lastFoodBy);
  });

  it("offers only fixes the API would accept, from every one of them", () => {
    const advisories = evaluateRules(context);
    for (const advisory of advisories) expectFixParses(advisory);

    // And every advisory is presentable: something to read, and a reason behind it.
    for (const advisory of advisories) {
      expect(advisory.message.length).toBeGreaterThan(0);
      expect(advisory.why.length).toBeGreaterThan(40);
      // Only the overlap check is allowed to cite nothing.
      if (advisory.rule !== "overlap") expect(advisory.scienceIds.length).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------- the shipped data */

describe("the four shipped presets", () => {
  /** A whole week from the reference Friday, so every weekday mask in the presets is exercised. */
  const week = Array.from({ length: 7 }, (_unused, index) =>
    toISODate(addDays(parseISODate(REFERENCE), index)),
  );

  it("has one preset per declared id", () => {
    expect(ROUTINE_PRESETS.map((preset) => preset.id)).toEqual([...PRESET_IDS]);
  });

  it("gives the engine nothing to say, on any day of the week", () => {
    for (const preset of ROUTINE_PRESETS) {
      for (const date of week) {
        const plan = planFor(
          {
            wakeOffsetMinutes: preset.wakeOffsetMinutes,
            sleepTargetMinutes: preset.sleepTargetMinutes,
          },
          date,
        );
        const advisories = evaluateRules({
          plan,
          day: resolveDay(plan, presetBlocks(preset)),
          // A fresh install: the track has not been started, so the deload rule holds its tongue.
          track: { id: preset.id === "hardcore" ? "hardcore" : "gentle", startedOn: null },
        });

        // Mapped to strings so a failure names the preset, the date and what was wrong with it.
        expect(
          advisories.map((advisory) => `${preset.id} ${date} ${advisory.rule}: ${advisory.message}`),
        ).toEqual([]);
      }
    }
  });
});
