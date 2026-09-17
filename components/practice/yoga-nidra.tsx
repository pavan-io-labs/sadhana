/**
 * Yoga Nidra / NSDR timer  --  guided non-sleep deep rest.
 *
 * Unlike the generic practice timer, this has discrete phases with
 * rotation-of-consciousness cues, progressive stage transitions, and
 * a gentle wake sequence at the end.
 *
 * Three presets: Short (10 min), Standard (20 min), Extended (30 min).
 * Each preset maps to the same stages at proportional durations.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Stage = {
  id: string;
  label: string;
  cue: string;
  /** Fraction of total duration (0-1). All fractions must sum to 1. */
  fraction: number;
  /** Colour token for the progress ring. */
  color: string;
};

const STAGES: Stage[] = [
  {
    id: "settle",
    label: "Settling In",
    cue: "Find a comfortable position. Close your eyes. Feel the weight of your body supported beneath you.",
    fraction: 0.1,
    color: "var(--text-3)",
  },
  {
    id: "sankalpa",
    label: "Sankalpa (Resolve)",
    cue: "State your intention silently  --  a short, positive, present-tense sentence. Feel it as already true.",
    fraction: 0.05,
    color: "var(--accent)",
  },
  {
    id: "body-scan",
    label: "Body Scan",
    cue: "Right hand thumb… index finger… middle… ring… little… palm… wrist… forearm… elbow… upper arm… shoulder. Left hand thumb… Move awareness through each part without moving.",
    fraction: 0.35,
    color: "var(--ok)",
  },
  {
    id: "breath",
    label: "Breath Awareness",
    cue: "Notice the breath at the nostrils. Cool air in, warm air out. Don't change it. Count backward from 27 if the mind wanders.",
    fraction: 0.15,
    color: "var(--accent)",
  },
  {
    id: "opposites",
    label: "Pairs of Opposites",
    cue: "Heaviness… and lightness. Warmth… and coolness. Feel each fully, then let it dissolve.",
    fraction: 0.1,
    color: "var(--warn)",
  },
  {
    id: "visualization",
    label: "Visualization",
    cue: "A still lake at dawn. See the water. Hear the silence. Notice the sky. Let images arise and pass without holding.",
    fraction: 0.1,
    color: "var(--accent)",
  },
  {
    id: "sankalpa-return",
    label: "Sankalpa (Return)",
    cue: "Recall your sankalpa. Repeat it three times with full feeling and conviction.",
    fraction: 0.05,
    color: "var(--accent)",
  },
  {
    id: "wake",
    label: "Gentle Wake",
    cue: "Become aware of sounds around you. Feel the surface beneath you. Wiggle fingers and toes. Take a deep breath. When ready, open your eyes.",
    fraction: 0.1,
    color: "var(--text-1)",
  },
];

type Preset = { label: string; totalMinutes: number; description: string };

