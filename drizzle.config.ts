import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit only needs this for `db:generate` and the explicit `db:migrate`; the app
 * itself applies migrations through `lib/db/index.ts`.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.SADHANA_DB_URL ?? "file:./.data/sadhana.db",
  },
  strict: true,
  verbose: true,
});
