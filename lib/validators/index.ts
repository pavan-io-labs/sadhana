/**
 * Zod schemas for every API boundary.
 *
 * One definition per concept, used by the route handler to validate and by the client
 * to infer types, so a field cannot drift between the two. Nothing here touches the
 * database or the request object  --  the schemas are pure, so they are testable and
 * usable on both sides of the network.
 */

import { z } from "zod";

import { isISODate, isValidTimeZone } from "@/lib/time";

/* --------------------------------------------------------------- primitives */

export const isoDateSchema = z
  .string()
  .refine(isISODate, { message: "Expected a real calendar date as YYYY-MM-DD" });

export const latitudeSchema = z.coerce.number().min(-90).max(90);
export const longitudeSchema = z.coerce.number().min(-180).max(180);

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: "Unknown IANA time zone" });

export const muhurtaModeSchema = z.enum(["fixed", "proportional"]);
export const chronotypeSchema = z.enum(["early", "intermediate", "late", "unknown"]);
export const trackSchema = z.enum(["gentle", "hardcore"]);
export const themeSchema = z.enum(["dark", "light", "system"]);

/**
 * The enums as types, inferred rather than re-declared.
 *
 * `MuhurtaMode` is not re-exported here: `lib/muhurta.ts` owns it, and the schema above is
 * checked against it where the two meet.
 */
export type Chronotype = z.infer<typeof chronotypeSchema>;
export type TrackId = z.infer<typeof trackSchema>;
export type Theme = z.infer<typeof themeSchema>;

/** Minutes from local midnight. Deliberately wide: pre-midnight and post-midnight are legal. */
export const minuteOfDaySchema = z.coerce.number().int().min(-720).max(2160);

/**
 * The text-to-number conversion the field helpers share.
 *
 * Split out because the hazard is the same whether the field takes whole numbers or halves:
 * `Number("")` is `0`, `Number("   ")` is `0`, `Number("1e3")` is `1000` and `Number("0x1e")` is
 * `30`. So text is converted only when it matches `pattern`, and anything else becomes `NaN` for
 * the number check downstream to reject by name.
 */
function fromText(pattern: RegExp) {
  return (value: number | string): number => {
    if (typeof value === "number") return value;
    const text = value.trim();
    return pattern.test(text) ? Number(text) : Number.NaN;
  };
}

/**
 * A whole number of minutes, arriving either as a number or as the text of a form field.
 *
 * `z.coerce.number()` is the wrong tool for anything a text box feeds, because `Number("")` is
 * `0`. A cleared field would therefore parse *cleanly* as zero and save without a word, which is
 * the single outcome `components/timeline/block-form.tsx` is built to prevent.
 *
 * The union rather than `z.preprocess` is what keeps `z.input` at `number | string`: the presets
 * in `data/routines.ts` and the one-tap fixes in `lib/rules.ts` build blocks in TypeScript, and
 * they should still be type-checked on these fields rather than handed an `unknown`.
 */
function intField(label: string, min: number, max: number, unit = " of minutes") {
  const signed = (value: number) => (value < 0 ? `−${Math.abs(value)}` : String(value));
  const blank = { error: `${label} needs a whole number${unit}.` };
  const whole = { error: `${label} has to be a whole number${unit}.` };
  const range = { error: `${label} has to be between ${signed(min)} and ${signed(max)}.` };

  return z
    .union([z.number(), z.string()], blank)
    .transform(fromText(/^[+-]?\d+$/))
    .pipe(z.number(blank).int(whole).min(min, range).max(max, range));
}

/**
 * The same, for the two measurements that come in halves: a weight on the bar and an RPE.
 *
 * 2.5 kg is the smallest plate most gyms own, and "seven and a half" is how people actually
 * report effort, so refusing a decimal here would push the user into rounding their own data.
 */
function decimalField(label: string, min: number, max: number, unit: string) {
  const blank = { error: `${label} needs a number${unit}.` };
  const range = { error: `${label} has to be between ${min} and ${max}.` };

  return z
    .union([z.number(), z.string()], blank)
    .transform(fromText(/^[+-]?\d+(?:\.\d+)?$/))
    .pipe(z.number(blank).min(min, range).max(max, range));
}

