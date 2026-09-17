/**
 * Practice timer  --  a simple countdown timer for meditation, pranayama, etc.
 *
 * Client component with start/pause/reset, visual ring progress, and
 * automatic logging to /api/practice on completion.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

type PracticeTimerProps = {
  date: string;
  practiceSlug: string;
  kind: "meditation" | "pranayama" | "nidra" | "abhyanga" | "walk" | "journal" | "mantra";
  defaultSeconds: number;
  label: string;
};

export function PracticeTimer({
  date,
  practiceSlug,
  kind,
  defaultSeconds,
  label,
}: PracticeTimerProps) {
  const queryClient = useQueryClient();
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const logPractice = useMutation({
    mutationFn: async (durationSeconds: number) => {
      const resp = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          kind,
          practiceSlug,
          durationSeconds,
        }),
      });
      if (!resp.ok) throw new Error("Failed to log practice");
      return resp.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice"] }),
  });

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            stop();
            setCompleted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, remaining, stop]);

  // Auto-log on completion
  useEffect(() => {
    if (completed && !logPractice.isPending && !logPractice.isSuccess) {
      logPractice.mutate(totalSeconds);
    }
  }, [completed, totalSeconds, logPractice]);

  const handleStart = () => {
    if (remaining === 0) {
      setRemaining(totalSeconds);
      setCompleted(false);
    }
    setRunning(true);
  };

  const handleReset = () => {
    stop();
    setRemaining(totalSeconds);
    setCompleted(false);
  };

  // SVG ring
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDash = (progress / 100) * circumference;

  return (
    <Card padded>
      <div className="flex flex-col items-center gap-4">
        <h3 className="text-sm font-semibold text-text-1">{label}</h3>

        {/* Ring timer */}
        <div className="relative">
          <svg width="120" height="120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="6"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - strokeDash}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="nums text-2xl font-bold text-text-1">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Duration selector (before start) */}
        {!running && !completed && (
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((m) => (
              <button
                key={m}
                onClick={() => { setTotalSeconds(m * 60); setRemaining(m * 60); }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  totalSeconds === m * 60
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line text-text-3 hover:border-accent/30"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {completed ? (
            <div className="text-center">
              <p className="text-sm text-ok font-medium">✓ Logged</p>
              <button onClick={handleReset} className="btn mt-2 text-xs">
                Reset
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={running ? stop : handleStart}
                className="btn btn-accent px-6"
              >
                {running ? "Pause" : remaining < totalSeconds ? "Resume" : "Start"}
              </button>
              {remaining < totalSeconds && (
                <button onClick={handleReset} className="btn text-xs">
                  Reset
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
