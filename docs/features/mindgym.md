# Mind Gym

Six measured cognitive modules. Scores are stored in `gameResults` and charted in Insights.

## Modules

### PVT (Psychomotor Vigilance Task)

The keystone measure. A simple reaction-time test that tracks sleep debt better than any subjective scale.

| Metric | Description |
|--------|-------------|
| `meanRt` | Average reaction time (ms) |
| `medianRt` | Median reaction time -- the headline number |
| `lapses` | Reactions > 500ms (clinical definition) |
| `slowest10` | Mean of the slowest 10% |
| `falseStarts` | Premature responses |

### Stroop

Measures inhibitory control by presenting color words in incongruent ink.

| Metric | Description |
|--------|-------------|
| `interferenceCost` | Incongruent RT - congruent RT (the key number) |
| `accuracy` | Percentage correct |
| `congruentMeanRt` | Mean RT for congruent trials |
| `incongruentMeanRt` | Mean RT for incongruent trials |

### Dual N-Back

Adaptive working memory training. The app includes an honest note: near-transfer to working memory tasks is real (d = 0.40), but far-transfer to general intelligence is contested and has not reliably replicated.

| Metric | Description |
|--------|-------------|
| `dPrime` | Signal detection sensitivity (z(hit rate) - z(false alarm rate)) |
| `levelReached` | Highest n achieved |
| `accuracy` | Percentage correct |

### Go/No-Go

Response inhibition. Press for "go" stimuli, withhold for "no-go" stimuli.

| Metric | Description |
|--------|-------------|
| `commissionErrors` | Responses to no-go stimuli (failure to inhibit) |
| `omissionErrors` | Missed responses to go stimuli |
| `meanGoRt` | Average reaction time for correct go responses |
| `accuracy` | Overall percentage correct |

### Span

Verbal and visuospatial working memory via Digit Span (forward/backward) and Corsi blocks.

| Metric | Description |
|--------|-------------|
| `maxSpan` | Longest sequence recalled correctly |
| `mode` | `forward`, `backward`, or `corsi` |

### Insight and Reframe

Two sub-tasks:

1. **Insight puzzles** -- problems requiring a perspective shift. Metric: solve time.
2. **Reframe prompts** -- cognitive reappraisal exercises (journalled text). Metric: completion count.

| Metric | Description |
|--------|-------------|
| `solveTimeSeconds` | Time to solve the insight puzzle |
| `solved` | Whether the puzzle was solved |
| `difficulty` | Puzzle difficulty (1--5) |
| `reframesCompleted` | Number of reframe prompts completed |

## Accessibility

All games are keyboard-operable with `aria-live` feedback. Practice trials are available before scored runs.

## Components

- `lib/scoring/index.ts` -- all scoring functions
- `lib/games.ts` -- CRUD for game results
- `data/puzzles.ts` -- insight puzzles and reframe prompts
- `app/mindgym/page.tsx` -- hub page
- `app/mindgym/[game]/page.tsx` -- dynamic game pages
