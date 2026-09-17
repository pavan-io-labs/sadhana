# ADR-003: Anchor-Based Scheduling

## Status

Accepted

## Context

The daily routine must shift with sunrise across seasons and locations. Brahma Muhurta at latitude 13 (Bangalore) differs by ~2 hours from latitude 28 (Delhi) across the year. Options:

1. **Fixed clock times**: user sets "5:00 AM meditation" and re-edits seasonally
2. **Anchor-based offsets**: blocks store "sunrise - 30 min" and resolve automatically
3. **Fully computed**: no user-editable blocks, the app decides everything

## Decision

Use **anchor-based offsets**. Each block stores an anchor (`sunrise`, `sunset`, `solarNoon`, `wake`, `bedtime`, or `clock`) and a signed offset in minutes.

## Rationale

- **One edit, forever correct**: a block set to "sunrise - 30 min" re-times correctly every day without user intervention
- **User control preserved**: the user still defines their blocks, the anchors just make them adaptive
- **Composed anchors**: `wake = sunrise + wakeOffset`, `bedtime = wake - sleepTarget`. Changing one setting cascades correctly.
- **Fixed clock fallback**: the `clock` anchor allows traditional fixed-time blocks when needed

## Consequences

- The schedule engine (`lib/schedule.ts`) must handle the midnight wrap at the 2 AM boundary
- DST transitions cause all anchored blocks to shift (correct behavior, but potentially surprising)
- Debugging requires understanding the anchor resolution chain
- Per-weekday variation is handled via `weekdayMask` bitmask, not separate block definitions
