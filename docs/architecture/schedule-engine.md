# Schedule Engine

## How It Works

The schedule engine converts abstract "anchored blocks" into concrete clock times for a given date and location.

### Key Concept: Anchor-Based Blocks

Instead of fixed clock times, each block stores an **anchor** and an **offset**:

```
block.anchor = "sunrise"
block.offsetMin = -30     // 30 minutes before sunrise
block.durationMin = 15
```

When sunrise is 6:12 AM, this block resolves to 5:42 - 5:57 AM. When sunrise shifts to 5:30 AM in summer, the same block becomes 5:00 - 5:15 AM. The user never re-edits.

### Available Anchors

| Anchor | Derived From |
|--------|-------------|
| `sunrise` | NOAA solar equations for lat/lng/date |
| `sunset` | NOAA solar equations |
| `solarNoon` | NOAA solar equations |
| `wake` | `sunrise + settings.wakeOffsetMin` |
| `bedtime` | `wake - settings.sleepTargetMin` |
| `clock` | Fixed time of day (offset = minutes from midnight) |

### Resolution Flow

```
resolveDay(date, settings, blocks)
  1. Compute sunrise/sunset/solarNoon for (lat, lng, date)
  2. Compute wake = sunrise + wakeOffset
  3. Compute bedtime = wake - sleepTarget
  4. For each block:
     a. Look up anchor time
     b. Add offset
     c. Compute end = start + duration
     d. Apply weekday mask filter
  5. Sort by start time
  6. Return DayPlan with landmarks + resolved blocks
```

### Edge Cases

**Midnight wrap**: The 2 AM Vata boundary means some blocks (evening routine, early-morning meditation) span midnight. The engine handles this by using minutes-from-midnight that can go negative (previous day) or exceed 1440 (next day).

**DST transitions**: The engine works in the user's IANA timezone. On DST change days, sunrise shifts and all anchored blocks shift with it automatically.

**Weekday variation**: Each block has a `weekdayMask` bitmask (bit 0 = Monday). Training blocks use this to implement different sessions on different days (e.g., upper body Monday/Thursday, lower body Tuesday/Friday).

## The DayPlan Object

`buildDayPlan()` returns a `DayPlan` containing:

- `landmarks` -- sunrise, sunset, solar noon, Brahma Muhurta, wake, bedtime
- `blocks` -- resolved blocks with concrete start/end times
- `doshaAt(minute)` -- returns the active dosha for any minute of the day
- `advisories` -- rules engine output (conflicts, warnings)

## Related Code

- `lib/schedule.ts` -- `resolveDay()` function
- `lib/astro.ts` -- NOAA solar position equations
- `lib/muhurta.ts` -- Brahma Muhurta, Abhijit Muhurta calculations
- `lib/day.ts` -- `buildDayPlan()` composition
- `lib/rules.ts` -- Advisory rules that consume the day plan
