/**
 * Database client.
 *
 * Server-only. Local development uses a SQLite file under `.data/`  --  dot-prefixed because it
 * is local state, unlike `data/`, which is committed source. Setting `SADHANA_DB_URL` to a
 * `libsql://` URL (plus `SADHANA_DB_AUTH_TOKEN`) points the same code at hosted Turso without
 * any other change.
 *
 * Migrations are applied lazily, once per process, the first time the database is
 * touched. That keeps `npm run dev` a single command with no setup step, which matters
 * for an app one person runs on their own machine. `npm run db:migrate` does the same
 * thing explicitly if you prefer to control it.
 */

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

const DEFAULT_DB_PATH = path.join(process.cwd(), ".data", "sadhana.db");
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

type Holder = {
  client?: Client;
  db?: Database;
  migrated?: Promise<void>;
};

// Turbopack and the Next dev server can evaluate a module more than once. A global
// holder keeps one connection and one migration run per process.
const globalHolder = globalThis as typeof globalThis & { __sadhanaDb?: Holder };
const holder: Holder = (globalHolder.__sadhanaDb ??= {});

function resolveUrl(): string {
  const configured = process.env.SADHANA_DB_URL?.trim();
  if (configured) return configured;
  mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
  return `file:${DEFAULT_DB_PATH}`;
}

function rawClient(): Client {
  if (!holder.client) {
    holder.client = createClient({
      url: resolveUrl(),
      authToken: process.env.SADHANA_DB_AUTH_TOKEN?.trim() || undefined,
    });
  }
  return holder.client;
}

/** The Drizzle handle. Prefer `getDb()`, which also guarantees migrations have run. */
export function dbUnsafe(): Database {
  if (!holder.db) {
    holder.db = drizzle(rawClient(), { schema });
  }
  return holder.db;
}

async function runMigrations(db: Database): Promise<void> {
  if (!existsSync(MIGRATIONS_FOLDER)) {
    throw new Error(
      `No migrations found at ${MIGRATIONS_FOLDER}. Run \`npm run db:generate\` first.`,
    );
  }
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/**
 * The database, with migrations applied. Every server-side reader and writer in the
 * app goes through this.
 */
export async function getDb(): Promise<Database> {
  const db = dbUnsafe();
  holder.migrated ??= runMigrations(db).catch((error) => {
    // Clear the memo so a transient failure can be retried on the next request.
    holder.migrated = undefined;
    throw error;
  });
  await holder.migrated;
  return db;
}

/** Closes the connection. Used by tests and scripts, not by request handling. */
export async function closeDb(): Promise<void> {
  holder.client?.close();
  holder.client = undefined;
  holder.db = undefined;
  holder.migrated = undefined;
}

export { schema };
