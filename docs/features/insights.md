# Insights

## The Three Numbers

The weekly review surfaces three tracked numbers:

1. **Average sleep** (hours) -- from `dayLogs.sleepDurationMin`
2. **Resting HR trend** (bpm) -- from `dayLogs.restingHr`
3. **Hard-task-before-noon rate** (%) -- from `dayLogs.hardTaskBeforeNoon`

## Sleep vs PVT Scatter

The headline chart: each point is a day, x-axis is sleep hours, y-axis is PVT median reaction time. This is the user's personal dose-response curve -- the most concrete evidence that sleep affects their own performance.

## Adherence Heatmap

GitHub-style contribution grid showing block completion rates per day. Color intensity maps to percentage of blocks completed.

## Forgiving Streaks

Streaks are counted with a **one-miss-per-week tolerance**. Missing a single day does not reset the streak, matching the research finding that flexibility is what makes routines survive (Lally et al., 2010: missing one day does not measurably affect long-term habit automaticity).

## Social Jetlag Calculator

Compares weekday vs weekend sleep midpoints. Each hour of social jetlag is associated with:
- +33% odds of obesity
- +11% odds of depression
- Measurably worse Monday alertness

## Chronotype

The reduced MEQ (5-question Morningness-Eveningness Questionnaire) determines the user's chronotype and recommends a personalized wake target instead of forcing 4:45 AM on everyone. Late chronotypes get a later, sustainable target.

## Components

- `app/insights/page.tsx` -- insights dashboard
- `components/settings/chronotype-questionnaire.tsx` -- rMEQ
- `lib/rules.ts` -- social jetlag advisory
