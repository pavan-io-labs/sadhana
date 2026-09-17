/**
 * Briefing composition engine.
 *
 * Two briefings per day  --  morning and evening  --  assembled from the user's own
 * logged data using a phrase bank with conditional branches. Fully deterministic,
 * offline, free, no API key, structurally incapable of inventing a health claim.
 *
 * The morning briefing appears at the top of Today on first open each day.
 * The evening review appears after the last block.
 */

import { type DayPlan } from "./day";
import { formatClock, formatDuration, type ClockOptions } from "./time";
import { SCIENCE_CARDS } from "@/data/science-cards";

export type BriefingSection = {
  heading: string;
  body: string;
};

export type Briefing = {
  kind: "morning" | "evening";
  date: string;
  sections: BriefingSection[];
};

type BriefingInput = {
  plan: DayPlan;
  clock24h: boolean;
  activeTrack: string;
  /** Today's sessions names. */
  sessionNames: string[];
  isDeload: boolean;
  /** Number of blocks completed today. */
  completedBlocks: number;
  totalBlocks: number;
  /** Logged sleep last night, in minutes. */
  sleepMinutes: number | null;
  /** Resting HR. */
  restingHr: number | null;
  /** PVT median RT from today. */
  pvtMedianRt: number | null;
  /** Caffeine mg logged. */
  caffeineMg: number;
  /** Last food minute. */
  lastFoodMinute: number | null;
  /** Water ml logged. */
  waterMl: number;
};

const clockOpts = (h24: boolean): ClockOptions => ({ hour24: h24, compact: true });

function scienceOfTheDay(date: string): typeof SCIENCE_CARDS[number] {
  // Deterministic pick based on date hash
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = ((hash << 5) - hash + date.charCodeAt(i)) | 0;
  }
  return SCIENCE_CARDS[Math.abs(hash) % SCIENCE_CARDS.length];
}

export function composeMorningBriefing(input: BriefingInput): Briefing {
  const { plan, clock24h } = input;
  const co = clockOpts(clock24h);
  const sections: BriefingSection[] = [];

  // 1. Solar anchors
  sections.push({
    heading: "Today's anchors",
    body: [
      plan.sun.sunrise !== null
        ? `Sunrise at ${formatClock(plan.sun.sunrise, co)} in ${plan.place.city}.`
        : `No sunrise today  --  polar conditions in ${plan.place.city}.`,
      plan.muhurta.brahma
        ? `Brahma Muhurta runs ${formatClock(plan.muhurta.brahma.start, co)}–${formatClock(plan.muhurta.brahma.end, co)}.`
        : "",
      `Wake target: ${formatClock(plan.personal.wake, co)}. Lights out tonight: ${formatClock(plan.personal.bedtime, co)}.`,
    ]
      .filter(Boolean)
      .join(" "),
  });

  // 2. Training
  if (input.sessionNames.length > 0) {
    const deloadNote = input.isDeload
      ? " This is a deload week  --  same weights, fewer sets."
      : "";
    sections.push({
      heading: "Training",
      body: `Today's session${input.sessionNames.length > 1 ? "s" : ""}: ${input.sessionNames.join(", ")}.${deloadNote}`,
    });
  }

  // 3. Timing guardrails
  sections.push({
    heading: "Timing guardrails",
    body: [
      `Last caffeine by ${formatClock(plan.personal.caffeineCutoff, co)}  --  ${input.caffeineMg > 0 ? `${input.caffeineMg} mg logged so far` : "none yet"}.`,
      `Last food by ${formatClock(plan.personal.lastFoodBy, co)} to keep the dinner→bed gap.`,
    ].join(" "),
  });

  // 4. Science card of the day
  const card = scienceOfTheDay(plan.date);
  sections.push({
    heading: "Science of the day",
    body: `**${card.title}** (${card.tier}): ${card.headline}`,
  });

  // 5. Sleep check-in
  if (input.sleepMinutes !== null) {
    const sleepHrs = (input.sleepMinutes / 60).toFixed(1);
    const target = (plan.personal.sleepTargetMinutes / 60).toFixed(1);
    const met = input.sleepMinutes >= plan.personal.sleepTargetMinutes - 15;
    sections.push({
      heading: "Last night",
      body: `${sleepHrs}h of sleep${met ? " ✓" : `  --  short of the ${target}h target`}.${
        input.pvtMedianRt !== null ? ` PVT median: ${input.pvtMedianRt} ms.` : ""
      }`,
    });
  }

  return { kind: "morning", date: plan.date, sections };
}

export function composeEveningBriefing(input: BriefingInput): Briefing {
  const { plan, clock24h } = input;
  const co = clockOpts(clock24h);
  const sections: BriefingSection[] = [];

  // 1. Completion
  const pct = input.totalBlocks > 0
    ? Math.round((input.completedBlocks / input.totalBlocks) * 100)
    : 0;
  sections.push({
    heading: "Today's completion",
    body: `${input.completedBlocks} of ${input.totalBlocks} blocks completed (${pct}%).`,
  });

  // 2. The three numbers
  const numbers: string[] = [];
  if (input.sleepMinutes !== null) {
    numbers.push(`Sleep: ${(input.sleepMinutes / 60).toFixed(1)}h`);
  }
  if (input.restingHr !== null) {
    numbers.push(`Resting HR: ${input.restingHr} bpm`);
  }
  if (input.pvtMedianRt !== null) {
    numbers.push(`PVT: ${input.pvtMedianRt} ms`);
  }
  if (numbers.length > 0) {
    sections.push({
      heading: "The three numbers",
      body: numbers.join(" · "),
    });
  }

  // 3. Nourishment summary
  const dinnerGap = input.lastFoodMinute !== null
    ? plan.personal.bedtime - input.lastFoodMinute
    : null;
  sections.push({
    heading: "Nourishment",
    body: [
      input.caffeineMg > 0 ? `${input.caffeineMg} mg caffeine today.` : "No caffeine today.",
      dinnerGap !== null ? `Dinner→bed gap: ${formatDuration(dinnerGap)}.` : "",
      input.waterMl > 0 ? `${input.waterMl} ml water.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  });

  // 4. Wind-down
  sections.push({
    heading: "Wind-down",
    body: `Lights out at ${formatClock(plan.personal.bedtime, co)}. Dim screens 30 minutes before. Tomorrow's wake: ${formatClock(plan.personal.wake, co)}.`,
  });

  return { kind: "evening", date: plan.date, sections };
}
