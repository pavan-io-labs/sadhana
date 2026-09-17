/**
 * Surya Namaskar counter  --  animated round tracker for the sun salutation sequence.
 *
 * Counts rounds, tracks timing, and logs the practice on completion.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const POSES = [
  "Pranamasana (Prayer)",
  "Hasta Uttanasana (Raised Arms)",
  "Uttanasana (Standing Forward Bend)",
  "Ashwa Sanchalanasana (Equestrian)",
  "Dandasana (Plank)",
  "Ashtanga Namaskara (Eight-Limbed)",
  "Bhujangasana (Cobra)",
  "Adho Mukha Svanasana (Down Dog)",
  "Ashwa Sanchalanasana (Equestrian)",
  "Uttanasana (Standing Forward Bend)",
  "Hasta Uttanasana (Raised Arms)",
  "Pranamasana (Prayer)",
];

export function SuryaNamaskarCounter({
  date,
  target = 12,
}: {
  date: string;
  target?: number;
}) {
  const queryClient = useQueryClient();
  const [rounds, setRounds] = useState(0);
  const [currentPose, setCurrentPose] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [logged, setLogged] = useState(false);
  const [elapsedMin, setElapsedMin] = useState(0);

  // Update elapsed time via effect instead of calling Date.now() during render
  useEffect(() => {
    if (!startTime || logged) return;
    const id = setInterval(() => {
      setElapsedMin(Math.round((Date.now() - startTime) / 60000));
    }, 10000);
    return () => clearInterval(id);
  }, [startTime, logged]);

  const logPractice = useMutation({
    mutationFn: async (durationSeconds: number) => {
      const resp = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          kind: "walk", // Surya Namaskar is stored as a physical practice
          practiceSlug: "surya-namaskar",
          durationSeconds,
          rounds,
        }),
      });
      if (!resp.ok) throw new Error("Failed to log");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice"] });
      setLogged(true);
    },
  });

  const nextPose = useCallback(() => {
    if (!startTime) setStartTime(Date.now());

    if (currentPose < POSES.length - 1) {
      setCurrentPose((p) => p + 1);
    } else {
      // Completed a round
      setRounds((r) => r + 1);
      setCurrentPose(0);
    }
  }, [currentPose, startTime]);

  const handleFinish = () => {
    const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : rounds * 60;
    logPractice.mutate(duration);
  };

  const handleReset = () => {
    setRounds(0);
    setCurrentPose(0);
    setStartTime(null);
    setLogged(false);
  };

  const progress = rounds / target;

  return (
    <Card padded>
      <CardHeader title="Surya Namaskar" subtitle={`Target: ${target} rounds`} />

      {/* Progress ring */}
      <div className="flex flex-col items-center gap-4 mt-4">
        <div className="relative">
          <svg width="140" height="140" className="-rotate-90">
            <circle
              cx="70" cy="70" r="55"
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="6"
            />
            <circle
              cx="70" cy="70" r="55"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 55}
              strokeDashoffset={(1 - Math.min(1, progress)) * 2 * Math.PI * 55}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="nums text-3xl font-bold text-text-1">{rounds}</span>
            <span className="text-xs text-text-3">of {target}</span>
          </div>
        </div>

        {/* Current pose indicator */}
        {!logged && (
          <div className="text-center">
            <p className="text-sm font-medium text-accent">
              {POSES[currentPose]}
            </p>
            <p className="nums text-xs text-text-3 mt-1">
              Pose {currentPose + 1} of {POSES.length}
            </p>

            {/* Pose progress dots */}
            <div className="flex justify-center gap-1 mt-2">
              {POSES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i < currentPose
                      ? "bg-accent"
                      : i === currentPose
                        ? "bg-accent animate-pulse"
                        : "bg-surface-2"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {logged ? (
            <div className="text-center">
              <Badge tone="ok">✓ {rounds} rounds logged</Badge>
              <button onClick={handleReset} className="btn mt-2 text-xs block mx-auto">
                Reset
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={nextPose}
                className="btn btn-accent px-8 py-3 text-base"
              >
                Next
              </button>
              {rounds > 0 && (
                <button
                  onClick={handleFinish}
                  disabled={logPractice.isPending}
                  className="btn px-4"
                >
                  {logPractice.isPending ? "Saving…" : "Finish"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Elapsed time */}
        {startTime && !logged && elapsedMin > 0 && (
          <p className="text-xs text-text-3">
            Started {elapsedMin} min ago
          </p>
        )}
      </div>
    </Card>
  );
}
