/**
 * Drizzle schema  --  SQLite over libSQL.
 *
 * Conventions, chosen so that no value in the database depends on the machine that
 * wrote it:
 *
 *  - **Dates** are `TEXT` in `YYYY-MM-DD`, always the user's local calendar date.
 *  - **Times of day** are `INTEGER` minutes from local midnight. May be negative
 *    (pre-midnight) or above 1440 (after midnight), which is how a 21:15 bedtime and a
 *    04:45 wake stay on the same "day".
 *  - **Instants** are `TEXT` ISO-8601 in UTC, used only for audit trails.
 *  - **Booleans** are `INTEGER` 0/1 via Drizzle's boolean mode.
 *
 * The whole schema lands in one migration even though later build phases fill most of
 * it, so the database never needs a destructive rebuild mid-project.
 */

import { relations } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ settings */

/**
 * Exactly one row, `id = 1`. Sadhana is single-user by design; a users table would be
 * a column of ones.
 */
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: false }).default(1),

  // Where the sun is.
  city: text("city").notNull().default("Hyderabad"),
  region: text("region").notNull().default("Telangana"),
  latitude: real("latitude").notNull().default(17.385),
  longitude: real("longitude").notNull().default(78.4867),
  timeZone: text("time_zone").notNull().default("Asia/Kolkata"),

  // How the day is derived.
  muhurtaMode: text("muhurta_mode", { enum: ["fixed", "proportional"] })
    .notNull()
    .default("fixed"),
  /** Wake time as an offset from sunrise, in minutes. Negative is before sunrise. */
  wakeOffsetMinutes: integer("wake_offset_minutes").notNull().default(-75),
  /** Target sleep duration in minutes; bedtime is derived as wake minus this. */
  sleepTargetMinutes: integer("sleep_target_minutes").notNull().default(465),
  chronotype: text("chronotype", {
    enum: ["early", "intermediate", "late", "unknown"],
  })
    .notNull()
    .default("unknown"),
  /** Answer score from the chronotype questionnaire, if taken. */
  chronotypeScore: integer("chronotype_score"),

  // What is being trained.
  activeTrack: text("active_track", { enum: ["gentle", "hardcore"] })
    .notNull()
    .default("gentle"),
  activeRoutineId: integer("active_routine_id"),
  trackStartedOn: text("track_started_on"),

  // Preferences.
  theme: text("theme", { enum: ["dark", "light", "system"] }).notNull().default("dark"),
  clock24h: integer("clock_24h", { mode: "boolean" }).notNull().default(false),
  doshaAccent: integer("dosha_accent", { mode: "boolean" }).notNull().default(true),
  reduceMotion: integer("reduce_motion", { mode: "boolean" }).notNull().default(false),
  notifyEnabled: integer("notify_enabled", { mode: "boolean" }).notNull().default(false),
  /** Hours before bedtime after which caffeine is flagged. */
  caffeineCutoffHours: real("caffeine_cutoff_hours").notNull().default(8.5),
  /** Minimum acceptable gap between last food and lights out, minutes. */
  dinnerGapTargetMinutes: integer("dinner_gap_target_minutes").notNull().default(180),

  onboardedAt: text("onboarded_at"),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
});

export type Settings = typeof settings.$inferSelect;
export type SettingsInsert = typeof settings.$inferInsert;

/* --------------------------------------------------------- routines & blocks */

export const routines = sqliteTable("routines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  /** Preset routines ship with the app and are restorable; user copies are not. */
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
});

/**
 * A block is a scheduled intention: an offset from an anchor, not a clock time. Edit
 * the anchor or move city and every block re-times itself correctly, forever.
 */
