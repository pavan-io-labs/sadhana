/**
 * Workout logger  --  client component for logging sets during a training session.
 *
 * Renders the prescribed exercises, lets the user enter weight/reps/RPE per set,
 * and saves the full workout to /api/workouts on completion.
 */

"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SetEntry = {
  exerciseSlug: string;
  setIndex: number;
  reps: number;
  weight: number;
  rpe: number | null;
  isWarmup: boolean;
  completed: boolean;
};

type ExercisePlan = {
  slug: string;
  name: string;
  target: string;
  sets: number;
  prescription: string;
  suggestedWeight: number | null;
};

export function WorkoutLogger({
  date,
  sessionSlug,
  exercises,
}: {
  date: string;
  sessionSlug: string;
  exercises: ExercisePlan[];
}) {
  const queryClient = useQueryClient();
  const [sets, setSets] = useState<SetEntry[]>(() => {
    const initial: SetEntry[] = [];
    exercises.forEach((ex) => {
      for (let i = 0; i < ex.sets; i++) {
        initial.push({
          exerciseSlug: ex.slug,
          setIndex: i + 1,
          reps: 0,
          weight: ex.suggestedWeight ?? 0,
          rpe: null,
          isWarmup: false,
          completed: false,
        });
      }
    });
    return initial;
  });

  const [saved, setSaved] = useState(false);

  const updateSet = useCallback(
    (exerciseSlug: string, setIndex: number, field: keyof SetEntry, value: number | boolean | null) => {
      setSets((prev) =>
        prev.map((s) =>
          s.exerciseSlug === exerciseSlug && s.setIndex === setIndex
            ? { ...s, [field]: value }
            : s,
        ),
      );
    },
    [],
  );

  const toggleComplete = useCallback((exerciseSlug: string, setIndex: number) => {
    setSets((prev) =>
      prev.map((s) =>
        s.exerciseSlug === exerciseSlug && s.setIndex === setIndex
          ? { ...s, completed: !s.completed }
          : s,
      ),
    );
  }, []);

  const saveWorkout = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          sessionSlug,
          sets: sets.map((s) => ({
            exerciseSlug: s.exerciseSlug,
            setIndex: s.setIndex,
            reps: s.reps,
            weight: s.weight,
            rpe: s.rpe,
            isWarmup: s.isWarmup,
            completed: s.completed,
          })),
        }),
      });
      if (!resp.ok) throw new Error("Failed to save workout");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      setSaved(true);
    },
  });

  const completedSets = sets.filter((s) => s.completed).length;
  const totalSets = sets.length;

  return (
    <Card padded={false}>
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-1">Log workout</h3>
          <span className="nums text-xs text-text-3">{completedSets}/{totalSets} sets</span>
        </div>
      </div>

      <div className="divide-y divide-line">
        {exercises.map((ex) => {
          const exSets = sets.filter((s) => s.exerciseSlug === ex.slug);
          return (
            <div key={ex.slug} className="px-4 py-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-text-1">{ex.name}</p>
                  <p className="text-xs text-text-3">{ex.prescription}</p>
                </div>
                {ex.suggestedWeight !== null && (
                  <Badge tone="accent" className="text-[10px]">
                    {ex.suggestedWeight} kg
                  </Badge>
                )}
              </div>

              <div className="space-y-1.5">
                {exSets.map((set) => (
                  <div key={set.setIndex} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleComplete(ex.slug, set.setIndex)}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
                        set.completed
                          ? "border-accent bg-accent text-white"
                          : "border-line text-text-3 hover:border-accent/50"
                      }`}
                    >
                      {set.completed ? "✓" : set.setIndex}
                    </button>

                    <input
                      type="number"
                      value={set.weight || ""}
                      onChange={(e) =>
                        updateSet(ex.slug, set.setIndex, "weight", Number(e.target.value))
                      }
                      placeholder="kg"
                      className="field nums w-16 text-center text-xs"
                    />
                    <span className="text-xs text-text-3">×</span>
                    <input
                      type="number"
                      value={set.reps || ""}
                      onChange={(e) =>
                        updateSet(ex.slug, set.setIndex, "reps", Number(e.target.value))
                      }
                      placeholder="reps"
                      className="field nums w-14 text-center text-xs"
                    />
                    <input
                      type="number"
                      value={set.rpe ?? ""}
                      onChange={(e) =>
                        updateSet(
                          ex.slug,
                          set.setIndex,
                          "rpe",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                      placeholder="RPE"
                      className="field nums w-14 text-center text-xs"
                      min={1}
                      max={10}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line px-4 py-3">
        {saved ? (
          <p className="text-sm text-ok text-center font-medium">✓ Workout saved</p>
        ) : (
          <button
            onClick={() => saveWorkout.mutate()}
            disabled={saveWorkout.isPending || completedSets === 0}
            className="btn btn-accent w-full"
          >
            {saveWorkout.isPending ? "Saving…" : `Save workout (${completedSets} sets)`}
          </button>
        )}
      </div>
    </Card>
  );
}