const PRESETS: Preset[] = [
  { label: "Short NSDR", totalMinutes: 10, description: "Quick reset  --  ideal for afternoon dips" },
  { label: "Standard", totalMinutes: 20, description: "Traditional Yoga Nidra length" },
  { label: "Extended", totalMinutes: 30, description: "Deep rest  --  equivalent to 2–3 hours of sleep" },
];

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function YogaNidraTimer({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState(1); // default: Standard (20 min)
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds elapsed
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = PRESETS[preset].totalMinutes * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);

  // Compute which stage we're in
  const currentStageInfo = (() => {
    const progress = elapsed / totalSeconds;
    let accum = 0;
    for (let i = 0; i < STAGES.length; i++) {
      accum += STAGES[i].fraction;
      if (progress < accum || i === STAGES.length - 1) {
        const stageStart = accum - STAGES[i].fraction;
        const stageProgress =
          STAGES[i].fraction > 0
            ? (progress - stageStart) / STAGES[i].fraction
            : 1;
        return {
          index: i,
          stage: STAGES[i],
          stageProgress: Math.min(1, Math.max(0, stageProgress)),
        };
      }
    }
    return { index: 0, stage: STAGES[0], stageProgress: 0 };
  })();

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= totalSeconds - 1) {
            stop();
            setCompleted(true);
            return totalSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, totalSeconds, stop]);

  const logPractice = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          kind: "nidra",
          practiceSlug: "yoga-nidra",
          durationSeconds: elapsed,
        }),
      });
      if (!resp.ok) throw new Error("Failed to log");
      return resp.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice"] }),
  });

  // Auto-log on completion
  useEffect(() => {
    if (completed && !logPractice.isPending && !logPractice.isSuccess) {
      logPractice.mutate();
    }
  }, [completed, logPractice]);

  const handleStart = () => {
    if (completed) {
      setElapsed(0);
      setCompleted(false);
    }
    setRunning(true);
  };

  const handleReset = () => {
    stop();
    setElapsed(0);
    setCompleted(false);
  };

  // SVG ring
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const overallProgress = elapsed / totalSeconds;

  return (
    <Card padded={false}>
      <div className="px-4 py-3 border-b border-line">
        <CardHeader
          title="Yoga Nidra / NSDR"
          subtitle="Non-Sleep Deep Rest"
        />
      </div>

      <div className="flex flex-col items-center gap-4 p-4">
        {/* Preset selector  --  only before starting */}
        {!running && !completed && (
          <div className="flex gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => { setPreset(i); setElapsed(0); }}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors text-center ${
                  preset === i
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-line text-text-3 hover:border-accent/30"
                }`}
              >
                <span className="font-semibold block">{p.label}</span>
                <span className="text-[10px] opacity-70">{p.totalMinutes} min</span>
              </button>
            ))}
          </div>
        )}

        {/* Timer ring */}
        <div className="relative">
          <svg width="140" height="140" className="-rotate-90">
            {/* Background track */}
            <circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="5"
            />
            {/* Stage segments on the track */}
            {STAGES.map((stage, i) => {
              const startFrac = STAGES.slice(0, i).reduce((s, st) => s + st.fraction, 0);
              const segDash = stage.fraction * circumference;
              const segOffset = circumference - startFrac * circumference;
              const isPast = overallProgress >= startFrac + stage.fraction;
              const isCurrent = currentStageInfo.index === i;
              return (
                <circle
                  key={stage.id}
                  cx="70" cy="70" r={radius}
                  fill="none"
                  stroke={isPast || isCurrent ? stage.color : "var(--surface-2)"}
                  strokeWidth="5"
                  strokeDasharray={`${isCurrent ? currentStageInfo.stageProgress * segDash : isPast ? segDash : 0} ${circumference}`}
                  strokeDashoffset={segOffset}
                  opacity={isPast ? 0.4 : isCurrent ? 1 : 0.15}
                  className="transition-all duration-1000"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="nums text-2xl font-bold text-text-1">
              {formatMMSS(remaining)}
            </span>
            <span className="text-[10px] text-text-3 mt-0.5">
              {running ? `${currentStageInfo.index + 1}/${STAGES.length}` : `${PRESETS[preset].totalMinutes} min`}
            </span>
          </div>
        </div>

        {/* Current stage info */}
        {running && (
          <div className="text-center max-w-xs animate-in fade-in duration-500">
            <p
              className="text-sm font-semibold mb-1"
              style={{ color: currentStageInfo.stage.color }}
            >
              {currentStageInfo.stage.label}
            </p>
            <p className="text-xs text-text-2 leading-relaxed">
              {currentStageInfo.stage.cue}
            </p>
          </div>
        )}

        {/* Stage progress dots */}
        <div className="flex gap-1.5">
          {STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className="flex flex-col items-center gap-0.5"
              title={stage.label}
            >
              <div
                className={`h-2 w-2 rounded-full transition-all duration-500 ${
                  i < currentStageInfo.index
                    ? "opacity-40"
                    : i === currentStageInfo.index
                      ? "scale-125"
                      : "opacity-20"
                }`}
                style={{
                  backgroundColor:
                    i <= currentStageInfo.index ? stage.color : "var(--surface-2)",
                }}
              />
            </div>
          ))}
        </div>

        {/* Description when not running */}
        {!running && !completed && (
          <p className="text-xs text-text-3 text-center max-w-xs">
            {PRESETS[preset].description}
          </p>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {completed ? (
            <div className="text-center space-y-2">
              <Badge tone="ok">✓ Session logged</Badge>
              <p className="text-xs text-text-3">
                {PRESETS[preset].totalMinutes} minutes of deep rest
              </p>
              <button onClick={handleReset} className="btn text-xs">
                Reset
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={running ? stop : handleStart}
                className="btn btn-accent px-8"
              >
                {running ? "Pause" : elapsed > 0 ? "Resume" : "Begin"}
              </button>
              {elapsed > 0 && !running && (
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