/** A numeric field, before it is made optional. Loose on purpose: only the wrapper reads it. */
type NumericField = z.ZodType<number, number | string>;

/**
 * A measurement that may legitimately be absent, where blank means "not measured".
 *
 * The opposite of `intField`'s deliberate refusal to accept a cleared box, and the difference is
 * what the field means rather than a change of mind: a cleared block duration is a mistake, while
 * a cleared weight on a push-up is the truth. Text that is neither blank nor a number still fails,
 * so "abc" cannot become `null` and pass for an honest gap in the log.
 */
function nullableField(field: NumericField) {
  return z
    .union([z.number(), z.string(), z.null()])
    .transform((value) => (typeof value === "string" && value.trim() === "" ? null : value))
    .pipe(field.nullable())
    .default(null);
}

/** A data-file identifier: an exercise, a session, a practice, an evidence card. */
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, { message: "Expected a lower-case slug" });

export const locationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  timeZone: timeZoneSchema,
});

export type LocationInput = z.infer<typeof locationSchema>;

/* -------------------------------------------------------------- /api/astro */

/**
 * Every field is optional: with none supplied the handler answers for today at the
 * saved location, which is what the Today view asks for.
 */
export const astroQuerySchema = z.object({
  date: isoDateSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  timeZone: timeZoneSchema.optional(),
  mode: muhurtaModeSchema.optional(),
  /** How many consecutive days to return, starting at `date`. */
  days: z.coerce.number().int().min(1).max(90).default(1),
});

export type AstroQuery = z.infer<typeof astroQuerySchema>;

/* ------------------------------------------------------------------ settings */

/**
 * A location can be given either as a listed city id or as raw coordinates. Both
 * end up stored the same way; the city id only supplies the display name.
 */
export const locationChoiceSchema = z.union([
  z.object({ cityId: z.string().min(1) }),
  z.object({
    city: z.string().min(1).max(80),
    region: z.string().max(80).default(""),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    timeZone: timeZoneSchema,
  }),
]);

export type LocationChoice = z.infer<typeof locationChoiceSchema>;

/**
 * Everything Settings can change, all of it optional.
 *
 * `activeRoutineId` is deliberately absent. It is a foreign key the app maintains, and no
 * amount of Zod can check that the integer names a routine that exists  --  `activateRoutine`
 * in `lib/blocks.ts` does that against the table, and is the only way it gets written.
 */
export const settingsPatchSchema = z
  .object({
    city: z.string().min(1).max(80),
    region: z.string().max(80),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    timeZone: timeZoneSchema,
    muhurtaMode: muhurtaModeSchema,
    /** Negative is before sunrise; the presets range from -105 to +30. */
    wakeOffsetMinutes: z.coerce.number().int().min(-240).max(240),
    /** 5h to 11h. Below 7h the rules engine raises an advisory rather than refusing. */
    sleepTargetMinutes: z.coerce.number().int().min(300).max(660),
    chronotype: chronotypeSchema,
    chronotypeScore: z.coerce.number().int().min(4).max(25).nullable(),
    activeTrack: trackSchema,
    trackStartedOn: isoDateSchema.nullable(),
    theme: themeSchema,
    clock24h: z.boolean(),
    doshaAccent: z.boolean(),
    reduceMotion: z.boolean(),
    notifyEnabled: z.boolean(),
    caffeineCutoffHours: z.coerce.number().min(0).max(16),
    dinnerGapTargetMinutes: z.coerce.number().int().min(0).max(480),
  })
  .partial();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/* ---------------------------------------------------------- blocks & routines */

/**
 * The four block enums, declared here for the wire and checked against both the Drizzle
 * columns and the engine's unions in `lib/blocks.ts`.
 */
export const blockCategorySchema = z.enum([
  "sleep",
  "hygiene",
  "practice",
  "movement",
  "training",
  "light",
  "food",
  "work",
  "admin",
  "social",
  "winddown",
  "mindgym",
]);

