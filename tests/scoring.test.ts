/**
 * Unit tests for lib/scoring  --  every game's scoring maths.
 */

import { describe, it, expect } from "vitest";
import {
  scorePvt,
  pvtPrimary,
  scoreStroop,
  stroopPrimary,
  scoreNback,
  nbackPrimary,
  scoreGoNoGo,
  goNogoPrimary,
  scoreSpan,
  spanPrimary,
  metricsToRecord,
} from "@/lib/scoring";

describe("PVT scoring", () => {
  it("computes metrics from normal trials", () => {
    const trials = [
      { rt: 220, lapse: false },
      { rt: 245, lapse: false },
      { rt: 310, lapse: false },
      { rt: 195, lapse: false },
      { rt: 260, lapse: false },
      { rt: 550, lapse: true },
      { rt: 230, lapse: false },
      { rt: 280, lapse: false },
      { rt: 210, lapse: false },
      { rt: 240, lapse: false },
    ];
    const m = scorePvt(trials, 1);

    expect(m.trialCount).toBe(10);
    expect(m.lapses).toBe(1); // the 550ms trial
    expect(m.falseStarts).toBe(1);
    expect(m.fastestRt).toBe(195);
    expect(m.medianRt).toBeGreaterThan(0);
    expect(m.meanRt).toBeGreaterThan(0);
    expect(m.slowest10).toBeGreaterThan(0);
  });

  it("handles empty trials", () => {
    const m = scorePvt([]);
    expect(m.trialCount).toBe(0);
    expect(m.meanRt).toBe(0);
    expect(m.medianRt).toBe(0);
    expect(m.lapses).toBe(0);
  });

  it("primary is median RT", () => {
    const m = scorePvt([
      { rt: 200, lapse: false },
      { rt: 300, lapse: false },
      { rt: 250, lapse: false },
    ]);
    expect(pvtPrimary(m)).toBe(m.medianRt);
  });
});

describe("Stroop scoring", () => {
  it("computes interference cost correctly", () => {
    const trials = [
      { congruent: true, correct: true, rt: 400 },
      { congruent: true, correct: true, rt: 420 },
      { congruent: false, correct: true, rt: 500 },
      { congruent: false, correct: true, rt: 520 },
      { congruent: false, correct: false, rt: 800 }, // incorrect, excluded from RT calc
    ];
    const m = scoreStroop(trials);

    expect(m.congruentMeanRt).toBe(410);
    expect(m.incongruentMeanRt).toBe(510);
    expect(m.interferenceCost).toBe(100);
    expect(m.accuracy).toBe(80); // 4 of 5 correct
    expect(m.totalTrials).toBe(5);
    expect(m.correctTrials).toBe(4);
  });

  it("handles no correct trials", () => {
    const m = scoreStroop([
      { congruent: true, correct: false, rt: 400 },
    ]);
    expect(m.congruentMeanRt).toBe(0);
    expect(m.accuracy).toBe(0);
  });

  it("primary is interference cost", () => {
    const m = scoreStroop([
      { congruent: true, correct: true, rt: 300 },
      { congruent: false, correct: true, rt: 450 },
    ]);
    expect(stroopPrimary(m)).toBe(150);
  });
});

describe("N-Back scoring", () => {
  it("computes d-prime", () => {
    const m = scoreNback(18, 2, 3, 17, 3);

    expect(m.hits).toBe(18);
    expect(m.misses).toBe(2);
    expect(m.falseAlarms).toBe(3);
    expect(m.correctRejections).toBe(17);
    expect(m.levelReached).toBe(3);
    expect(m.accuracy).toBe(88); // (18+17)/40
    expect(m.dPrime).toBeGreaterThan(0);
    expect(Number.isFinite(m.dPrime)).toBe(true);
  });

  it("handles perfect scores", () => {
    const m = scoreNback(20, 0, 0, 20, 4);
    expect(m.accuracy).toBe(100);
    // d-prime should be high but finite (clamped at 0.999)
    expect(Number.isFinite(m.dPrime)).toBe(true);
  });

  it("handles zero performance", () => {
    const m = scoreNback(0, 0, 0, 0, 1);
    expect(m.accuracy).toBe(0);
    expect(m.dPrime).toBe(0);
  });

  it("primary is d-prime", () => {
    const m = scoreNback(15, 5, 5, 15, 2);
    expect(nbackPrimary(m)).toBe(m.dPrime);
  });
});

describe("Go/No-Go scoring", () => {
  it("counts commission and omission errors", () => {
    const goTrials = [
      { hit: true, rt: 250 },
      { hit: true, rt: 280 },
      { hit: false, rt: 0 }, // omission
      { hit: true, rt: 300 },
    ];
    const noGoTrials = [
      { inhibited: true },
      { inhibited: false }, // commission
    ];
    const m = scoreGoNoGo(goTrials, noGoTrials);

    expect(m.commissionErrors).toBe(1);
    expect(m.omissionErrors).toBe(1);
    expect(m.meanGoRt).toBe(277); // (250+280+300)/3
    expect(m.totalTrials).toBe(6);
    expect(m.accuracy).toBe(67); // 4 correct out of 6
  });

  it("primary is commission errors", () => {
    const m = scoreGoNoGo(
      [{ hit: true, rt: 200 }],
      [{ inhibited: false }, { inhibited: false }],
    );
    expect(goNogoPrimary(m)).toBe(2);
  });
});

describe("Span scoring", () => {
  it("finds max span from correct trials", () => {
    const results = [
      { length: 3, correct: true },
      { length: 4, correct: true },
      { length: 5, correct: true },
      { length: 6, correct: false },
      { length: 6, correct: false },
    ];
    const m = scoreSpan("forward", results);

    expect(m.maxSpan).toBe(5);
    expect(m.mode).toBe("forward");
    expect(m.trialsAttempted).toBe(5);
    expect(m.trialsCorrect).toBe(3);
  });

  it("handles all failures", () => {
    const m = scoreSpan("corsi", [
      { length: 2, correct: false },
    ]);
    expect(m.maxSpan).toBe(0);
    expect(m.trialsCorrect).toBe(0);
  });

  it("primary is max span", () => {
    const m = scoreSpan("backward", [
      { length: 4, correct: true },
      { length: 5, correct: true },
    ]);
    expect(spanPrimary(m)).toBe(5);
  });
});

describe("metricsToRecord", () => {
  it("flattens numeric fields and nullifies strings", () => {
    const m = scoreSpan("forward", [{ length: 5, correct: true }]);
    const record = metricsToRecord(m);

    expect(record.maxSpan).toBe(5);
    expect(record.mode).toBeNull(); // string field -> null
    expect(record.trialsAttempted).toBe(1);
  });
});
