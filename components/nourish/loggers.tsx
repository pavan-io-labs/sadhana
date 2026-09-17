/**
 * Meal logger  --  client component for logging meals, caffeine, and hydration.
 *
 * Used on the Nourish page. Sends data to /api/nourish/* endpoints.
 */

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";

type MealKind = "breakfast" | "lunch" | "dinner" | "snack";
type CaffeineSource = "coffee" | "tea" | "matcha" | "energy-drink" | "other";

export function MealLogger({ date, currentMinute }: { date: string; currentMinute: number }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<MealKind>("lunch");
  const [size, setSize] = useState(3);
  const [notes, setNotes] = useState("");

  const logMeal = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/nourish/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, kind, atMinute: Math.round(currentMinute), size, notes }),
      });
      if (!resp.ok) throw new Error("Failed to log meal");
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nourish"] });
      setNotes("");
    },
  });

  return (
    <Card padded>
      <h3 className="text-sm font-semibold text-text-1 mb-3">Log a meal</h3>
      <div className="space-y-3">
        {/* Kind selector */}
        <div className="flex flex-wrap gap-2">
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                kind === k
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-text-3 hover:border-accent/30"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Size */}
        <div>
          <label className="text-xs text-text-3 block mb-1">
            Size: {size}/5
          </label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <button
                key={i}
                onClick={() => setSize(i + 1)}
                className={`h-4 w-4 rounded-full transition-colors ${
                  i < size ? "bg-accent" : "bg-surface-2"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
          className="field w-full"
        />

        <button
          onClick={() => logMeal.mutate()}
          disabled={logMeal.isPending}
          className="btn btn-accent w-full"
        >
          {logMeal.isPending ? "Logging…" : "Log meal"}
        </button>
      </div>
    </Card>
  );
}

export function CaffeineLogger({ date, currentMinute }: { date: string; currentMinute: number }) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState<CaffeineSource>("coffee");
  const [mg, setMg] = useState(80);

  const DOSES: Record<CaffeineSource, number> = {
    coffee: 80,
    tea: 30,
    matcha: 50,
    "energy-drink": 160,
    other: 80,
  };

  const logCaffeine = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/nourish/caffeine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, atMinute: Math.round(currentMinute), milligrams: mg, source }),
      });
      if (!resp.ok) throw new Error("Failed to log caffeine");
      return resp.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nourish"] }),
  });

  return (
    <Card padded>
      <h3 className="text-sm font-semibold text-text-1 mb-3">Log caffeine</h3>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DOSES) as CaffeineSource[]).map((s) => (
            <button
              key={s}
              onClick={() => { setSource(s); setMg(DOSES[s]); }}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${
                source === s
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-text-3 hover:border-accent/30"
              }`}
            >
              {s.replace("-", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            value={mg}
            onChange={(e) => setMg(Number(e.target.value))}
            className="field w-20 nums"
            min={0}
            max={600}
          />
          <span className="text-xs text-text-3">mg</span>
        </div>

        <button
          onClick={() => logCaffeine.mutate()}
          disabled={logCaffeine.isPending}
          className="btn btn-accent w-full"
        >
          {logCaffeine.isPending ? "Logging…" : "Log caffeine"}
        </button>
      </div>
    </Card>
  );
}

export function HydrationLogger({ date }: { date: string }) {
  const queryClient = useQueryClient();

  const addWater = useMutation({
    mutationFn: async (ml: number) => {
      const resp = await fetch("/api/nourish/hydration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, addMilliliters: ml }),
      });
      if (!resp.ok) throw new Error("Failed to log water");
      return resp.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nourish"] }),
  });

  return (
    <Card padded>
      <h3 className="text-sm font-semibold text-text-1 mb-3">Water</h3>
      <div className="flex gap-2">
        {[250, 500, 750].map((ml) => (
          <button
            key={ml}
            onClick={() => addWater.mutate(ml)}
            disabled={addWater.isPending}
            className="btn flex-1 text-sm"
          >
            +{ml} ml
          </button>
        ))}
      </div>
    </Card>
  );
}