export const blockAnchorSchema = z.enum([
  "sunrise",
  "sunset",
  "solarNoon",
  "brahmaMuhurta",
  "wake",
  "bedtime",
  "clock",
]);

export const blockFuelSchema = z.enum(["empty", "light", "fed", "any"]);
export const presetIdSchema = z.enum(["traditional", "sandhya", "gentle", "hardcore"]);

export type BlockCategoryInput = z.infer<typeof blockCategorySchema>;
export type BlockAnchorInput = z.infer<typeof blockAnchorSchema>;
export type BlockFuelInput = z.infer<typeof blockFuelSchema>;
export type PresetIdInput = z.infer<typeof presetIdSchema>;

/**
 * One block as the Timeline editor sends it.
 *
 * `offsetMinutes` spans a full day forwards and half a day back, because the same field means
 * two things: a minute of the day when `anchor` is `clock`, and a signed offset otherwise  -- 
 * and the bedtime-anchored blocks in the shipped presets reach -300. `sortOrder` is absent on
 * purpose: position is the server's business, set on create and changed only by a reorder.
 */
export const blockInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  detail: z.string().trim().max(400).default(""),
  category: blockCategorySchema,
  anchor: blockAnchorSchema.default("sunrise"),
  offsetMinutes: intField("The offset", -720, 1440),
  durationMinutes: intField("The duration", 0, 720),
  fuel: blockFuelSchema.default("any"),
  /** Seven bits, Sunday first. 0 means the block never runs, which is legal. */
  weekdayMask: intField("The weekday mask", 0, 127, "").default(127),
  notify: z.boolean().default(false),
  notifyLeadMinutes: intField("The lead time", 0, 120).default(5),
  icon: z.string().trim().min(1).max(32).default("dot"),
  scienceIds: z.array(z.string().trim().min(1).max(64)).max(12).default([]),
  /** An in-app path, so it is relative by construction  --  never an absolute URL. */
  href: z
    .string()
    .trim()
    .max(200)
    .regex(/^\/[\w\-/[\]]*$/, { message: "Expected an in-app path starting with /" })
    .nullable()
    .default(null),
  enabled: z.boolean().default(true),
});

export type BlockInput = z.infer<typeof blockInputSchema>;

/**
 * The same fields *before* Zod fills the defaults  --  what a caller actually has to supply.
 *
 * `BlockInput` is the parsed shape, where every field is present because the schema put it
 * there. Anything constructing a block to send (the editor's new-block form, a rule's one-tap
 * fix) wants this one, where the eight defaulted fields are optional.
 */
export type BlockDraft = z.input<typeof blockInputSchema>;

/**
 * The twelve fields the Timeline editor puts on screen  --  and therefore the twelve it sends.
 *
 * The two it leaves out are the reason this exists rather than the editor reaching for
 * `blockInputSchema` directly. `href` and `scienceIds` are set by `data/routines.ts`, not by a
 * user: one is an in-app path that has to name a route that exists, the other a list of evidence
 * card ids. Parsing a form against the full schema would fill both from their defaults  --  `null`
 * and `[]`  --  and a PATCH carrying those would quietly strip a shipped block of its deep link and
 * its citations. Narrowing the schema makes that impossible instead of merely unlikely.
 */
export const blockFieldsSchema = blockInputSchema.pick({
  title: true,
  detail: true,
  category: true,
  anchor: true,
  offsetMinutes: true,
  durationMinutes: true,
  fuel: true,
  weekdayMask: true,
  notify: true,
  notifyLeadMinutes: true,
  icon: true,
  enabled: true,
});

export type BlockFields = z.infer<typeof blockFieldsSchema>;

/** Editing an existing block: any subset of the same fields. */
export const blockPatchSchema = blockInputSchema.partial();

export type BlockPatch = z.infer<typeof blockPatchSchema>;

/** Drag-and-drop, sent as the whole new order rather than one moved index. */
export const blockReorderSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(200),
});

export type BlockReorder = z.infer<typeof blockReorderSchema>;

