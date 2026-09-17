/**
 * Scoring modules for every Mind Gym game.
 *
 * Pure and testable  --  no DB, no React. Each game has a function that takes raw
 * trial data and returns the typed metrics bag stored in `game_results.metrics`.
 *
 * The PVT is the keystone: its median RT trend against sleep hours is the headline
 * chart in Insights, and it is the one measure that genuinely tracks sleep debt in
 * a way a person can see in their own data.
 */

/* -------------------------------------------------------------------- PVT */

export type PvtTrial = { rt: number; lapse: boolean };

export type PvtMetrics = {
  meanRt: number;
  medianRt: number;
  /** Reactions > 500ms  --  the clinical definition of a lapse. */
  lapses: number;
  /** Mean of the slowest 10% of reactions. */
  slowest10: number;
  fastestRt: number;
  trialCount: number;
  falseStarts: number;
};

export function scorePvt(trials: PvtTrial[], falseStarts = 0): PvtMetrics {
  const valid = trials.filter((t) => !t.lapse && t.rt > 0);
  const rts = valid.map((t) => t.rt).sort((a, b) => a - b);
  const lapses = trials.filter((t) => t.lapse || t.rt > 500).length;

  const mean = rts.length === 0 ? 0 : rts.reduce((s, r) => s + r, 0) / rts.length;
  const median = rts.length === 0 ? 0 : rts[Math.floor(rts.length / 2)];
  const slowIdx = Math.max(1, Math.floor(rts.length * 0.9));
  const slowest = rts.slice(slowIdx);
  const slowest10 =
    slowest.length === 0 ? 0 : slowest.reduce((s, r) => s + r, 0) / slowest.length;

  return {
    meanRt: Math.round(mean),
    medianRt: median,
    lapses,
    slowest10: Math.round(slowest10),
    fastestRt: rts.length > 0 ? rts[0] : 0,
    trialCount: trials.length,
    falseStarts,
  };
}

/** The single headline number for the PVT: median RT. */
export function pvtPrimary(metrics: PvtMetrics): number {
  return metrics.medianRt;
}

/* ------------------------------------------------------------------ Stroop */

export type StroopTrial = {
  congruent: boolean;
  correct: boolean;
  rt: number;
};

export type StroopMetrics = {
  congruentMeanRt: number;
  incongruentMeanRt: number;
  /** The number that matters: incongruent − congruent mean RT. */
  interferenceCost: number;
  accuracy: number;
  totalTrials: number;
  correctTrials: number;
};

export function scoreStroop(trials: StroopTrial[]): StroopMetrics {
  const correct = trials.filter((t) => t.correct);
  const congruent = correct.filter((t) => t.congruent);
  const incongruent = correct.filter((t) => !t.congruent);

  const meanOf = (arr: StroopTrial[]) =>
    arr.length === 0 ? 0 : Math.round(arr.reduce((s, t) => s + t.rt, 0) / arr.length);

  const cMean = meanOf(congruent);
  const iMean = meanOf(incongruent);

  return {
    congruentMeanRt: cMean,
    incongruentMeanRt: iMean,
    interferenceCost: iMean - cMean,
    accuracy: trials.length === 0 ? 0 : Math.round((correct.length / trials.length) * 100),
    totalTrials: trials.length,
    correctTrials: correct.length,
  };
}

export function stroopPrimary(metrics: StroopMetrics): number {
  return metrics.interferenceCost;
}

/* --------------------------------------------------------------- N-Back */

export type NbackMetrics = {
  /** Signal detection: hit rate − false alarm rate, normalised. */
  dPrime: number;
  /** The highest n reached. */
  levelReached: number;
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  accuracy: number;
};

/** Z-score lookup for d-prime calculation (simplified). */
function zScore(p: number): number {
  const clamped = Math.max(0.001, Math.min(0.999, p));
  // Rational approximation (Abramowitz & Stegun 26.2.23)
  const t = Math.sqrt(-2 * Math.log(clamped < 0.5 ? clamped : 1 - clamped));
  const c0 = 2.515517,
    c1 = 0.802853,
    c2 = 0.010328;
  const d1 = 1.432788,
    d2 = 0.189269,
    d3 = 0.001308;
  const z = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  return clamped < 0.5 ? -z : z;
}

