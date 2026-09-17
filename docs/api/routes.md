# API Routes Reference

All API routes are in `app/api/`. Every input is Zod-validated. Every response follows the envelope pattern from `lib/api.ts`.

## Response Envelope

Success:
```json
{ "ok": true, "data": { ... } }
```

Error:
```json
{ "ok": false, "error": "message", "details": [...] }
```

## Routes

### Astronomy

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/astro?lat=&lng=&date=&tz=` | Solar calculations (sunrise, sunset, noon, twilight) |

### Schedule

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/schedule/resolve?date=` | Resolve day plan for a date |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get current settings |
| PATCH | `/api/settings` | Update settings |

### Onboarding

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/onboarding` | Complete onboarding (sets location, chronotype, track) |

### Routines

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/routines` | List available routine presets |

### Blocks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/blocks` | List all blocks (optionally filter by routine) |
| POST | `/api/blocks` | Create a new block |
| PATCH | `/api/blocks/[id]` | Update a block |
| DELETE | `/api/blocks/[id]` | Delete a block |
| POST | `/api/blocks/complete` | Toggle block completion for a date |
| POST | `/api/blocks/reorder` | Reorder blocks within a routine |
| PATCH | `/api/blocks/enabled` | Bulk enable/disable blocks |

### Day Logs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/logs?date=` | Get day log for a date |
| POST | `/api/logs` | Create or update day log |

### Workouts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workouts?date=` | List workouts (filter by date) |
| POST | `/api/workouts` | Log a workout session with sets |
| GET | `/api/workouts/[id]` | Get workout details |
| DELETE | `/api/workouts/[id]` | Delete a workout |

### Practice

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/practice?date=&kind=` | List practice sessions |
| POST | `/api/practice` | Log a practice session |
| DELETE | `/api/practice/[id]` | Delete a practice session |

### Nourish

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/nourish?date=` | Get all nourish data for a date |
| POST | `/api/nourish/meal` | Log a meal |
| DELETE | `/api/nourish/meal/[id]` | Delete a meal |
| POST | `/api/nourish/caffeine` | Log caffeine intake |
| DELETE | `/api/nourish/caffeine/[id]` | Delete caffeine log |
| POST | `/api/nourish/hydration` | Log water intake |

### Mind Gym

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/games?game=&date=&from=&to=` | List game results |
| POST | `/api/games` | Save a game result |
| GET | `/api/games/[id]` | Get game result details |
| DELETE | `/api/games/[id]` | Delete a game result |

### Literature

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/literature/search?q=&type=&limit=` | Search Europe PMC + Crossref |
| POST | `/api/literature/save` | Save a paper to the library |

### Videos

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/videos/search?q=&tag=&limit=` | Search curated video library |

### Briefing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/briefing?kind=morning\|evening` | Get composed briefing |

### Push Notifications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/push/subscribe` | Register push subscription |
| POST | `/api/push/test` | Send test notification |

### Calendar

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ics?date=` | Generate .ics calendar file |

### Data Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/export` | Full JSON data export |
| POST | `/api/import` | Import data (with optional wipe) |
