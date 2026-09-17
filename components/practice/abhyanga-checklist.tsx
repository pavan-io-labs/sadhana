/**
 * Abhyanga checklist  --  guided oil self-massage with contraindication warnings.
 *
 * Surfaces cautions (fever, illness, indigestion, menstruation) prominently.
 * Each body region is a checkable step.
 */

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STEPS = [
  { region: "Scalp", instruction: "Warm oil on crown, circular strokes outward over the whole scalp." },
  { region: "Face", instruction: "Gentle upward strokes on cheeks, across forehead, along jawline." },
  { region: "Ears", instruction: "Oil the outer ear, gentle massage of earlobes." },
  { region: "Neck & Shoulders", instruction: "Long strokes down the neck, circular on shoulders." },
  { region: "Arms", instruction: "Long strokes on upper and forearms, circular on elbows." },
  { region: "Hands", instruction: "Circular on wrists, pull each finger, massage palms." },
  { region: "Chest & Abdomen", instruction: "Broad clockwise circles over the abdomen (follows the colon)." },
  { region: "Back", instruction: "Reach behind  --  long strokes where you can, or use a cloth." },
  { region: "Legs", instruction: "Long strokes on thighs and shins, circular on knees and ankles." },
  { region: "Feet", instruction: "Circular on soles, pull each toe. The feet get extra time." },
];

const CAUTIONS = [
  "Fever or acute illness  --  skip until recovered",
  "Skin inflammation, rash, or open wounds  --  avoid affected areas",
  "Indigestion or just eaten  --  wait until the meal settles",
  "Heavy menstruation  --  many traditions recommend skipping; use your judgement",
  "Pregnancy  --  use lighter oil and gentler pressure; consult your provider",
];

export function AbhyangaChecklist({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [cautionAcknowledged, setCautionAcknowledged] = useState(false);
  const [logged, setLogged] = useState(false);

  const allDone = checked.size === STEPS.length;

  const logPractice = useMutation({
    mutationFn: async () => {
      const resp = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          kind: "abhyanga",
          practiceSlug: "abhyanga",
          durationSeconds: checked.size * 60, // ~1 min per region
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

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <Card padded={false}>
      <div className="px-4 py-3 border-b border-line">
        <CardHeader title="Abhyanga" subtitle="Oil self-massage" />
        <p className="mt-1 text-xs text-text-3">
          Warm sesame or coconut oil. 10–15 minutes before bathing.
        </p>
      </div>

      {/* Cautions */}
      {!cautionAcknowledged ? (
        <div className="p-4 space-y-3">
          <div className="rounded-lg border border-warn/30 bg-warn/5 p-3">
            <h4 className="text-xs font-semibold text-warn mb-2">⚠️ Review before proceeding</h4>
            <ul className="space-y-1.5">
              {CAUTIONS.map((caution, i) => (
                <li key={i} className="text-xs text-text-2 flex gap-2">
                  <span className="text-warn shrink-0">•</span>
                  {caution}
                </li>
              ))}
            </ul>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-2">
            <input
              type="checkbox"
              checked={cautionAcknowledged}
              onChange={(e) => setCautionAcknowledged(e.target.checked)}
              className="accent-accent"
            />
            None of these apply to me today
          </label>
        </div>
      ) : (
        <>
          {/* Steps */}
          <div className="divide-y divide-line">
            {STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => toggle(i)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/50 transition-colors"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
                    checked.has(i)
                      ? "border-accent bg-accent text-white"
                      : "border-line text-text-3"
                  }`}
                >
                  {checked.has(i) ? "✓" : i + 1}
                </span>
                <div>
                  <p className={`text-sm font-medium ${checked.has(i) ? "text-text-3 line-through" : "text-text-1"}`}>
                    {step.region}
                  </p>
                  <p className="text-xs text-text-3">{step.instruction}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-line px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="nums text-xs text-text-3">
                {checked.size}/{STEPS.length} regions
              </span>
              {allDone && <Badge tone="ok">Complete</Badge>}
            </div>
            {logged ? (
              <p className="text-sm text-ok text-center font-medium">✓ Logged</p>
            ) : (
              <button
                onClick={() => logPractice.mutate()}
                disabled={!allDone || logPractice.isPending}
                className="btn btn-accent w-full"
              >
                {logPractice.isPending ? "Logging…" : "Log abhyanga session"}
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
