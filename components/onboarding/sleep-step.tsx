"use client";

/**
 * Step two  --  sleep, which is the input everything else depends on.
 *
 * The wake choices are named after what they mean rather than given as a number of minutes,
 * and each one shows the time it actually produces for the location chosen in step one. The
 * chronotype answer recommends one of them instead of overriding the user's pick: a night
 * owl held to a 4:45 wake gets less sleep, not more discipline.
 */

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceGroup, Field, selectClass } from "@/components/ui/field";
import type { DayPlan } from "@/lib/day";
import { formatClock, formatDuration } from "@/lib/time";
import type { Chronotype } from "@/lib/validators";

/** The four wake targets the routine actually recommends, in minutes from sunrise. */
export const WAKE_CHOICES = [
  {
    minutes: -90,
    label: "Brahma Muhurta",
    detail: "Inside the classical window. The full traditional morning, and the hardest to hold.",
  },
  {
    minutes: -75,
    label: "Traditional",
    detail: "4:45 on a six o'clock sunrise. Leaves an unhurried hour before the day starts.",
  },
  {
    minutes: -30,
    label: "Sandhya",
    detail: "The dawn junction. The realistic target for a working week, still ahead of cortisol.",
  },
  {
    minutes: 0,
    label: "With the sun",
    detail: "No earlier than sunrise. A starting point if mornings are currently a struggle.",
  },
] as const;

const CHRONOTYPES: readonly { value: Chronotype; label: string; detail: string }[] = [
  {
    value: "early",
    label: "Morning person",
    detail: "Awake and useful early without an alarm, fading by mid-evening.",
  },
  {
    value: "intermediate",
    label: "Somewhere between",
    detail: "Neither strongly. Most people are here.",
  },
  {
    value: "late",
    label: "Night person",
    detail: "Slow mornings, sharpest late. Genuine, and partly genetic.",
  },
  {
    value: "unknown",
    label: "Not sure",
    detail: "The questionnaire in Insights will answer it properly later.",
  },
];

/** What each chronotype makes sustainable, which is not the same as what is ideal. */
const RECOMMENDED: Record<Chronotype, number> = {
  early: -90,
  intermediate: -75,
  late: -30,
  unknown: -75,
};

const RECOMMENDATION_PREFIX: Record<Chronotype, string> = {
  early: "For someone who is up early anyway,",
  intermediate: "For most people,",
  late: "For a genuine night owl,",
  unknown: "As a first attempt,",
};

/** 6h to 9h in quarter-hour steps. Below 7h is allowed but flagged, not silently accepted. */
const SLEEP_OPTIONS = Array.from({ length: 13 }, (_, i) => 360 + i * 15);

export function SleepStep({
  chronotype,
  wakeOffsetMinutes,
  sleepTargetMinutes,
  plan,
  onChronotype,
  onWakeOffset,
  onSleepTarget,
}: {
  chronotype: Chronotype;
  wakeOffsetMinutes: number;
  sleepTargetMinutes: number;
  /** Computed from the answers so far, so each option can show a real time. */
  plan: DayPlan;
  onChronotype: (value: Chronotype) => void;
  onWakeOffset: (minutes: number) => void;
  onSleepTarget: (minutes: number) => void;
}) {
  const id = useId();
  const sunrise = plan.sun.sunrise;
  const recommended = RECOMMENDED[chronotype];
  const mismatched = recommended !== wakeOffsetMinutes;
  const recommendedLabel =
    WAKE_CHOICES.find((choice) => choice.minutes === recommended)?.label ?? "Traditional";

  const wakeOptions = WAKE_CHOICES.map((choice) => ({
    value: String(choice.minutes),
    label:
      sunrise === null
        ? choice.label
        : `${choice.label} · ${formatClock(sunrise + choice.minutes)}`,
    detail: choice.detail,
  }));

  return (
    <div className="space-y-5">
      <ChoiceGroup
        name="chronotype"
        legend="Left to your own devices, when are you actually awake?"
        hint="This does not set your wake time  --  it decides which wake time the app will argue for."
        value={chronotype}
        options={CHRONOTYPES}
        onChange={onChronotype}
        columns={2}
      />

      <div>
        <ChoiceGroup
          name="wake"
          legend="When do you want to be up?"
          hint={
            sunrise === null
              ? "The sun does not rise at this latitude today, so these are offsets from the estimated anchor."
              : `Times shown are for ${plan.place.city} today; they move with sunrise through the year.`
          }
          value={String(wakeOffsetMinutes)}
          options={wakeOptions}
          onChange={(value) => onWakeOffset(Number(value))}
          columns={2}
        />
        {mismatched ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-3">
            <span>
              {RECOMMENDATION_PREFIX[chronotype]} {recommendedLabel} is the one most likely to
              survive a month.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onWakeOffset(recommended)}
            >
              Use {recommendedLabel}
            </Button>
          </p>
        ) : null}
      </div>

      <Field
        label="Sleep you are aiming for"
        htmlFor={`${id}-sleep`}
        hint="Lights out is derived from this and your wake time, not chosen separately."
      >
        <select
          id={`${id}-sleep`}
          value={String(sleepTargetMinutes)}
          onChange={(event) => onSleepTarget(Number(event.target.value))}
          className={selectClass}
        >
          {SLEEP_OPTIONS.map((minutes) => (
            <option key={minutes} value={String(minutes)}>
              {formatDuration(minutes)}
            </option>
          ))}
        </select>
      </Field>

      {sleepTargetMinutes < 420 ? (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed text-text-2">
          Under seven hours, the app will keep raising this  --  not to nag, but because it is the
          one input that undermines every other thing on the list. Set it where you honestly
          intend to be and let the advisories do their job.
        </p>
      ) : null}
    </div>
  );
}
