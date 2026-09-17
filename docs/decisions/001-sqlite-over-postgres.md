# ADR-001: SQLite over PostgreSQL

## Status

Accepted

## Context

The app needs a database for persistence. The primary deployment target is a single user running the app locally on their own machine. Options considered:

1. **PostgreSQL** -- the industry standard for relational data
2. **SQLite (local file)** -- embedded, zero-config
3. **SQLite via libSQL** -- embedded with a path to hosted (Turso)

## Decision

Use **SQLite via `@libsql/client`** with Drizzle ORM.

## Rationale

- **No native compilation**: `@libsql/client` ships prebuilt binaries. This avoids the most common Windows failure mode (Python/node-gyp/build tools missing).
- **Zero configuration**: no database server to install, configure, or maintain.
- **One-URL migration**: changing `DATABASE_URL` from `file:.data/sadhana.db` to `libsql://...turso.io` switches to hosted without code changes.
- **Sufficient for single-user**: SQLite handles the read/write patterns of one user with no contention.
- **Portable**: the entire database is a single file that can be copied, backed up, or moved.

## Consequences

- No concurrent multi-user writes (not needed for v1)
- No built-in replication (Turso adds this when needed)
- Schema is managed by Drizzle migrations (same as PostgreSQL would be)
- The ORM abstraction means switching to PostgreSQL later is a schema-level change, not a logic change