export const blocks = sqliteTable(
  "blocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    routineId: integer("routine_id")
      .notNull()
      .references(() => routines.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    category: text("category", {
      enum: [
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
      ],
    }).notNull(),
    anchor: text("anchor", {
      enum: [
        "sunrise",
        "sunset",
        "solarNoon",
        "brahmaMuhurta",
        "wake",
        "bedtime",
        "clock",
      ],
    })
      .notNull()
      .default("sunrise"),
    /** Minutes from the anchor. Negative is before it. */
    offsetMinutes: integer("offset_minutes").notNull().default(0),
    durationMinutes: integer("duration_minutes").notNull().default(15),
    /** Whether the block should be done fasted, fuelled, or either. */
    fuel: text("fuel", { enum: ["empty", "light", "fed", "any"] })
      .notNull()
      .default("any"),
    /** Bitmask, bit 0 = Sunday through bit 6 = Saturday. 127 is every day. */
    weekdayMask: integer("weekday_mask").notNull().default(127),
    notify: integer("notify", { mode: "boolean" }).notNull().default(false),
    notifyLeadMinutes: integer("notify_lead_minutes").notNull().default(5),
    sortOrder: integer("sort_order").notNull().default(0),
    icon: text("icon").notNull().default("dot"),
    /** Evidence card ids this block is justified by. */
    scienceIds: text("science_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Optional deep link into a feature view, e.g. "/practice?p=nadi-shodhana". */
    href: text("href"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    index("blocks_routine_idx").on(table.routineId),
    index("blocks_routine_order_idx").on(table.routineId, table.sortOrder),
  ],
);

export const routinesRelations = relations(routines, ({ many }) => ({
  blocks: many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  routine: one(routines, { fields: [blocks.routineId], references: [routines.id] }),
}));

export type Routine = typeof routines.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type BlockInsert = typeof blocks.$inferInsert;
export type BlockCategory = Block["category"];
export type BlockAnchor = Block["anchor"];
export type BlockFuel = Block["fuel"];

/* ------------------------------------------------------------ daily tracking */

export const dayLogs = sqliteTable(
  "day_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull().unique(),
    /** Actual wake time, minutes from midnight. */
    wakeMinute: integer("wake_minute"),
    /** Actual lights-out. Values above 1440 mean after midnight. */
    sleepMinute: integer("sleep_minute"),
    /** Self-reported sleep quality, 1-5. */
    sleepQuality: integer("sleep_quality"),
    restingHr: integer("resting_hr"),
    mood: integer("mood"),
    energy: integer("energy"),
    /** Did the single most important task happen before solar noon? */
    hardTaskBeforeNoon: integer("hard_task_before_noon", { mode: "boolean" }),
    /** Did daylight exposure happen within an hour of waking? */
    morningLight: integer("morning_light", { mode: "boolean" }),
    notes: text("notes").notNull().default(""),
    /** Tomorrow's single most important task, captured in the evening review. */
    tomorrowIntention: text("tomorrow_intention").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("day_logs_date_idx").on(table.date)],
);

export const blockCompletions = sqliteTable(
  "block_completions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    blockId: integer("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["done", "skipped"] }).notNull(),
    at: text("at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    uniqueIndex("block_completions_unique").on(table.date, table.blockId),
    index("block_completions_date_idx").on(table.date),
  ],
);

export type DayLog = typeof dayLogs.$inferSelect;
export type BlockCompletion = typeof blockCompletions.$inferSelect;

/* ---------------------------------------------------------------- training */

export const workouts = sqliteTable(
  "workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    track: text("track", { enum: ["gentle", "hardcore", "custom"] })
      .notNull()
      .default("gentle"),
    sessionSlug: text("session_slug").notNull(),
    sessionName: text("session_name").notNull(),
    /** Minutes from midnight the session started. */
    startMinute: integer("start_minute"),
    durationMinutes: integer("duration_minutes"),
    /** Whether the session was done fasted. Drives the fasted-heavy-lift rule. */
    fasted: integer("fasted", { mode: "boolean" }).notNull().default(false),
    sessionRpe: integer("session_rpe"),
    /** Week number inside the current mesocycle, for deload flagging. */
    weekInCycle: integer("week_in_cycle"),
    isDeload: integer("is_deload", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("workouts_date_idx").on(table.date)],
);

export const workoutSets = sqliteTable(
  "workout_sets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workoutId: integer("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseSlug: text("exercise_slug").notNull(),
    setIndex: integer("set_index").notNull(),
    reps: integer("reps"),
    weightKg: real("weight_kg"),
    /** Held time in seconds, for planks and isometrics. */
    holdSeconds: integer("hold_seconds"),
    rpe: real("rpe"),
    isWarmup: integer("is_warmup", { mode: "boolean" }).notNull().default(false),
    completed: integer("completed", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    index("workout_sets_workout_idx").on(table.workoutId),
    index("workout_sets_exercise_idx").on(table.exerciseSlug),
  ],
);

export const workoutsRelations = relations(workouts, ({ many }) => ({
  sets: many(workoutSets),
}));

export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  workout: one(workouts, { fields: [workoutSets.workoutId], references: [workouts.id] }),
}));

export type Workout = typeof workouts.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;

/* --------------------------------------------------------------- practice */

export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    kind: text("kind", {
      enum: ["meditation", "pranayama", "nidra", "abhyanga", "walk", "journal", "mantra"],
    }).notNull(),
    /** Practice slug, e.g. "nadi-shodhana". Empty for untyped sessions. */
    practiceSlug: text("practice_slug").notNull().default(""),
    startMinute: integer("start_minute"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    rounds: integer("rounds"),
    /** Confirmed an empty stomach, for the practices that require it. */
    emptyStomachConfirmed: integer("empty_stomach_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("practice_sessions_date_idx").on(table.date)],
);

export type PracticeSession = typeof practiceSessions.$inferSelect;

/* ----------------------------------------------------------------- nourish */

export const meals = sqliteTable(
  "meals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    kind: text("kind", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
    /** Minutes from midnight the meal was eaten. */
    atMinute: integer("at_minute").notNull(),
    /** Rough share of the day's food, 1 (nibble) to 5 (the main meal). */
    size: integer("size").notNull().default(3),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("meals_date_idx").on(table.date)],
);

