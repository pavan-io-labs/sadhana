# Nourish

## Meal Logging

Log meals by type (`breakfast`, `lunch`, `dinner`, `snack`) with timing. Lunch is weighted as the main meal, following the Ayurvedic principle that digestive fire (Pitta) peaks at solar noon.

## Caffeine Cutoff Calculator

Calculates the safe caffeine cutoff based on bedtime:

```
cutoff = bedtime - 8.5 hours
```

Three zones are displayed:
- **Safe** (green): more than 8.5 hours before bed
- **Marginal** (amber): 6--8.5 hours before bed
- **Too late** (red): less than 6 hours before bed

Based on caffeine's 5--7 hour half-life. At 8.5 hours, ~75% has cleared.

## Dinner-to-Bed Gap

A live gauge showing the time between last food and bedtime:
- Green at >= 3 hours
- Amber at 2--3 hours
- Red at < 2 hours

Late eating raises core temperature, opposing the 1--2C drop needed for sleep onset.

## Hydration

Simple water intake tracker in milliliters. Target: 2--2.5L/day for sedentary adults, more with exercise and heat.

## Eating Window Visualizer

Shows the time span from first food to last food. Time-restricted eating within an 8--12 hour window improves metabolic markers.

## Components

- `components/nourish/loggers.tsx` -- meal, caffeine, and hydration logging forms
- `lib/nourish.ts` -- cutoff calculations, window logic
- `app/nourish/page.tsx` -- nourish page