/**
 * Turning several blocks on or off in one request.
 *
 * `enabled` is required rather than a toggle: the client knows which state it is moving a
 * selection into, and a toggle applied to a mixed selection has no sensible meaning.
 */
export const blockEnableSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(200),
  enabled: z.boolean(),
});

export type BlockEnable = z.infer<typeof blockEnableSchema>;

/**
 * Choosing which routine the day is built from  --  one of two quite different requests.
 *
 * `routineId` only moves the pointer, and is safe to call at will. `preset` **reinstalls**, which
 * replaces that preset's blocks and, by cascade, every mark ever made against them. `replace`
 * must be the literal `true` for that branch to parse, so the destructive call cannot be reached
 * by a client that has not said out loud what it is asking for.
 */
export const routineSelectSchema = z.union([
  z.object({ routineId: z.coerce.number().int().positive() }),
  z.object({ preset: presetIdSchema, replace: z.literal(true) }),
]);

export type RoutineSelect = z.infer<typeof routineSelectSchema>;

/* --------------------------------------------------------------- completions */

export const completionStatusSchema = z.enum(["done", "skipped"]);

/**
 * Marking a block, in the three shapes the Today view needs.
 *
 * `toggle` is the tap: it sets the status, or clears it if the block already has exactly that
 * status, so tapping a done block undoes it. `set` is idempotent, which is what a retried
 * request should be. `clear` is the explicit undo.
 */
export const completionInputSchema = z.object({
  date: isoDateSchema,
  blockId: z.coerce.number().int().positive(),
  status: completionStatusSchema.default("done"),
  mode: z.enum(["toggle", "set", "clear"]).default("toggle"),
});

export type CompletionInput = z.infer<typeof completionInputSchema>;

