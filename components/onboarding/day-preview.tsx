"use client";

/**
 * The four numbers that answer "what would this actually mean for me", recomputed as the
 * answers change.
 *
 * This is the whole argument for the app in one panel: the same three choices produce a
 * different morning in Rajkot than in Guwahati, and the user sees that before committing
 * to anything. `buildDayPlan` is pure, so it runs here in the browser with no round-trip.
 */

import { Stat, StatGrid } from "@/components/ui/card";
import type { DayPlan } from "@/lib/day";
import { formatClock, formatDuration } from "@/lib/time";

export function DayPreview({ plan, clock24h = false }: { plan: DayPlan; clock24h?: boolean }) {
  const clock = (m: number | null) => (m === null ? " -- " : formatClock(m, { hour24: clock24h }));
  const { sun, personal, muhurta } = plan;

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4 sm:p-5">
      <p className="text-[0.6875rem] font-medium tracking-wider text-text-3 uppercase">
        Today in {plan.place.city}
      </p>

      <div className="mt-3">
        <StatGrid cols={4}>
          <Stat label="Sunrise" value={clock(sun.sunrise)} hint="Computed, not looked up" />
          <Stat
            label="Brahma Muhurta"
            value={
              muhurta.brahma
                ? `${clock(muhurta.brahma.start)}–${clock(muhurta.brahma.end)}`
                : " -- "
            }
            hint="The classical waking window"
            tone="accent"
          />
          <Stat label="Wake" value={clock(personal.wake)} hint="From your answer above" />
          <Stat
            label="Lights out"
            value={clock(personal.bedtime)}
            hint={`${formatDuration(personal.sleepTargetMinutes)} of sleep`}
          />
        </StatGrid>
      </div>

      <p className="mt-3.5 text-xs leading-relaxed text-text-3">
        {sun.estimated || sun.polar
          ? "The sun does not rise and set normally at this latitude today, so these are estimated from twilight and marked as such throughout the app."
          : "These move every day. The app recomputes them from your latitude each morning rather than holding you to a fixed clock time."}
      </p>
    </div>
  );
}
