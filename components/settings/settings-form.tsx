"use client";

/**
 * Everything the day is computed from, in one form.
 *
 * One save button rather than one per section, and only the fields that actually changed are
 * sent  --  a form that PATCHed all twelve values would overwrite whatever another tab had just
 * altered. The preview at the bottom recomputes as you go, so the effect of a changed wake
 * offset is visible before it is saved.
 */

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { DayPreview } from "@/components/onboarding/day-preview";
import {
  type Draft,
  type LocationDraft,
  inputOfDraft,
  locationOfDraft,
} from "@/components/onboarding/draft";
import { LocationStep } from "@/components/onboarding/location-step";
import { WAKE_CHOICES } from "@/components/onboarding/sleep-step";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CheckboxField, ChoiceGroup, Field, selectClass } from "@/components/ui/field";
import { TRACKS } from "@/data/tracks";
import type { ApiResponse } from "@/lib/api";
import { buildDayPlan, type DayInput } from "@/lib/day";
import type { MuhurtaMode } from "@/lib/muhurta";
import { formatClock, formatDuration, todayInZone } from "@/lib/time";
import type { Chronotype, SettingsPatch, Theme } from "@/lib/validators";

export type SettingsFormState = Draft & {
  muhurtaMode: MuhurtaMode;
  theme: Theme;
  clock24h: boolean;
  doshaAccent: boolean;
  reduceMotion: boolean;
};

const CHRONOTYPES: readonly { value: Chronotype; label: string }[] = [
  { value: "early", label: "Morning" },
  { value: "intermediate", label: "Between" },
  { value: "late", label: "Night" },
  { value: "unknown", label: "Not sure" },
];

const THEMES: readonly { value: Theme; label: string; detail: string }[] = [
  { value: "dark", label: "Dark", detail: "The default. Easier at 4 AM." },
  { value: "light", label: "Light", detail: "For bright rooms." },
  { value: "system", label: "System", detail: "Follows the OS setting." },
];

const SLEEP_OPTIONS = Array.from({ length: 13 }, (_, i) => 360 + i * 15);

/** Only what differs, so a save cannot clobber a field the user did not touch. */
function diffOf(initial: SettingsFormState, next: SettingsFormState): SettingsPatch {
  const patch: SettingsPatch = {};
  const before = locationOfDraft(initial.location);
  const after = locationOfDraft(next.location);

  if (
    before.latitude !== after.latitude ||
    before.longitude !== after.longitude ||
    before.timeZone !== after.timeZone ||
    before.city !== after.city ||
    before.region !== after.region
  ) {
    Object.assign(patch, after);
  }

  if (initial.muhurtaMode !== next.muhurtaMode) patch.muhurtaMode = next.muhurtaMode;
  if (initial.chronotype !== next.chronotype) patch.chronotype = next.chronotype;
  if (initial.wakeOffsetMinutes !== next.wakeOffsetMinutes) {
    patch.wakeOffsetMinutes = next.wakeOffsetMinutes;
  }
  if (initial.sleepTargetMinutes !== next.sleepTargetMinutes) {
    patch.sleepTargetMinutes = next.sleepTargetMinutes;
  }
  if (initial.activeTrack !== next.activeTrack) patch.activeTrack = next.activeTrack;
  if (initial.theme !== next.theme) patch.theme = next.theme;
  if (initial.clock24h !== next.clock24h) patch.clock24h = next.clock24h;
  if (initial.doshaAccent !== next.doshaAccent) patch.doshaAccent = next.doshaAccent;
  if (initial.reduceMotion !== next.reduceMotion) patch.reduceMotion = next.reduceMotion;

  return patch;
}

type Status = { kind: "idle" | "saving" | "saved" } | { kind: "failed"; message: string };

