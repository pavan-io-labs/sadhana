"use client";

/**
 * Today in order  --  the chronological read of the same data the ring draws.
 *
 * Every row says where it came from: the sun, the tradition, or the user's own settings.
 * That distinction is the point of the app, and burying it would make the computed times
 * look like arbitrary assertions.
 */

import { useLiveDate } from "@/components/hooks";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { DayPlan, LandmarkKind } from "@/lib/day";
import { formatClock, formatDuration, minuteOfDayInZone } from "@/lib/time";

const KIND_LABELS: Record<LandmarkKind, string> = {
  sun: "Sun",
  muhurta: "Tradition",
  personal: "Your settings",
};

export function LandmarkList({
  plan,
  clock24h,
  nowIso,
}: {
  plan: DayPlan;
  clock24h: boolean;
  nowIso: string;
}) {
  const minute = minuteOfDayInZone(useLiveDate(nowIso), plan.timeZone);
  const nextIndex = plan.landmarks.findIndex((l) => l.minute > minute);

  return (
    <Card>
      <CardHeader
        title="Today in order"
        subtitle={`${plan.place.city} · every time below is computed for this date and this latitude.`}
      />
      <ol className="divide-y divide-line">
        {plan.landmarks.map((landmark, i) => {
          const past = landmark.minute <= minute;
          const isNext = i === nextIndex;
          return (
            <li
              key={landmark.id}
              className={`grid grid-cols-[5rem_1fr] items-baseline gap-3 py-2.5 ${
                past ? "opacity-55" : ""
              }`}
            >
              <time
                className={`nums text-sm font-semibold ${isNext ? "text-accent" : "text-text-2"}`}
              >
                {formatClock(landmark.minute, { hour24: clock24h })}
              </time>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-text-1">
                  {landmark.label}
                  {isNext ? (
                    <Badge tone="accent">in {formatDuration(landmark.minute - minute)}</Badge>
                  ) : null}
                  <span className="text-[0.6875rem] font-normal tracking-wide text-text-3 uppercase">
                    {KIND_LABELS[landmark.kind]}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-snug text-text-3">{landmark.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
