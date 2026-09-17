"use client";

/**
 * First run, in three answers.
 *
 * The draft lives here and the steps are controlled, so the live preview under every step is
 * computed from the same state the final POST sends  --  there is no way for what the user saw
 * to differ from what got saved.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DayPreview } from "@/components/onboarding/day-preview";
import { type Draft, bodyOfDraft, inputOfDraft } from "@/components/onboarding/draft";
import { LocationStep } from "@/components/onboarding/location-step";
import { SleepStep } from "@/components/onboarding/sleep-step";
import { TrackStep } from "@/components/onboarding/track-step";
import { Button } from "@/components/ui/button";
import type { ApiResponse } from "@/lib/api";
import { buildDayPlan } from "@/lib/day";
import { todayInZone } from "@/lib/time";

const STEPS = [
  {
    id: "location",
    title: "Where you are",
    blurb:
      "Every time in this app is derived from your sunrise. Nothing else works until this is right.",
  },
  {
    id: "sleep",
    title: "How you sleep",
    blurb:
      "Wake time is chosen as a relationship to sunrise, not a clock time  --  so it stays correct in June and in December.",
  },
  {
    id: "track",
    title: "What you train",
    blurb: "Two honest options. The gentler one is the right answer more often than not.",
  },
] as const;

export function OnboardingFlow({ initial }: { initial: Draft }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(() => {
    const input = inputOfDraft(draft);
    return buildDayPlan(todayInZone(input.timeZone), input);
  }, [draft]);

  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyOfDraft(draft)),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!payload.ok) {
        setError(payload.error);
        setSaving(false);
        return;
      }
      // `replace` rather than `push`: this page redirects to `/` now that the row is written,
      // so leaving it in history would only bounce. `refresh` afterwards drops the router
      // cache  --  the theme and dosha attributes on <html> come from the root layout reading
      // the row that was just saved, and any entry cached while the app was still
      // un-onboarded would be a redirect.
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the app's own server. Is `npm run dev` still running?");
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (last) void finish();
        else setStep((n) => Math.min(n + 1, STEPS.length - 1));
      }}
      className="space-y-5"
    >
      <ol className="flex gap-2" aria-label="Setup progress">
        {STEPS.map((item, index) => {
          const state = index === step ? "current" : index < step ? "done" : "todo";
          return (
            <li key={item.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setStep(index)}
                // Going back is allowed; skipping ahead is not, because step two shows times
                // computed from step one.
                disabled={index > step}
                aria-current={state === "current" ? "step" : undefined}
                className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
              >
                <span
                  className={`block h-1 rounded-full ${
                    state === "todo" ? "bg-line" : "bg-accent"
                  }`}
                />
                <span
                  className={`mt-1.5 block truncate text-xs ${
                    state === "current" ? "font-medium text-text-1" : "text-text-3"
                  }`}
                >
                  {index + 1}. {item.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-text-1">{current.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-text-3">{current.blurb}</p>
      </div>

      {current.id === "location" ? (
        <LocationStep
          value={draft.location}
          onChange={(location) => setDraft((d) => ({ ...d, location }))}
        />
      ) : null}

      {current.id === "sleep" ? (
        <SleepStep
          chronotype={draft.chronotype}
          wakeOffsetMinutes={draft.wakeOffsetMinutes}
          sleepTargetMinutes={draft.sleepTargetMinutes}
          plan={plan}
          onChronotype={(chronotype) => setDraft((d) => ({ ...d, chronotype }))}
          onWakeOffset={(wakeOffsetMinutes) => setDraft((d) => ({ ...d, wakeOffsetMinutes }))}
          onSleepTarget={(sleepTargetMinutes) => setDraft((d) => ({ ...d, sleepTargetMinutes }))}
        />
      ) : null}

      {current.id === "track" ? (
        <TrackStep
          value={draft.activeTrack}
          sleepTargetMinutes={draft.sleepTargetMinutes}
          onChange={(activeTrack) => setDraft((d) => ({ ...d, activeTrack }))}
        />
      ) : null}

      <DayPreview plan={plan} />

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-text-1">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((n) => Math.max(n - 1, 0))}
          disabled={step === 0 || saving}
        >
          Back
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : last ? "Start" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
