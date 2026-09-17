"use client";

/**
 * Now and next  --  the one card that answers "what am I supposed to be doing".
 *
 * It states the current dosha period in words, what the tradition holds that period is for,
 * whether the moment falls inside one of the named windows, and the next landmark with a
 * live countdown. Everything else on Today is reference; this is the answer.
 */

import { useLiveDate } from "@/components/hooks";
import { Badge, Dot } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { type ActiveWindow, type DayPlan, nowState } from "@/lib/day";
import { formatClock, formatDuration } from "@/lib/time";

const WINDOW_LABELS: Record<ActiveWindow, string> = {
  brahma: "In Brahma Muhurta",
  pratahSandhya: "In Pratah Sandhya",
  abhijit: "In Abhijit Muhurta",
  sayamSandhya: "In Sayam Sandhya",
};

export function NowNext({
  plan,
  clock24h,
  nowIso,
}: {
  plan: DayPlan;
  clock24h: boolean;
  nowIso: string;
}) {
  const state = nowState(plan, useLiveDate(nowIso));
  const clock = (m: number) => formatClock(m, { hour24: clock24h });

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-text-1">
          <Dot tone={state.period.dosha} />
          {state.period.label}
        </p>
        {state.inWindows.map((id) => (
          <Badge key={id} tone="accent">
            {WINDOW_LABELS[id]}
          </Badge>
        ))}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-text-2">{state.period.suits}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-text-3">
        <span className="font-medium text-text-2">Works against it:</span> {state.period.avoid}
      </p>

      <p className="nums mt-3 text-xs text-text-3">
        {formatDuration(state.nextInMinutes)} left · then {state.next.label}
      </p>

      {state.upcoming ? (
        <div className="mt-4 border-t border-line pt-3.5">
          <p className="text-[0.6875rem] font-medium tracking-wider text-text-3 uppercase">
            Next
          </p>
          <p className="nums mt-1 text-sm font-semibold text-text-1">
            {state.upcoming.landmark.label} at {clock(state.upcoming.landmark.minute)}
            <span className="font-normal text-text-3">
              {" · in "}
              {formatDuration(state.upcoming.inMinutes)}
            </span>
          </p>
          <p className="mt-1 text-xs leading-snug text-text-3">
            {state.upcoming.landmark.detail}
          </p>
        </div>
      ) : (
        <div className="mt-4 border-t border-line pt-3.5">
          <p className="text-sm text-text-2">
            Nothing left on today&rsquo;s dial. The next thing is tomorrow&rsquo;s Brahma
            Muhurta  --  which is a reason to be asleep.
          </p>
        </div>
      )}
    </Card>
  );
}
