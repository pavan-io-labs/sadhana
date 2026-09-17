/**
 * The six-period dosha clock.
 *
 * Ayurveda divides the 24 hours into six four-hour periods, each governed by one of
 * the three doshas. The app uses the standard fixed-clock convention (the same one a
 * dinacharya chart prints) rather than a sunrise-anchored variant, so that the bands
 * on the Day Ring stay comparable from day to day while the *user's* blocks move with
 * the sun.
 *
 *   02:00-06:00  Vata    06:00-10:00  Kapha    10:00-14:00  Pitta
 *   14:00-18:00  Vata    18:00-22:00  Kapha    22:00-02:00  Pitta
 *
 * The final period wraps midnight, so drawing the ring needs seven arcs for six
 * logical periods; `DOSHA_BANDS` is the pre-split draw list and `DOSHA_PERIODS` is the
 * logical one.
 *
 * Pure: minutes from local midnight in, data out.
 */

import { MINUTES_PER_DAY, wrapMinute } from "./time";

export type Dosha = "vata" | "kapha" | "pitta";

export type DoshaPeriod = {
  id: string;
  dosha: Dosha;
  /** Minutes from midnight. `end` may exceed 1440 for the wrapping night period. */
  start: number;
  end: number;
  /** Human label for the slot, e.g. "Kapha morning". */
  label: string;
  /** The classical qualities, in plain words. */
  qualities: string;
  /** What the period is well suited to. */
  suits: string;
  /** What works against it. */
  avoid: string;
};

export const DOSHA_LABELS: Record<Dosha, string> = {
  vata: "Vata",
  kapha: "Kapha",
  pitta: "Pitta",
};

/** Ordered from the first period after midnight; the last one wraps past 1440. */
export const DOSHA_PERIODS: readonly DoshaPeriod[] = [
  {
    id: "vata-early",
    dosha: "vata",
    start: 2 * 60,
    end: 6 * 60,
    label: "Vata  --  pre-dawn",
    qualities: "Light, mobile, clear. The quietest air of the day.",
    suits:
      "Waking, elimination, meditation and pranayama, study, and anything that needs an uncluttered mind. Brahma Muhurta sits inside this period.",
    avoid: "Heavy food, heavy lifting, and returning to sleep past its end.",
  },
  {
    id: "kapha-morning",
    dosha: "kapha",
    start: 6 * 60,
    end: 10 * 60,
    label: "Kapha  --  morning",
    qualities: "Heavy, slow, stable. Sleeping into it makes the whole day sluggish.",
    suits:
      "Movement that counters the heaviness: Surya Namaskar, mobility, a walk in daylight. Light breakfast if you eat one.",
    avoid: "Going back to bed, a large or oily breakfast, sitting still in dim light.",
  },
  {
    id: "pitta-midday",
    dosha: "pitta",
    start: 10 * 60,
    end: 14 * 60,
    label: "Pitta  --  midday",
    qualities: "Hot, sharp, transforming. Digestive and cognitive fire both peak here.",
    suits:
      "The main meal of the day, and the hardest cognitive work. Abhijit Muhurta falls in the middle of it.",
    avoid: "Skipping or shrinking lunch, and saving your hardest task for the evening.",
  },
  {
    id: "vata-afternoon",
    dosha: "vata",
    start: 14 * 60,
    end: 18 * 60,
    label: "Vata  --  afternoon",
    qualities: "Light and mobile again; attention scatters more easily.",
    suits:
      "Creative and associative work, conversation, and  --  at the tail end  --  strength and power training, when core temperature peaks.",
    avoid: "Caffeine (it is past the cutoff for most bedtimes) and decision-heavy work.",
  },
  {
    id: "kapha-evening",
    dosha: "kapha",
    start: 18 * 60,
    end: 22 * 60,
    label: "Kapha  --  evening",
    qualities: "Heavy and settling. The body is being invited to slow down.",
    suits:
      "An early, light dinner, a gentle walk, dim light, wind-down practice, and being asleep by the end of it.",
    avoid: "A large late dinner, intense exercise, bright screens in the last hour.",
  },
  {
    id: "pitta-night",
    dosha: "pitta",
    start: 22 * 60,
    end: 26 * 60,
    label: "Pitta  --  night",
    qualities: "Metabolic and repairing. Its work is done on you, not by you.",
    suits: "Deep sleep. Growth hormone, glymphatic clearance and tissue repair peak here.",
    avoid:
      "Being awake. Staying up past 22:00 tends to produce a second wind and late eating.",
  },
];

export type DoshaBand = {
  period: DoshaPeriod;
  /** Draw range, always inside 0-1440. */
  start: number;
  end: number;
};

/** The seven arcs that tile 0-1440 exactly, for rendering the ring. */
export const DOSHA_BANDS: readonly DoshaBand[] = DOSHA_PERIODS.flatMap((period) => {
  if (period.end <= MINUTES_PER_DAY) {
    return [{ period, start: period.start, end: period.end }];
  }
  return [
    { period, start: period.start, end: MINUTES_PER_DAY },
    { period, start: 0, end: period.end - MINUTES_PER_DAY },
  ];
});

/** Which period a local time falls in. Handles the midnight wrap. */
export function doshaAt(minute: number): DoshaPeriod {
  const m = wrapMinute(minute);
  for (const period of DOSHA_PERIODS) {
    if (period.end <= MINUTES_PER_DAY) {
      if (m >= period.start && m < period.end) return period;
    } else if (m >= period.start || m < period.end - MINUTES_PER_DAY) {
      // The wrapping night period: 22:00-24:00 or 00:00-02:00.
      return period;
    }
  }
  // Unreachable: the periods tile the whole day.
  return DOSHA_PERIODS[DOSHA_PERIODS.length - 1];
}

/** Minutes until the current period ends, and the period that follows. */
export function nextDoshaChange(minute: number): { inMinutes: number; next: DoshaPeriod } {
  const m = wrapMinute(minute);
  const current = doshaAt(m);
  const endsAt = current.end > MINUTES_PER_DAY && m < current.start ? current.end - MINUTES_PER_DAY : current.end;
  const inMinutes = endsAt - m;
  const index = DOSHA_PERIODS.indexOf(current);
  const next = DOSHA_PERIODS[(index + 1) % DOSHA_PERIODS.length];
  return { inMinutes, next };
}

/** Fraction 0-1 of the way through the current period. */
export function doshaProgress(minute: number): number {
  const m = wrapMinute(minute);
  const current = doshaAt(m);
  const span = current.end - current.start;
  const elapsed =
    current.end > MINUTES_PER_DAY && m < current.start
      ? m + MINUTES_PER_DAY - current.start
      : m - current.start;
  return Math.min(1, Math.max(0, elapsed / span));
}
