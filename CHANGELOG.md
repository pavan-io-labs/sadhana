# Changelog

All notable changes to Sadhana are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-09-17

### Added

#### Phase 1 -- Foundation
- Next.js 16 App Router scaffold with TypeScript strict mode and Tailwind CSS 4
- Drizzle ORM + libSQL (SQLite) schema with 13 tables and migrations
- NOAA solar-position equations (`lib/astro.ts`): sunrise, sunset, solar noon, twilight
- Muhurta calculations (`lib/muhurta.ts`): Brahma Muhurta (fixed + proportional), Pratah Sandhya, Abhijit
- Dosha period engine (`lib/dosha.ts`): Vata/Pitta/Kapha 4-hour cycling with accent colors
- Design token system with dosha-reactive accent colors
- App shell with bottom navigation, dosha strip, responsive layout
- Day Ring SVG dial: 24-hour circular visualization with dosha bands and now-hand
- Today view: now/next card, schedule list, landmarks, advisories, windows card
- First-run onboarding flow: location, chronotype, track selection, day preview
- ~60 Indian cities offline lookup table

#### Phase 2 -- Schedule and Logging
- Anchor-based schedule engine (`lib/schedule.ts`): blocks resolve against sunrise/sunset/wake/bedtime
- Timeline editor with block form, routine presets, conflict detection
- Rules engine (`lib/rules.ts`): 9 advisory rules with citations and one-tap fixes
- Training module: 2 tracks (Gentle A, Hardcore B), progressive overload (+2.5 kg), deload detection
- Workout logger with set/rep/weight/RPE tracking
- Practice module: meditation timer with interval bells, animated breath pacer (6 techniques)
- Yoga Nidra / NSDR timer: 8 guided stages, 3 presets (10/20/30 min)
- Surya Namaskar round counter with auto-logging
- Abhyanga checklist with contraindication warnings
- Nourish module: meal/caffeine/hydration loggers, caffeine cutoff calculator, dinner-bed gap gauge

#### Phase 3 -- Mind Gym
- 6 cognitive game modules: PVT, Stroop, Dual N-Back, Go/No-Go, Span, Insight and Reframe
- Scoring engine (`lib/scoring/`): d-prime, interference cost, max span, solve time
- Mind Gym hub page with per-game trend charts
- Dynamic game pages with practice trial support

#### Phase 4 -- Science and Video
- 40 curated evidence cards with honest tier system (Strong/Moderate/Weak/Traditional)
- Literature search proxy: Europe PMC + Crossref with DOI dedup and evidence-type ranking
- Science browse, detail, search, and library pages
- Curated video library with youtube-nocookie embeds (click-to-load)
- Video search API with tag and text filtering

#### Phase 5 -- Insights, Briefing, PWA
- Deterministic briefing engine: morning and evening prose composition (no LLM)
- Briefing page and API route
- Insights dashboard: sleep vs PVT scatter, adherence heatmap, forgiving streaks
- Chronotype questionnaire (reduced MEQ, 5 questions)
- ICS calendar export
- Full JSON data export/import/wipe
- PWA manifest with icons, service worker for offline shell and push handling
- Web Push via VAPID (subscribe + test routes)
- Auth proxy gate: passcode cookie, fail-closed on non-localhost
- Self-test page (`/selftest`)

#### Engineering
- 321 unit tests across 12 test files via Vitest
- Git repository with conventional commits
- GitHub templates (PR, feature, bug, task, tech-debt)
- CI pipeline (typecheck, lint, test, build)
- Comprehensive documentation system (`docs/`)
- Architecture Decision Records (5 ADRs)
