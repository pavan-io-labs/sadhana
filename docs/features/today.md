# Today View

The landing page. One glance answers "where am I in the day, and what shape is it."

## Day Ring

A 24-hour circular SVG dial with:

- **Outer band**: the six dosha periods (Vata/Kapha/Pitta x 2)
- **Inner band**: the user's resolved blocks, color-coded by category
- **Now-hand**: rotating indicator of the current time
- **Ticks**: sunrise, sunset, solar noon, Brahma Muhurta, Abhijit Muhurta

## Now / Next Card

Shows the currently active block (or "free time") and the upcoming block with its start time. One-tap completion toggles the block as done (optimistic update via TanStack Query).

## Advisory Panel

Live advisories from the rules engine:

- Dinner too close to bedtime (< 3 hours)
- Caffeine past cutoff (bedtime - 8.5 hours)
- No outdoor light block within 60 min of wake
- Resting HR elevated for 3+ days
- Week 4 deload reminder
- Heavy strength session while fasted
- Forceful pranayama too soon after eating

Each advisory includes the citation, severity, and a one-tap fix action.

## Dosha-Reactive Accent

The interface hue shifts with the current dosha period:

| Period | Color | Times |
|--------|-------|-------|
| Vata | Cool indigo | 2--6 AM, 2--6 PM |
| Kapha | Jade green | 6--10 AM, 6--10 PM |
| Pitta | Saffron | 10 AM--2 PM, 10 PM--2 AM |

Colors are never used alone -- every dosha band is also labelled in text.

## Components

- `components/day-ring/day-ring.tsx` -- SVG ring
- `components/today/now-next.tsx` -- current/next block
- `components/today/advisory-panel.tsx` -- rules output
- `components/today/schedule-list.tsx` -- flat block list
- `components/today/landmark-list.tsx` -- solar events
- `components/today/windows-card.tsx` -- eating/caffeine windows
- `components/shell/dosha-accent.tsx` -- CSS custom properties