export function scoreNback(
  hits: number,
  misses: number,
  falseAlarms: number,
  correctRejections: number,
  levelReached: number,
): NbackMetrics {
  const total = hits + misses + falseAlarms + correctRejections;
  const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;
  const faRate =
    falseAlarms + correctRejections > 0
      ? falseAlarms / (falseAlarms + correctRejections)
      : 0;

  const dPrime = Math.round((zScore(hitRate) - zScore(faRate)) * 100) / 100;

  return {
    dPrime: Number.isFinite(dPrime) ? dPrime : 0,
    levelReached,
    hits,
    misses,
    falseAlarms,
    correctRejections,
    accuracy: total > 0 ? Math.round(((hits + correctRejections) / total) * 100) : 0,
  };
}

export function nbackPrimary(metrics: NbackMetrics): number {
  return metrics.dPrime;
}

/* -------------------------------------------------------------- Go/No-Go */

export type GoNoGoMetrics = {
  /** Responses to no-go stimuli  --  the failure to inhibit. */
  commissionErrors: number;
  /** Missed responses to go stimuli. */
  omissionErrors: number;
  meanGoRt: number;
  accuracy: number;
  totalTrials: number;
};

export function scoreGoNoGo(
  goTrials: { hit: boolean; rt: number }[],
  noGoTrials: { inhibited: boolean }[],
): GoNoGoMetrics {
  const goHits = goTrials.filter((t) => t.hit);
  const omissions = goTrials.filter((t) => !t.hit).length;
  const commissions = noGoTrials.filter((t) => !t.inhibited).length;
  const meanGoRt =
    goHits.length === 0
      ? 0
      : Math.round(goHits.reduce((s, t) => s + t.rt, 0) / goHits.length);
  const total = goTrials.length + noGoTrials.length;
  const correct = goHits.length + noGoTrials.filter((t) => t.inhibited).length;

  return {
    commissionErrors: commissions,
    omissionErrors: omissions,
    meanGoRt,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    totalTrials: total,
  };
}

export function goNogoPrimary(metrics: GoNoGoMetrics): number {
  return metrics.commissionErrors;
}

/* ------------------------------------------------------------------ Span */

export type SpanMetrics = {
  /** Longest sequence recalled correctly. */
  maxSpan: number;
  /** Forward, backward, or spatial (Corsi). */
  mode: "forward" | "backward" | "corsi";
  trialsAttempted: number;
  trialsCorrect: number;
};

export function scoreSpan(
  mode: SpanMetrics["mode"],
  results: { length: number; correct: boolean }[],
): SpanMetrics {
  const correct = results.filter((r) => r.correct);
  return {
    maxSpan: correct.length > 0 ? Math.max(...correct.map((r) => r.length)) : 0,
    mode,
    trialsAttempted: results.length,
    trialsCorrect: correct.length,
  };
}

export function spanPrimary(metrics: SpanMetrics): number {
  return metrics.maxSpan;
}

/* -------------------------------------------------------- Insight & Reframe */

export type InsightMetrics = {
  /** Time in seconds to solve the insight puzzle. */
  solveTimeSeconds: number;
  /** Whether the puzzle was solved. */
  solved: boolean;
  /** Difficulty of the puzzle (1-5). */
  difficulty: number;
  /** Number of reframe prompts journalled. */
  reframesCompleted: number;
};

export function scoreInsight(
  solveTimeSeconds: number,
  solved: boolean,
  difficulty: number,
  reframesCompleted: number,
): InsightMetrics {
  return {
    solveTimeSeconds: Math.round(solveTimeSeconds),
    solved,
    difficulty,
    reframesCompleted,
  };
}

export function insightPrimary(metrics: InsightMetrics): number {
  return metrics.solveTimeSeconds;
}

/* ---------------------------------------------------------------- helpers */

export type GameMetrics =
  | PvtMetrics
  | StroopMetrics
  | NbackMetrics
  | GoNoGoMetrics
  | SpanMetrics
  | InsightMetrics;

/** Flatten any metrics object into the Record<string, number | null> shape the DB wants. */
export function metricsToRecord(
  metrics: GameMetrics,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === "number") out[key] = value;
    else if (typeof value === "boolean") out[key] = value ? 1 : 0;
    else if (typeof value === "string") out[key] = null; // mode, etc.
    else out[key] = null;
  }
  return out;
}
