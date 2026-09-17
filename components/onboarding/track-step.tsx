"use client";

/**
 * Step three  --  which training track.
 *
 * Both tracks are shown in full rather than summarised behind a radio, including their
 * cautions. Picking the harder one on a whim and abandoning it in week two is the most
 * common way a routine like this fails, so the honest week-shape is on screen at the moment
 * of choosing, not discoverable later in the Train view.
 */

import { Badge } from "@/components/ui/badge";
import { TRACKS, type TrackId } from "@/data/tracks";
import { formatDuration } from "@/lib/time";

export function TrackStep({
  value,
  sleepTargetMinutes,
  onChange,
}: {
  value: TrackId;
  /** Track B assumes 7½ hours; choosing it on less than that earns a note, not a block. */
  sleepTargetMinutes: number;
  onChange: (value: TrackId) => void;
}) {
  const underslept = sleepTargetMinutes < 450;

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-text-2">What are you training for?</legend>
        <p className="mt-0.5 text-xs leading-snug text-text-3">
          Changeable at any time in Settings, and the app tracks from the day you switch.
        </p>

        <div className="mt-3 grid gap-3">
          {TRACKS.map((track) => {
            const selected = track.id === value;
            return (
              <label
                key={track.id}
                className={`block cursor-pointer rounded-xl border p-4 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-line bg-surface-2 hover:border-line-strong"
                }`}
              >
                <input
                  type="radio"
                  name="track"
                  value={track.id}
                  checked={selected}
                  onChange={() => onChange(track.id)}
                  className="sr-only"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-text-1">{track.label}</span>
                  <Badge tone={selected ? "accent" : "neutral"}>{track.dailyMinutes} a day</Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-text-2">{track.tagline}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-text-3">
                  <span className="font-medium text-text-2">Right for you if:</span>{" "}
                  {track.forWhom}
                </p>

                <ul className="mt-2.5 space-y-1 border-t border-line pt-2.5">
                  {track.weekShape.map((line) => (
                    <li key={line} className="text-xs leading-relaxed text-text-3">
                      {line}
                    </li>
                  ))}
                </ul>

                <ul className="mt-2.5 space-y-1">
                  {track.cautions.map((caution) => (
                    <li key={caution} className="text-xs leading-relaxed text-warn">
                      {caution}
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
      </fieldset>

      {value === "hardcore" && underslept ? (
        <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed text-text-2">
          Track B on a {formatDuration(sleepTargetMinutes)} sleep target is the combination that
          reliably goes wrong  --  the training load lands but the recovery does not. Nothing here
          stops you, and the app will not silently swap it; it will tell you when resting heart
          rate starts drifting.
        </p>
      ) : null}
    </div>
  );
}
