# Training

## Tracks

Four preset routines ship with the app:

| Track | Wake Target | Description |
|-------|-------------|-------------|
| Traditional | Brahma Muhurta (sunrise - 96m) | Strict Ayurvedic timing |
| Sandhya | Sunrise - 30m | Realistic working-professional variant |
| Gentle A | Sunrise | Beginner-friendly, lighter load |
| Hardcore B | Sunrise - 30m | High-volume, 4-day split |

## Progressive Overload

The app tracks set/rep/weight for every exercise and suggests `+2.5 kg` once all prescribed reps are hit in the previous session. This is the primary strength adaptation mechanism for novice-to-intermediate lifters.

## Deload Detection

- **Automatic**: every 4th week of a track is flagged as a deload week with a banner.
- **HR-based**: if resting heart rate is elevated >= 5 bpm above baseline for 3+ days, a deload advisory fires.

## Fuel Guidance

Each training session includes pre-fuel guidance:

- Strength sessions: full meal 90 min prior, or banana/dates 20 min prior
- Conditioning: fast carbohydrate 15--30 min prior (banana, dates, juice)
- Explicitly **not** almonds/nuts (fat delays gastric emptying)
- The reason is shown alongside the recommendation

## Surya Namaskar

A structured 12-pose round counter with:
- Visual progress ring
- Round count tracking
- Auto-log on completion to the practice table

## Components

- `components/train/workout-logger.tsx` -- set/rep/weight/RPE form
- `components/practice/surya-namaskar.tsx` -- round counter
- `data/exercises.ts` -- exercise catalog
- `data/tracks.ts` -- track definitions
- `lib/training.ts` -- overload logic, deload detection
