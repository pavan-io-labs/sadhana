# Practice

## Meditation Timer

Countdown timer with configurable duration (5/10/15/20 min) and optional interval bells. Logs to `practiceSessions` with `kind: meditation`.

## Breath Pacer

Animated breathing guide supporting 6 techniques:

| Technique | Pattern | Type |
|-----------|---------|------|
| Nadi Shodhana | 4:2:4:2 | Parasympathetic (calming) |
| Bhramari | Inhale:Hum | Parasympathetic |
| Kapalabhati | Rapid exhale | Sympathetic (activating) |
| Bhastrika | Equal forceful in/out | Sympathetic |
| Box Breathing | 4:4:4:4 | Balancing |
| 4-7-8 | 4:7:8 | Parasympathetic (pre-sleep) |

### Contraindication Enforcement

Kapalabhati and Bhastrika **gate behind an empty-stomach confirmation**. The user must acknowledge they have not eaten in the last 3 hours before the pacer activates. This is not a suggestion -- the UI blocks the start.

## Yoga Nidra / NSDR Timer

A guided non-sleep deep rest timer with 8 sequential stages:

1. Settling In
2. Sankalpa (Resolve)
3. Body Scan (rotation of consciousness)
4. Breath Awareness
5. Pairs of Opposites
6. Visualization
7. Sankalpa (Return)
8. Gentle Wake

Three presets: Short (10 min), Standard (20 min), Extended (30 min). Each stage's duration is proportional to the total. A multi-segment SVG ring shows progress through stages, and cue text guides the user through each phase.

## Abhyanga Checklist

Step-by-step oil self-massage guide with contraindication warnings:

- Fever or acute illness
- Skin inflammation, rash, or open wounds
- Indigestion or recent eating
- Heavy menstruation (use judgement)
- Pregnancy (lighter pressure; consult provider)

The checklist surfaces these at the top, not buried in fine print.

## Components

- `components/practice/timer.tsx` -- meditation countdown
- `components/practice/breath-pacer.tsx` -- animated pacer
- `components/practice/yoga-nidra.tsx` -- NSDR guided timer
- `components/practice/abhyanga-checklist.tsx` -- checklist
- `data/practices.ts` -- practice catalog with contraindications