/** Reading marks back: one date, or a range for the adherence heatmap. */
export const completionQuerySchema = z.object({
  date: isoDateSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type CompletionQuery = z.infer<typeof completionQuerySchema>;

/* ---------------------------------------------------- /api/schedule/resolve */

/**
 * `days` is capped well below `/api/astro`'s 90: each day here also resolves every block and
 * scans for conflicts, and the two callers that want a range  --  the week strip and the heatmap  -- 
 * ask for 7 and 31.
 */
export const scheduleQuerySchema = z.object({
  date: isoDateSchema.optional(),
  days: z.coerce.number().int().min(1).max(31).default(1),
  includeDisabled: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(false),
  /** Minutes of unscheduled time worth mentioning. Matches the engine's own default. */
  gapThreshold: z.coerce.number().int().min(15).max(720).default(90),
});

export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;

/* ------------------------------------------------------------------- workouts */

/** `custom` is for a session logged that no preset prescribes  --  an away-from-home improvisation. */
export const workoutTrackSchema = z.enum(["gentle", "hardcore", "custom"]);

/**
 * One set as the logger sends it.
 *
 * All four measurements are nullable because the movements use different ones  --  a squat has reps
 * and weight, a plank has held seconds, a walk has neither  --  and a set is not invalid for lacking
 * the three that do not apply to it. Which inputs appear is `data/exercises.ts`'s `measure`
 * field's business; the wire accepts whichever the exercise actually has.
 */
export const workoutSetInputSchema = z.object({
  exerciseSlug: slugSchema,
  /** Zero-based, matching the column. The UI numbers them from one. */
  setIndex: intField("The set number", 0, 49, ""),
  reps: nullableField(intField("Reps", 0, 500, "")),
  weightKg: nullableField(decimalField("The weight", 0, 500, " of kilograms")),
  holdSeconds: nullableField(intField("The hold", 0, 3600, " of seconds")),
  rpe: nullableField(decimalField("RPE", 1, 10, "")),
  isWarmup: z.boolean().default(false),
  /** False for a set that was planned and abandoned: it stays in the log and counts for nothing. */
  completed: z.boolean().default(true),
});

export type WorkoutSetInput = z.infer<typeof workoutSetInputSchema>;
export type WorkoutSetDraft = z.input<typeof workoutSetInputSchema>;

/**
 * A whole session, sets and all, in one request.
 *
 * One request rather than a create followed by N set posts, because a half-written workout is
 * worse than none: it would feed `suggestLoad` a session where two of five sets are missing and
 * produce a confident "hold" from an accident. `lib/workouts.ts` writes it in a transaction for
 * the same reason.
 *
 * `weekInCycle` and `isDeload` are sent rather than derived here because the server would have to
 * re-read settings to compute them, and the client already has the number on screen in the session
 * header  --  but they are validated, so a client cannot invent week 900.
 */
export const workoutInputSchema = z.object({
  date: isoDateSchema,
  track: workoutTrackSchema.default("gentle"),
  sessionSlug: slugSchema,
  sessionName: z.string().trim().min(1).max(120),
  startMinute: nullableField(intField("The start time", -720, 2160, "")),
  durationMinutes: nullableField(intField("The duration", 0, 480, "")),
  fasted: z.boolean().default(false),
  /** Whole numbers only: the column is an integer, and session-level effort is not a half-point. */
  sessionRpe: nullableField(intField("Session RPE", 1, 10, "")),
  weekInCycle: nullableField(intField("The week", 1, 520, "")),
  isDeload: z.boolean().default(false),
  notes: z.string().trim().max(1000).default(""),
  sets: z.array(workoutSetInputSchema).max(120).default([]),
});

export type WorkoutInput = z.infer<typeof workoutInputSchema>;
export type WorkoutDraft = z.input<typeof workoutInputSchema>;

/**
 * Editing a logged session.
 *
 * `date` and `sessionSlug` are omitted before the partial: moving a session to another day or
 * relabelling which session it was would silently rewrite the history `suggestLoad` reads, and the
 * honest way to do that is to delete the row and log it again. `sets`, when present, replaces the
 * whole list rather than merging  --  a merge would need stable set ids the logger does not have.
 */
export const workoutPatchSchema = workoutInputSchema
  .omit({ date: true, sessionSlug: true })
  .partial();

export type WorkoutPatch = z.infer<typeof workoutPatchSchema>;

/** Reading sessions back: one date, a range for the charts, or one movement's history. */
export const workoutQuerySchema = z.object({
  date: isoDateSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  /** Narrows to the sessions containing this movement  --  what the overload card asks for. */
  exerciseSlug: slugSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

export type WorkoutQuery = z.infer<typeof workoutQuerySchema>;

/* ------------------------------------------------------------------- practice */

export const practiceKindSchema = z.enum([
  "meditation",
  "pranayama",
  "nidra",
  "abhyanga",
  "walk",
  "journal",
  "mantra",
]);

export type PracticeKind = z.infer<typeof practiceKindSchema>;

/**
 * One finished practice.
 *
 * `emptyStomachConfirmed` is a stored fact, not a UI detail. Kapalabhati and Bhastrika are gated
 * behind that confirmation in `/practice`, and recording the answer is what makes the gate more
 * than a dialog the user clicks through  --  the log can then show a session that was started
 * against the caution, and `lib/rules.ts` has something real to read.
 *
 * Seconds rather than minutes because the meditation timer counts in seconds and a four-minute-
 * fifty session is not a five-minute one.
 */
export const practiceInputSchema = z.object({
  date: isoDateSchema,
  kind: practiceKindSchema,
  /** Empty for an untyped sit; a slug like `nadi-shodhana` when the practice is a named one. */
  practiceSlug: z.union([slugSchema, z.literal("")]).default(""),
  startMinute: nullableField(intField("The start time", -720, 2160, "")),
  durationSeconds: intField("The duration", 0, 14400, " of seconds").default(0),
  rounds: nullableField(intField("Rounds", 0, 1000, "")),
  emptyStomachConfirmed: z.boolean().default(false),
  notes: z.string().trim().max(1000).default(""),
});

export type PracticeInput = z.infer<typeof practiceInputSchema>;
export type PracticeDraft = z.input<typeof practiceInputSchema>;

export const practiceQuerySchema = z.object({
  date: isoDateSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  kind: practiceKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type PracticeQuery = z.infer<typeof practiceQuerySchema>;

/* -------------------------------------------------------------------- nourish */

export const mealKindSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export type MealKind = z.infer<typeof mealKindSchema>;

/**
 * A meal, recorded by *when* rather than by what.
 *
 * No calories, no macros, no food names  --  the routine's claims are about timing and relative
 * size, and a food diary the app cannot check would add work without adding a fact. `size` is the
 * one qualitative field, because "lunch as the main meal" is the whole point of the eating window
 * and a 1-5 share is something a person can answer honestly in a second.
 */
export const mealInputSchema = z.object({
  date: isoDateSchema,
  kind: mealKindSchema,
  atMinute: intField("The time", -720, 2160, ""),
  size: intField("The size", 1, 5, "").default(3),
  notes: z.string().trim().max(400).default(""),
});

export type MealInput = z.infer<typeof mealInputSchema>;
export type MealDraft = z.input<typeof mealInputSchema>;

export const mealPatchSchema = mealInputSchema.omit({ date: true }).partial();

export type MealPatch = z.infer<typeof mealPatchSchema>;

/**
 * A caffeine dose.
 *
 * Milligrams because the cutoff arithmetic is about dose as well as timing, and "a coffee" ranges
 * from 40 mg to 200. The default of 80 is a single home-brewed cup, which is the most common entry
 * and the one worth making free to log.
 */
export const caffeineInputSchema = z.object({
  date: isoDateSchema,
  atMinute: intField("The time", -720, 2160, ""),
  milligrams: intField("The dose", 0, 1000, " of milligrams").default(80),
  source: z.string().trim().min(1).max(40).default("coffee"),
});

export type CaffeineInput = z.infer<typeof caffeineInputSchema>;
export type CaffeineDraft = z.input<typeof caffeineInputSchema>;

/**
 * The day's water, as a running total rather than a list of glasses.
 *
 * One row per date, so this is an upsert: `milliliters` replaces, `addMilliliters` adds. The
 * second form is what the +250 ml button sends, and doing that as read-then-write on the client
 * would lose a tap to any race with itself.
 */
export const hydrationInputSchema = z
  .object({
    date: isoDateSchema,
    milliliters: intField("The amount", 0, 20000, " of millilitres").optional(),
    addMilliliters: intField("The amount", -5000, 5000, " of millilitres").optional(),
  })
  .refine((value) => value.milliliters !== undefined || value.addMilliliters !== undefined, {
    error: "Send either a total or an amount to add.",
    path: ["milliliters"],
  });

export type HydrationInput = z.infer<typeof hydrationInputSchema>;

export const nourishQuerySchema = z.object({
  date: isoDateSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type NourishQuery = z.infer<typeof nourishQuerySchema>;

/* ---------------------------------------------------------------- onboarding */

/**
 * The three answers first-run onboarding collects. Everything else has a sane
 * default, so this is the shortest path from a blank database to a usable day.
 */
export const onboardingSchema = z.object({
  location: locationChoiceSchema,
  chronotype: chronotypeSchema.default("unknown"),
  chronotypeScore: z.coerce.number().int().min(4).max(25).nullable().default(null),
  activeTrack: trackSchema.default("gentle"),
  muhurtaMode: muhurtaModeSchema.default("fixed"),
  wakeOffsetMinutes: z.coerce.number().int().min(-240).max(240).default(-75),
  sleepTargetMinutes: z.coerce.number().int().min(300).max(660).default(465),
  /** Which shipped preset to install as the starting routine. */
  preset: presetIdSchema.default("sandhya"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/* ------------------------------------------------------------------- helpers */

/** Field-keyed error map, shaped for rendering next to inputs. */
export type FieldErrors = Record<string, string[]>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Validate `URLSearchParams` against an object schema.
 *
 * Repeated keys collapse to the last value, which matches how the app builds URLs and
 * avoids surprising array coercion.
 */
export function parseSearchParams<T extends z.ZodType>(
  schema: T,
  params: URLSearchParams,
): z.ZodSafeParseResult<z.output<T>> {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) raw[key] = value;
  return schema.safeParse(raw);
}
