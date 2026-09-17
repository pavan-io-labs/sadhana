/**
 * Reading and writing nourishment data: meals, caffeine, hydration.
 *
 * Three tables, one module, because the Nourish view reads all three on mount and they
 * share a date-centric query pattern. Each has its own schema and its own write function,
 * but the "everything for today" query is a single call.
 *
 * The interesting arithmetic is in the view, not here: the dinner→bed gap gauge and the
 * caffeine cutoff calculator need the day's schedule (bedtime, wake) which is computed
 * elsewhere. This module is the persistence layer.
 */

import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";

import { getDb, schema } from "./db";
import type { CaffeineLog, HydrationLog, Meal } from "./db/schema";
import type {
  CaffeineInput,
  HydrationInput,
  MealInput,
  MealPatch,
  NourishQuery,
} from "./validators";

export type { CaffeineLog, HydrationLog, Meal };

/* ---------------------------------------------------------------- day summary */

export type NourishDay = {
  meals: Meal[];
  caffeine: CaffeineLog[];
  hydration: HydrationLog | null;
};

/** Everything the Nourish view needs for one date. */
export async function nourishOn(date: string): Promise<NourishDay> {
  const db = await getDb();
  const [meals, caffeine, hydration] = await Promise.all([
    db
      .select()
      .from(schema.meals)
      .where(eq(schema.meals.date, date))
      .orderBy(asc(schema.meals.atMinute)),
    db
      .select()
      .from(schema.caffeineLogs)
      .where(eq(schema.caffeineLogs.date, date))
      .orderBy(asc(schema.caffeineLogs.atMinute)),
    db.select().from(schema.hydrationLogs).where(eq(schema.hydrationLogs.date, date)),
  ]);
  return { meals, caffeine, hydration: hydration[0] ?? null };
}

/* -------------------------------------------------------------------- meals */

export async function listMeals(query: NourishQuery): Promise<Meal[]> {
  const db = await getDb();
  const filters = [];
  if (query.date !== undefined) filters.push(eq(schema.meals.date, query.date));
  if (query.from !== undefined) filters.push(gte(schema.meals.date, query.from));
  if (query.to !== undefined) filters.push(lte(schema.meals.date, query.to));

  return db
    .select()
    .from(schema.meals)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.meals.date), asc(schema.meals.atMinute));
}

export async function createMeal(input: MealInput): Promise<Meal> {
  const db = await getDb();
  const [row] = await db
    .insert(schema.meals)
    .values({
      date: input.date,
      kind: input.kind,
      atMinute: input.atMinute,
      size: input.size,
      notes: input.notes,
    })
    .returning();
  if (!row) throw new Error("The meal insert returned no row");
  return row;
}

export async function updateMeal(id: number, patch: MealPatch): Promise<Meal | null> {
  const db = await getDb();
  const [row] = await db
    .update(schema.meals)
    .set(patch)
    .where(eq(schema.meals.id, id))
    .returning();
  return row ?? null;
}

export async function deleteMeal(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(schema.meals)
    .where(eq(schema.meals.id, id))
    .returning({ id: schema.meals.id });
  return rows.length > 0;
}

/* ----------------------------------------------------------------- caffeine */

export async function createCaffeine(input: CaffeineInput): Promise<CaffeineLog> {
  const db = await getDb();
  const [row] = await db
    .insert(schema.caffeineLogs)
    .values({
      date: input.date,
      atMinute: input.atMinute,
      milligrams: input.milligrams,
      source: input.source,
    })
    .returning();
  if (!row) throw new Error("The caffeine insert returned no row");
  return row;
}

export async function deleteCaffeine(id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .delete(schema.caffeineLogs)
    .where(eq(schema.caffeineLogs.id, id))
    .returning({ id: schema.caffeineLogs.id });
  return rows.length > 0;
}

/* ---------------------------------------------------------------- hydration */

/**
 * Set or increment the day's water total.
 *
 * An upsert: `milliliters` replaces, `addMilliliters` adds. The second is what the +250 ml
 * button sends, so a double-tap race cannot lose a glass  --  the SQL does the add atomically.
 */
export async function upsertHydration(input: HydrationInput): Promise<HydrationLog> {
  const db = await getDb();

  if (input.milliliters !== undefined) {
    // Absolute set.
    const [row] = await db
      .insert(schema.hydrationLogs)
      .values({ date: input.date, milliliters: input.milliliters })
      .onConflictDoUpdate({
        target: schema.hydrationLogs.date,
        set: {
          milliliters: input.milliliters,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    if (!row) throw new Error("The hydration upsert returned no row");
    return row;
  }

  // Relative add  --  atomic in SQL.
  const add = input.addMilliliters!;
  const [row] = await db
    .insert(schema.hydrationLogs)
    .values({ date: input.date, milliliters: Math.max(0, add) })
    .onConflictDoUpdate({
      target: schema.hydrationLogs.date,
      set: {
        milliliters: sql`max(0, ${schema.hydrationLogs.milliliters} + ${add})`,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();
  if (!row) throw new Error("The hydration upsert returned no row");
  return row;
}

/* ---------------------------------------------------------------- day logs */

/**
 * The day log  --  a single row per date with wake/sleep times, mood, energy, etc.
 *
 * Upserts on the date column, since there is only ever one entry per day.
 */

export type { DayLog } from "./db/schema";

export async function getDayLog(date: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.dayLogs).where(eq(schema.dayLogs.date, date));
  return row ?? null;
}

export async function upsertDayLog(
  date: string,
  patch: Partial<Omit<import("./db/schema").DayLog, "id" | "date" | "createdAt" | "updatedAt">>,
) {
  const db = await getDb();
  const [row] = await db
    .insert(schema.dayLogs)
    .values({ date, ...patch })
    .onConflictDoUpdate({
      target: schema.dayLogs.date,
      set: { ...patch, updatedAt: new Date().toISOString() },
    })
    .returning();
  if (!row) throw new Error("The day log upsert returned no row");
  return row;
}

export async function listDayLogs(from: string, to: string) {
  const db = await getDb();
  return db
    .select()
    .from(schema.dayLogs)
    .where(and(gte(schema.dayLogs.date, from), lte(schema.dayLogs.date, to)))
    .orderBy(desc(schema.dayLogs.date));
}