export const caffeineLogs = sqliteTable(
  "caffeine_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    atMinute: integer("at_minute").notNull(),
    milligrams: integer("milligrams").notNull().default(80),
    source: text("source").notNull().default("coffee"),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("caffeine_logs_date_idx").on(table.date)],
);

export const hydrationLogs = sqliteTable(
  "hydration_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull().unique(),
    milliliters: integer("milliliters").notNull().default(0),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("hydration_logs_date_idx").on(table.date)],
);

export type Meal = typeof meals.$inferSelect;
export type CaffeineLog = typeof caffeineLogs.$inferSelect;
export type HydrationLog = typeof hydrationLogs.$inferSelect;

/* ---------------------------------------------------------------- mind gym */

export const gameResults = sqliteTable(
  "game_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    game: text("game", {
      enum: ["pvt", "stroop", "nback", "gonogo", "digit-span", "corsi", "insight"],
    }).notNull(),
    at: text("at").notNull().$defaultFn(nowIso),
    /** Minutes from midnight, so results can be aligned against wake time. */
    atMinute: integer("at_minute"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    /** The single headline number for trend charts. Units differ per game. */
    primaryMetric: real("primary_metric"),
    /** Full typed metric bag; see lib/scoring for the shape per game. */
    metrics: text("metrics", { mode: "json" })
      .$type<Record<string, number | null>>()
      .notNull()
      .default({}),
    /** Practice runs are stored but excluded from trends. */
    isPractice: integer("is_practice", { mode: "boolean" }).notNull().default(false),
    notes: text("notes").notNull().default(""),
  },
  (table) => [
    index("game_results_date_idx").on(table.date),
    index("game_results_game_idx").on(table.game, table.date),
  ],
);

export type GameResult = typeof gameResults.$inferSelect;
export type GameId = GameResult["game"];

/* ----------------------------------------------------------------- science */

/** Papers saved from the Europe PMC / Crossref proxy. */
export const papers = sqliteTable(
  "papers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source", { enum: ["europepmc", "crossref", "manual"] }).notNull(),
    doi: text("doi"),
    pmid: text("pmid"),
    pmcid: text("pmcid"),
    title: text("title").notNull(),
    authors: text("authors").notNull().default(""),
    journal: text("journal").notNull().default(""),
    year: integer("year"),
    abstract: text("abstract").notNull().default(""),
    url: text("url").notNull().default(""),
    /** Publication type as classified by the ranker, e.g. "meta-analysis". */
    evidenceType: text("evidence_type").notNull().default("other"),
    isOpenAccess: integer("is_open_access", { mode: "boolean" }).notNull().default(false),
    citedByCount: integer("cited_by_count"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** Evidence card ids this paper was saved against. */
    cardIds: text("card_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    note: text("note").notNull().default(""),
    savedAt: text("saved_at").notNull().$defaultFn(nowIso),
  },
  (table) => [
    uniqueIndex("papers_doi_unique").on(table.doi),
    index("papers_saved_idx").on(table.savedAt),
  ],
);

/** User annotations against a curated evidence card. */
export const scienceNotes = sqliteTable(
  "science_notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cardId: text("card_id").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: text("updated_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("science_notes_card_idx").on(table.cardId)],
);

/** Server-side cache for the literature proxy, so repeat searches are free. */
export const searchCache = sqliteTable("search_cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  fetchedAt: text("fetched_at").notNull().$defaultFn(nowIso),
});

/** Cached solar/muhurta results, keyed by location and date. */
export const astroCache = sqliteTable("astro_cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  computedAt: text("computed_at").notNull().$defaultFn(nowIso),
});

export type Paper = typeof papers.$inferSelect;
export type ScienceNote = typeof scienceNotes.$inferSelect;

/* -------------------------------------------------------------------- push */

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    timeZone: text("time_zone").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(nowIso),
    lastSeenAt: text("last_seen_at").notNull().$defaultFn(nowIso),
  },
  (table) => [index("push_endpoint_idx").on(table.endpoint)],
);

/** One row per notification actually sent, so reminders are not fired twice. */
export const notificationLog = sqliteTable(
  "notification_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    /** 0 when the notification is not tied to a specific block. */
    blockId: integer("block_id").notNull().default(0),
    kind: text("kind").notNull(),
    sentAt: text("sent_at").notNull().$defaultFn(nowIso),
  },
  (table) => [uniqueIndex("notification_unique").on(table.date, table.blockId, table.kind)],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

/** Every table, for the export/import and wipe endpoints. */
export const allTables = {
  settings,
  routines,
  blocks,
  dayLogs,
  blockCompletions,
  workouts,
  workoutSets,
  practiceSessions,
  meals,
  caffeineLogs,
  hydrationLogs,
  gameResults,
  papers,
  scienceNotes,
  pushSubscriptions,
  notificationLog,
} as const;
