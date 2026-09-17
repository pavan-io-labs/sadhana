/**
 * Breath pacer  --  animated visual guide for pranayama techniques.
 *
 * Supports: Nadi Shodhana, Bhramari, Kapalabhati, Bhastrika, Box, 4-7-8.
 * Each technique has its own timing pattern (inhale / hold / exhale / hold durations).
 *
 * Contraindications are enforced, not buried: Kapalabhati and Bhastrika gate behind
 * an empty-stomach confirmation.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type BreathTechnique = {
  slug: string;
  name: string;
  /** Phase durations in seconds: [inhale, holdIn, exhale, holdOut]. */
  pattern: [number, number, number, number];
  description: string;
  /** Requires empty stomach confirmation? */
  requiresEmptyStomach: boolean;
  cautions?: string;
};

export const TECHNIQUES: BreathTechnique[] = [
  {
    slug: "nadi-shodhana",
    name: "Nadi Shodhana",
    pattern: [4, 2, 4, 2],
    description: "Alternate nostril breathing. Close right nostril, inhale left; close left, exhale right. Repeat.",
    requiresEmptyStomach: false,
  },
  {
    slug: "bhramari",
    name: "Bhramari",
    pattern: [4, 0, 8, 0],
    description: "Humming bee breath. Inhale deeply, exhale with a sustained humming sound.",
    requiresEmptyStomach: false,
  },
  {
    slug: "kapalabhati",
    name: "Kapalabhati",
    pattern: [0.5, 0, 0.5, 0],
    description: "Forceful exhalation, passive inhalation. Short, sharp belly pumps.",
    requiresEmptyStomach: true,
    cautions: "Contraindicated: uncontrolled hypertension, pregnancy, epilepsy, hernia. Case reports of pneumothorax with aggressive practice.",
  },
  {
    slug: "bhastrika",
    name: "Bhastrika",
    pattern: [1, 0, 1, 0],
    description: "Bellows breath. Equal forceful inhale and exhale through the nose.",
    requiresEmptyStomach: true,
    cautions: "Same contraindications as Kapalabhati. Sympathetically activating  --  not for evening.",
  },
  {
    slug: "box",
    name: "Box Breathing",
    pattern: [4, 4, 4, 4],
    description: "Equal-ratio breathing: 4 in, 4 hold, 4 out, 4 hold. Used by Navy SEALs for stress management.",
    requiresEmptyStomach: false,
  },
  {
    slug: "4-7-8",
    name: "4-7-8 Breathing",
    pattern: [4, 7, 8, 0],
    description: "Inhale 4, hold 7, exhale 8. Extended exhale activates the parasympathetic nervous system.",
    requiresEmptyStomach: false,
  },
];

const PHASE_LABELS = ["Inhale", "Hold", "Exhale", "Hold"];
const PHASE_COLORS = [
  "text-accent",       // inhale
  "text-text-2",       // hold in
  "text-ok",           // exhale
  "text-text-3",       // hold out
];

type BreathPacerProps = {
  technique?: BreathTechnique;
  rounds?: number;
};

export function BreathPacer({ technique: initialTechnique, rounds: targetRounds = 10 }: BreathPacerProps) {
  const [technique, setTechnique] = useState(initialTechnique ?? TECHNIQUES[0]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0); // 0-3: inhale, holdIn, exhale, holdOut
  const [phaseProgress, setPhaseProgress] = useState(0); // 0-1
  const [completedRounds, setCompletedRounds] = useState(0);
  const [stomachConfirmed, setStomachConfirmed] = useState(false);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const phaseDuration = technique.pattern[phase];
  const cycleTotal = technique.pattern.reduce((a, b) => a + b, 0);

  const needsConfirmation = technique.requiresEmptyStomach && !stomachConfirmed;

  const tickRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    setRunning(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const tick = useCallback(() => {
    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const cyclePos = elapsed % cycleTotal;

    let accum = 0;
    let currentPhase = 0;
    for (let i = 0; i < 4; i++) {
      if (cyclePos < accum + technique.pattern[i]) {
        currentPhase = i;
        break;
      }
      accum += technique.pattern[i];
      if (i === 3) currentPhase = 3;
    }

    const phaseStart = technique.pattern.slice(0, currentPhase).reduce((a, b) => a + b, 0);
    const progress = technique.pattern[currentPhase] > 0
      ? (cyclePos - phaseStart) / technique.pattern[currentPhase]
      : 0;

    const roundsCompleted = Math.floor(elapsed / cycleTotal);

    setPhase(currentPhase);
    setPhaseProgress(Math.min(1, progress));
    setCompletedRounds(roundsCompleted);

    if (roundsCompleted >= targetRounds) {
      stop();
      return;
    }

    animRef.current = requestAnimationFrame(() => tickRef.current?.());
  }, [technique, cycleTotal, targetRounds, stop]);

  // Keep tickRef in sync with latest tick
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const start = useCallback(() => {
    startTimeRef.current = performance.now();
    setRunning(true);
    setCompletedRounds(0);
    setPhase(0);
    setPhaseProgress(0);
    animRef.current = requestAnimationFrame(() => tickRef.current?.());
  }, []);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Circle animation
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dash = phaseProgress * circumference;

  return (
    <Card padded>
      <div className="flex flex-col items-center gap-4">
        {/* Technique selector */}
        {!running && (
          <div className="flex flex-wrap gap-2 justify-center">
            {TECHNIQUES.map((t) => (
              <button
                key={t.slug}
                onClick={() => {
                  setTechnique(t);
                  setStomachConfirmed(false);
                }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  technique.slug === t.slug
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line text-text-3 hover:border-accent/30"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        <h3 className="text-sm font-semibold text-text-1">{technique.name}</h3>
        <p className="text-xs text-text-3 text-center max-w-xs">{technique.description}</p>

        {/* Cautions */}
        {technique.cautions && (
          <div className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn max-w-xs">
            ⚠️ {technique.cautions}
          </div>
        )}

        {/* Empty stomach gate */}
        {needsConfirmation && !running ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-warn">This technique requires an empty stomach.</p>
            <label className="flex items-center gap-2 text-sm text-text-2 justify-center">
              <input
                type="checkbox"
                checked={stomachConfirmed}
                onChange={(e) => setStomachConfirmed(e.target.checked)}
                className="accent-accent"
              />
              I confirm my stomach is empty (≥3h since food)
            </label>
          </div>
        ) : (
          <>
            {/* Breathing circle */}
            <div className="relative">
              <svg width="130" height="130" className="-rotate-90">
                <circle
                  cx="65" cy="65" r={radius}
                  fill="none"
                  stroke="var(--surface-2)"
                  strokeWidth="5"
                />
                <circle
                  cx="65" cy="65" r={radius}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - dash}
                  className="transition-[stroke-dashoffset] duration-100"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {running ? (
                  <>
                    <span className={`text-sm font-bold ${PHASE_COLORS[phase]}`}>
                      {phaseDuration > 0 ? PHASE_LABELS[phase] : ""}
                    </span>
                    <span className="nums text-xs text-text-3 mt-1">
                      {completedRounds}/{targetRounds}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-text-3">
                    {technique.pattern.join(" · ")}
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              {running ? (
                <button onClick={stop} className="btn btn-accent px-6">
                  Stop
                </button>
              ) : (
                <button
                  onClick={start}
                  disabled={needsConfirmation}
                  className="btn btn-accent px-6"
                >
                  {completedRounds > 0 ? "Restart" : "Start"}
                </button>
              )}
            </div>

            {completedRounds >= targetRounds && !running && (
              <Badge tone="ok">✓ {targetRounds} rounds complete</Badge>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
