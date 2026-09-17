# Database Operations

## Engine

SQLite via `@libsql/client` + Drizzle ORM. The database file lives at `.data/sadhana.db` by default (gitignored).

## Migrations

### Apply Pending Migrations

```bash
npm run db:migrate
```

This runs all unapplied migrations from `drizzle/`. The database and `.data/` directory are created automatically if they do not exist.

### Generate a New Migration

After modifying `lib/db/schema.ts`:

```bash
npx drizzle-kit generate
```

This creates a new SQL migration file in `drizzle/`. Review it, then apply with `npm run db:migrate`.

### Inspect the Database

```bash
npx drizzle-kit studio
```

Opens Drizzle Studio in the browser for visual database inspection.

## Backup

### Local SQLite

```bash
cp .data/sadhana.db .data/sadhana-backup-$(date +%Y%m%d).db
```

### Turso

Turso handles replication and backup automatically. For manual snapshots:

```bash
turso db shell sadhana .dump > backup.sql
```

## Switching to Turso

1. Create a Turso database and token (see [Deployment](./deployment.md))
2. Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in `.env.local`
3. Run `npm run db:migrate` against Turso
4. Restart the dev/production server

The switch is a one-URL change -- no code modifications needed.

## Data Export / Import

### Export

```
GET /api/export
```

Returns a full JSON dump of all tables. Save this as a backup or for migration.

### Import

```
POST /api/import
Content-Type: application/json

{ "wipe": true, "data": { ... } }
```

With `wipe: true`, all existing data is deleted before import. Without it, data is merged.

## Schema Reference

See [Data Model](../architecture/data-model.md) for the complete schema.
