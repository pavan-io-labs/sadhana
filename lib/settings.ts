/**
 * The settings row, and the two projections of it the rest of the app consumes.
 *
 * Server-only  --  it touches the database. Client components receive `UiPreferences` or a
 * `DayPlan`, never the row itself, so nothing about the schema leaks into the bundle.
 *
 * Sadhana is single-user by design, so there is exactly one row, `id = 1`. It is created
 * on first read rather than by a seed step, which keeps `npm run dev` a single command.
 */

import { eq } from "drizzle-orm";
import { cache } from "react";

import { getDb, schema } from "./db";
import type { Settings } from "./db/schema";
import type { DayInput } from "./day";
import type { SettingsPatch } from "./validators";

/** There is one row, and this is it. Exported for `lib/blocks.ts`, which writes to it too. */
export const SETTINGS_ID = 1;

/**
 * The settings row, creating it with schema defaults if this is a fresh database.
 *
 * `onConflictDoNothing` rather than a check-then-insert: two requests can race on first
 * boot, and the unique primary key is the only reliable arbiter.
 */
export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const read = async (): Promise<Settings | undefined> => {
    const rows = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.id, SETTINGS_ID))
      .limit(1);
    return rows[0];
  };

  const existing = await read();
  if (existing) return existing;

  await db.insert(schema.settings).values({ id: SETTINGS_ID }).onConflictDoNothing();
  const created = await read();
  if (!created) throw new Error("Could not create the settings row");
  return created;
}

/**
 * `getSettings` deduplicated for the length of one render.
 *
 * The root layout, the app layout and the page each want the row, and without this that is
 * three identical queries per navigation. Deliberately *not* used in route handlers: those
 * write and then read back, and a memo would hand them the row as it was before the write.
 */
export const renderSettings = cache(getSettings);

/** Applies a validated patch and returns the row as it now stands. */
export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  await getSettings();
  const db = await getDb();
  const rows = await db
    .update(schema.settings)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.settings.id, SETTINGS_ID))
    .returning();
  if (!rows[0]) throw new Error("Settings row vanished mid-update");
  return rows[0];
}

/** Stamps onboarding as complete. Idempotent: the first timestamp is kept. */
export async function markOnboarded(): Promise<Settings> {
  const current = await getSettings();
  if (current.onboardedAt) return current;
  const db = await getDb();
  const now = new Date().toISOString();
  const rows = await db
    .update(schema.settings)
    .set({ onboardedAt: now, updatedAt: now })
    .where(eq(schema.settings.id, SETTINGS_ID))
    .returning();
  return rows[0] ?? current;
}

export function isOnboarded(settings: Settings): boolean {
  return settings.onboardedAt !== null && settings.onboardedAt !== "";
}

/** Everything `buildDayPlan` reads, and nothing else. */
export function dayInputFromSettings(settings: Settings): DayInput {
  return {
    city: settings.city,
    region: settings.region,
    latitude: settings.latitude,
    longitude: settings.longitude,
    timeZone: settings.timeZone,
    muhurtaMode: settings.muhurtaMode,
    wakeOffsetMinutes: settings.wakeOffsetMinutes,
    sleepTargetMinutes: settings.sleepTargetMinutes,
    caffeineCutoffHours: settings.caffeineCutoffHours,
    dinnerGapTargetMinutes: settings.dinnerGapTargetMinutes,
  };
}

/**
 * The presentation-only slice, safe to hand to client components.
 *
 * `theme`, `doshaAccent` and `reduceMotion` all end up as attributes on `<html>`, which
 * is what the CSS in `app/globals.css` selects on.
 */
export type UiPreferences = {
  theme: Settings["theme"];
  clock24h: boolean;
  doshaAccent: boolean;
  reduceMotion: boolean;
  timeZone: string;
  city: string;
  region: string;
};

export function uiPreferencesOf(settings: Settings): UiPreferences {
  return {
    theme: settings.theme,
    clock24h: settings.clock24h,
    doshaAccent: settings.doshaAccent,
    reduceMotion: settings.reduceMotion,
    timeZone: settings.timeZone,
    city: settings.city,
    region: settings.region,
  };
}
