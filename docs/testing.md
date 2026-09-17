# Testing Strategy

## What Is Tested

All **pure domain logic** in `lib/` is unit-tested via Vitest. These are functions with no React, no DB, and no side effects.

| Test File | Tests | What It Covers |
|-----------|-------|---------------|
| `astro.test.ts` | 27 | Sunrise/sunset against known city/date pairs (+/- 2 min) |
| `muhurta.test.ts` | 16 | Both modes (fixed + proportional), arithmetic |
| `dosha.test.ts` | 19 | Boundary resolution including the 2 AM wrap |
| `schedule.test.ts` | 89 | `resolveDay` across month and DST edges, all anchors |
| `rules.test.ts` | 45 | Every advisory rule firing on crafted fixtures |
| `briefing.test.ts` | 11 | Morning and evening sections, conditional branches |
| `scoring.test.ts` | 16 | All game scoring functions with known inputs/outputs |
| `ics.test.ts` | 5 | Field escaping, UID generation, VTIMEZONE |
| `time.test.ts` | 26 | Time conversion utilities |
| `validators.test.ts` | 21 | Zod schema parsing |
| `blocks.test.ts` | 34 | Block CRUD operations |
| `science-cards.test.ts` | 12 | Card lookup, filtering, tier validation |

**Total: 321 tests across 12 files.**

## What Is Not Tested (Yet)

- **UI components** -- no React component tests. The rendering is simple enough that type-checking + visual verification covers it.
- **API route handlers** -- verified via `curl` against the running dev server. No automated integration tests yet.
- **End-to-end flows** -- no Playwright/Cypress. Planned for v0.2.

## Running Tests

```bash
npm run test           # Run all tests once
npm run test -- --watch  # Watch mode (re-run on file changes)
npm run test -- --coverage  # With coverage report
```

## Adding Tests

1. Create `tests/<module>.test.ts`
2. Import the pure function from `lib/`
3. Write test cases with known inputs and expected outputs
4. Run `npm run test` to verify

Example:

```typescript
import { describe, it, expect } from "vitest";
import { scorePvt } from "../lib/scoring";

describe("scorePvt", () => {
  it("counts lapses above 500ms", () => {
    const trials = [
      { rt: 250, lapse: false },
      { rt: 600, lapse: true },
    ];
    const result = scorePvt(trials);
    expect(result.lapses).toBe(1);
  });
});
```

## Test Fixtures

Test fixtures live alongside test files or in `tests/fixtures/`. Use deterministic data (fixed dates, known coordinates) so tests are reproducible.