export function SettingsForm({ initial }: { initial: SettingsFormState }) {
  const id = useId();
  const router = useRouter();
  const [saved, setSaved] = useState<SettingsFormState>(initial);
  const [form, setForm] = useState<SettingsFormState>(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const set = <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus({ kind: "idle" });
  };

  const plan = useMemo(() => {
    const input: DayInput = { ...inputOfDraft(form), muhurtaMode: form.muhurtaMode };
    return buildDayPlan(todayInZone(input.timeZone), input);
  }, [form]);

  const patch = useMemo(() => diffOf(saved, form), [saved, form]);
  const dirty = Object.keys(patch).length > 0;

  const save = async () => {
    if (!dirty) return;
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json()) as ApiResponse<unknown>;
      if (!payload.ok) {
        setStatus({ kind: "failed", message: payload.error });
        return;
      }
      setSaved(form);
      setStatus({ kind: "saved" });
      // The theme and dosha attributes live on <html>, written by the root layout from this
      // row  --  so a server re-render is what makes a theme change actually appear.
      router.refresh();
    } catch {
      setStatus({
        kind: "failed",
        message: "Could not reach the app's own server. Is `npm run dev` still running?",
      });
    }
  };

  const sunrise = plan.sun.sunrise;
  // Every time on this page follows the unsaved `clock24h`, not the stored one, so ticking
  // the 24-hour box changes what you are looking at rather than only what you will see next.
  const clock = (m: number) => formatClock(m, { hour24: form.clock24h });
  const wakeOptions = WAKE_CHOICES.map((choice) => ({
    value: String(choice.minutes),
    label: sunrise === null ? choice.label : `${choice.label} · ${clock(sunrise + choice.minutes)}`,
    detail: choice.detail,
  }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="space-y-4"
    >
      <Card>
        <CardHeader
          title="Where you are"
          subtitle="Latitude decides sunrise, and sunrise decides everything else."
        />
        <LocationStep
          value={form.location}
          onChange={(location: LocationDraft) => set("location", location)}
        />
      </Card>

      <Card>
        <CardHeader
          title="How the day is derived"
          subtitle="The two choices that change what the windows and anchors mean."
        />
        <div className="space-y-5">
          <ChoiceGroup
            name="muhurtaMode"
            legend="Muhurta length"
            hint="Fixed is what a printed panchang uses. Proportional divides the actual night by fifteen, so the window drifts with the season."
            value={form.muhurtaMode}
            options={[
              { value: "fixed", label: "Fixed · 48 minutes", detail: "Conventional and stable." },
              {
                value: "proportional",
                label: "Proportional · night ÷ 15",
                detail: "Astronomically consistent, and moves through the year.",
              },
            ]}
            onChange={(value) => set("muhurtaMode", value)}
          />

          <ChoiceGroup
            name="wake"
            legend="Wake target"
            hint={`Times shown are for ${plan.place.city} today.`}
            value={String(form.wakeOffsetMinutes)}
            options={wakeOptions}
            onChange={(value) => set("wakeOffsetMinutes", Number(value))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Sleep target"
              htmlFor={`${id}-sleep`}
              hint={`Lights out becomes ${clock(plan.personal.bedtime)}.`}
            >
              <select
                id={`${id}-sleep`}
                value={String(form.sleepTargetMinutes)}
                onChange={(event) => set("sleepTargetMinutes", Number(event.target.value))}
                className={selectClass}
              >
                {SLEEP_OPTIONS.map((minutes) => (
                  <option key={minutes} value={String(minutes)}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            </Field>

            <ChoiceGroup
              name="chronotype"
              legend="Chronotype"
              value={form.chronotype}
              options={CHRONOTYPES}
              onChange={(value) => set("chronotype", value)}
              columns={2}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Training track"
          subtitle="Switching takes effect from today; the app tracks each block separately."
        />
        <ChoiceGroup
          name="track"
          legend="Active track"
          value={form.activeTrack}
          options={TRACKS.map((track) => ({
            value: track.id,
            label: track.label,
            detail: track.tagline,
          }))}
          onChange={(value) => set("activeTrack", value)}
          columns={2}
        />
      </Card>

      <Card>
        <CardHeader title="Display" subtitle="None of this changes what the app computes." />
        <div className="space-y-4">
          <ChoiceGroup
            name="theme"
            legend="Theme"
            value={form.theme}
            options={THEMES}
            onChange={(value) => set("theme", value)}
            columns={3}
          />
          <div className="space-y-3 border-t border-line pt-4">
            <CheckboxField
              id={`${id}-clock`}
              label="24-hour clock"
              hint="Every time in the app, including the dial."
              checked={form.clock24h}
              onChange={(value) => set("clock24h", value)}
            />
            <CheckboxField
              id={`${id}-dosha`}
              label="Shift the accent colour with the dosha period"
              hint="Indigo through the Vata hours, jade through Kapha, saffron through Pitta. Turn it off for one fixed accent."
              checked={form.doshaAccent}
              onChange={(value) => set("doshaAccent", value)}
            />
            <CheckboxField
              id={`${id}-motion`}
              label="Reduce motion"
              hint="Stops the transitions on the dial and the accent shift. Your OS setting is respected regardless."
              checked={form.reduceMotion}
              onChange={(value) => set("reduceMotion", value)}
            />
          </div>
        </div>
      </Card>

      <DayPreview plan={plan} clock24h={form.clock24h} />

      <div className="sticky bottom-16 z-10 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-1/95 p-3 backdrop-blur lg:bottom-4">
        <p aria-live="polite" className="min-w-0 text-xs text-text-3">
          {status.kind === "failed" ? (
            <span className="text-danger">{status.message}</span>
          ) : status.kind === "saving" ? (
            "Saving…"
          ) : status.kind === "saved" && !dirty ? (
            "Saved."
          ) : dirty ? (
            `${Object.keys(patch).length} unsaved change${Object.keys(patch).length === 1 ? "" : "s"}.`
          ) : (
            "Nothing to save."
          )}
        </p>
        <Button type="submit" disabled={!dirty || status.kind === "saving"}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
