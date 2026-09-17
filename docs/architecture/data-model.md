# Data Model

All tables are defined in `lib/db/schema.ts` using Drizzle ORM for SQLite.

## Tables

### `settings`

Single-row configuration table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Always 1 |
| `latitude` | real | User latitude |
| `longitude` | real | User longitude |
| `city` | text | Display name |
| `timeZone` | text | IANA timezone (e.g., `Asia/Kolkata`) |
| `muhurtaMode` | text | `fixed` or `proportional` |
| `chronotype` | text | `early`, `moderate`, `late` |
| `sleepTargetMin` | integer | Target sleep in minutes (default: 480) |
| `wakeOffsetMin` | integer | Minutes relative to sunrise |
| `activeTrack` | text | `traditional`, `sandhya`, `gentle-a`, `hardcore-b` |
| `trackStartedOn` | text | ISO date when track was started |
| `theme` | text | `system`, `light`, `dark` |
| `notifyEnabled` | integer | Boolean: push notifications on/off |
| `notifyMinutesBefore` | integer | Reminder lead time |
| `clock24h` | integer | Boolean: 24h vs 12h display |
| `onboarded` | integer | Boolean: onboarding complete |

### `routines`

Named routine presets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `slug` | text (unique) | URL-safe identifier |
| `name` | text | Display name |
| `description` | text | Short description |

### `blocks`

Schedule blocks anchored to solar/biological events.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `routineId` | integer (FK) | Parent routine |
| `title` | text | Block name |
| `category` | text | `spiritual`, `movement`, `food`, `work`, `rest`, `social`, `hygiene` |
| `anchor` | text | `sunrise`, `sunset`, `solarNoon`, `wake`, `bedtime`, `clock` |
| `offsetMin` | integer | Minutes from anchor (negative = before) |
| `durationMin` | integer | Duration in minutes |
| `fuel` | text | Pre-block fuel guidance (nullable) |
| `weekdayMask` | integer | Bitmask: bit 0 = Monday ... bit 6 = Sunday |
| `notify` | integer | Boolean: send push notification |
| `order` | integer | Display order within routine |
| `enabled` | integer | Boolean: block is active |

### `dayLogs`

One row per calendar date.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text (unique) | ISO date |
| `actualWakeMin` | integer | Actual wake time (minutes from midnight) |
| `actualSleepMin` | integer | Actual sleep time (minutes from midnight) |
| `sleepDurationMin` | integer | Computed sleep duration |
| `restingHr` | integer | Resting heart rate (bpm) |
| `mood` | integer | 1-5 scale |
| `notes` | text | Free-form notes |
| `hardTaskBeforeNoon` | integer | Boolean: completed a hard task before noon |

### `blockCompletions`

Date x block completion tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text | ISO date |
| `blockId` | integer (FK) | Block reference |
| `completed` | integer | Boolean |
| `skipped` | integer | Boolean |
| `at` | text | ISO timestamp of action |

### `workouts`

Training session headers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text | ISO date |
| `trackSlug` | text | Which track |
| `sessionSlug` | text | Session within track |
| `durationSeconds` | integer | Total session time |
| `notes` | text | Session notes |
| `at` | text | ISO timestamp |

### `workoutSets`

Individual sets within a workout.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `workoutId` | integer (FK) | Parent workout |
| `exerciseSlug` | text | Exercise identifier |
| `setIndex` | integer | Set number (0-based) |
| `reps` | integer | Repetitions completed |
| `weight` | real | Weight in kg |
| `rpe` | real | Rate of perceived exertion (1-10) |

### `practiceSessions`

Meditation, pranayama, nidra, abhyanga sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text | ISO date |
| `kind` | text | `meditation`, `pranayama`, `nidra`, `abhyanga` |
| `practiceSlug` | text | Specific technique |
| `durationSeconds` | integer | Session length |
| `rounds` | integer | Rounds completed (pranayama, surya namaskar) |
| `notes` | text | Free-form notes |
| `at` | text | ISO timestamp |

### `meals`

Meal timing and type.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text | ISO date |
| `mealType` | text | `breakfast`, `lunch`, `dinner`, `snack` |
| `atMinute` | integer | Minutes from midnight |
| `notes` | text | What was eaten |
| `at` | text | ISO timestamp |

### `caffeineLogs`

Caffeine intake tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text | ISO date |
| `mg` | integer | Milligrams of caffeine |
| `atMinute` | integer | Minutes from midnight |
| `source` | text | Coffee, tea, etc. |
| `at` | text | ISO timestamp |

### `hydrationLogs`

Water intake tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text | ISO date |
| `ml` | integer | Milliliters |
| `at` | text | ISO timestamp |

### `gameResults`

Mind Gym session results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `date` | text | ISO date |
| `game` | text | `pvt`, `stroop`, `nback`, `gonogo`, `digit-span`, `corsi`, `insight` |
| `atMinute` | integer | Minutes from midnight |
| `durationSeconds` | integer | Session length |
| `primaryMetric` | real | Headline number for trend charts |
| `metrics` | text (JSON) | Full typed metric bag |
| `isPractice` | integer | Boolean: practice run (excluded from trends) |
| `notes` | text | Session notes |
| `at` | text | ISO timestamp |

### `papers`

Saved literature from search.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `source` | text | `europepmc` or `crossref` |
| `externalId` | text | Source-specific ID |
| `doi` | text | DOI (nullable) |
| `title` | text | Paper title |
| `journal` | text | Journal name |
| `year` | integer | Publication year |
| `abstract` | text | Abstract text |
| `authors` | text | Author list |
| `tags` | text (JSON) | User tags |
| `savedAt` | text | ISO timestamp |

### `scienceNotes`

User annotations on evidence cards.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `cardId` | text | Evidence card ID |
| `note` | text | User annotation |
| `at` | text | ISO timestamp |

### `pushSubscriptions`

Web Push subscription storage.

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Auto-increment |
| `endpoint` | text (unique) | Push endpoint URL |
| `p256dh` | text | Client public key |
| `auth` | text | Auth secret |
| `createdAt` | text | ISO timestamp |

## Indexes

- `block_completions_date_idx` on `blockCompletions(date)`
- `block_completions_block_idx` on `blockCompletions(blockId, date)`
- `game_results_date_idx` on `gameResults(date)`
- `game_results_game_idx` on `gameResults(game, date)`

## Migrations

Managed by Drizzle Kit. Run:

```bash
npm run db:migrate      # Apply pending migrations
npx drizzle-kit generate  # Generate new migration after schema changes
```

Migration files live in `drizzle/` and are committed to version control.
