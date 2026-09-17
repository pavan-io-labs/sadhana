# Getting Started

## Prerequisites

- **Node.js** 24.x LTS (or later)
- **npm** 11.x (ships with Node 24)
- **Git** 2.x

## Installation

```bash
git clone <repo-url>
cd Sadhana
npm install
```

## Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values. For local development, all variables are optional -- the app runs fully without them. See [Environment Variables](./operations/environment.md) for details.

## Database

The database is SQLite, stored at `.data/sadhana.db`. It is created automatically on first run via Drizzle migrations:

```bash
npm run db:migrate
```

If the `.data/` directory does not exist, it will be created. The database file is gitignored.

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first visit, the onboarding flow will guide you through:

1. **Location** -- select from ~60 Indian cities, use browser geolocation, or enter lat/lng manually.
2. **Chronotype** -- take the reduced MEQ (5 questions) or skip with a default.
3. **Track** -- choose Traditional, Sandhya, Gentle A, or Hardcore B.
4. **Day Preview** -- see your computed schedule before confirming.

## Project Structure

```
Sadhana/
  app/           Pages (App Router) and API route handlers
  components/    React components (client + server)
  lib/           Pure domain logic (no React, no DB coupling)
  data/          Static data catalogs (cities, exercises, cards, videos)
  tests/         Vitest unit tests
  drizzle/       Database migrations
  public/        Static assets (manifest, icons, service worker)
  docs/          Documentation (you are here)
```

## Quality Checks

```bash
npx tsc --noEmit        # TypeScript typecheck
npx next lint            # ESLint
npm run test             # Vitest unit tests
npm run build            # Production build
```

## Next Steps

- [Architecture Overview](./architecture/overview.md)
- [Feature Documentation](./features/)
- [API Reference](./api/routes.md)
- [Contributing](../CONTRIBUTING.md)
