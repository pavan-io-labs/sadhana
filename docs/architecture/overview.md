# Architecture Overview

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router) | Server Components + Route Handlers in one codebase |
| Language | TypeScript (`strict`) | Compile-time safety across the full stack |
| Styling | Tailwind CSS 4 | Consistent design tokens, no CSS drift |
| Database | SQLite via `@libsql/client` | No native compilation, one-URL swap to Turso |
| ORM | Drizzle ORM + drizzle-kit | Typed schema, real migrations, no codegen daemon |
| Validation | Zod | Every API boundary validated; types inferred |
| Client cache | TanStack Query | Optimistic updates, background refetch, offline retry |
| Charts | Recharts | Insights charts without hand-rolling SVG |
| Push | web-push + VAPID | Notifications with the app closed |
| Tests | Vitest | Fast, TypeScript-native unit testing |

## Rendering Strategy

**Server-first with client islands.** Pages are React Server Components by default. Interactive elements (timers, forms, charts) are `"use client"` components that hydrate on the client.

This means:
- Initial page loads are fast (no JS bundle for static content)
- Data fetching happens server-side (direct DB access, no waterfall)
- Only interactive components ship JavaScript to the browser

## Module Boundaries

```
                    +-----------+
                    |   Pages   |  app/
                    +-----+-----+
                          |
              +-----------+-----------+
              |                       |
        +-----+-----+         +------+------+
        | Components |         | API Routes  |  app/api/
        +-----+-----+         +------+------+
              |                       |
              +-----------+-----------+
                          |
                    +-----+-----+
                    |    lib/   |  Pure TypeScript
                    +-----+-----+
                          |
                    +-----+-----+
                    |   data/   |  Static catalogs
                    +-----------+
```

### The `lib/` Principle

All domain logic lives in `lib/` as **pure TypeScript** with:
- No React imports
- No database imports
- No side effects

This makes it directly testable and reusable on both server and client. The 321 unit tests all target `lib/` functions.

### The `data/` Catalogs

Static data (cities, exercises, evidence cards, videos, puzzles) lives in `data/` as typed TypeScript arrays. These are imported at build time and never mutated at runtime.

## Data Flow

```
Browser --> Next.js Route Handler --> lib/ functions --> Drizzle ORM --> SQLite
                                          |
                                     data/ catalogs (read-only)
```

1. Client sends a request (e.g., POST `/api/practice`)
2. Route handler validates input with Zod
3. Route handler calls `lib/` functions for business logic
4. `lib/` functions interact with the DB via Drizzle
5. Response is returned as JSON

## Key Design Decisions

- [ADR-001: SQLite over PostgreSQL](../decisions/001-sqlite-over-postgres.md)
- [ADR-002: No LLM in-app](../decisions/002-no-llm-in-app.md)
- [ADR-003: Anchor-based scheduling](../decisions/003-anchor-based-scheduling.md)
- [ADR-004: Proxy auth gate](../decisions/004-proxy-auth-gate.md)
- [ADR-005: Evidence tiering](../decisions/005-evidence-tiering.md)

## Related Documentation

- [Data Model](./data-model.md)
- [Schedule Engine](./schedule-engine.md)
- [API Routes](../api/routes.md)
