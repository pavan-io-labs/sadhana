# Contributing to Sadhana

## Development Workflow

1. **Create an issue** describing the feature, bug, or task.
2. **Branch from `main`** using the convention below.
3. **Implement** with tests, documentation updates, and changelog entry.
4. **Run quality checks** before committing.
5. **Open a PR** linking the issue.
6. **Merge to `main`** once checks pass.

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<scope>` | `feat/yoga-nidra-timer` |
| Bug fix | `fix/<scope>` | `fix/caffeine-cutoff-calc` |
| Documentation | `docs/<scope>` | `docs/api-reference` |
| Chore/tooling | `chore/<scope>` | `chore/ci-pipeline` |
| Refactor | `refactor/<scope>` | `refactor/schedule-engine` |

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`, `ci`.

Examples:
- `feat(practice): add Yoga Nidra timer with 8 guided stages`
- `fix(nourish): correct caffeine cutoff for late chronotypes`
- `docs(api): document briefing route parameters`

## Quality Checks

Run all of these before committing:

```bash
npx tsc --noEmit        # TypeScript typecheck
npx next lint            # ESLint
npm run test             # Vitest unit tests
npm run build            # Production build (catches SSR/client boundary issues)
```

## Testing Requirements

- All pure domain logic in `lib/` must have unit tests.
- New scoring functions require test cases with known inputs/outputs.
- API routes should be verified with `curl` against the dev server.

## Documentation

When changing behavior, APIs, schema, or features, update the relevant file in `docs/`. Documentation is part of the implementation, not a follow-up task.

## Code Style

- TypeScript `strict` mode -- no `any`, no `@ts-ignore`.
- Pure logic in `lib/` -- no React, no DB imports.
- Server components by default; `"use client"` only when interactivity is needed.
- Zod validation on every API input boundary.
- Parameterized queries via Drizzle -- never string-interpolate SQL.

## Environment Setup

```bash
git clone <repo-url>
cd Sadhana
npm install
cp .env.example .env.local   # Edit with your values
npm run db:migrate
npm run dev
```
