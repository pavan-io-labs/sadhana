/**
 * Today  --  the view the app exists for.
 *
 * Everything below is computed for this date and this latitude on the server, then handed
 * down as one `DayPlan`. The order is deliberate: what to do now, what the assistant makes of
 * the day, the shape of the whole day, the timetable itself, the windows behind it, and the
 * quantities underneath. No card repeats another's information.
 *
 * `loadDay` does the gathering  --  settings, routine, marks, advisories  --  so this page and the
 * briefing in Phase 5 are guaranteed to be judging the same day rather than each assembling
 * its own. `nowIso` is captured once here and passed to every client component that shows a
 * live time, so the first client render is byte-identical to the server's and hydration is
 * silent.
 */

import { DayRing } from "@/components/day-ring/day-ring";
import { RingLegend } from "@/components/day-ring/ring-legend";
import { AdvisoryPanel } from "@/components/today/advisory-panel";
import { DayNumbers } from "@/components/today/day-numbers";
import { LandmarkList } from "@/components/today/landmark-list";
import { NowNext } from "@/components/today/now-next";
import { ScheduleList } from "@/components/today/schedule-list";
import { WindowsCard } from "@/components/today/windows-card";
import { Card } from "@/components/ui/card";
import { loadDay } from "@/lib/assist";
import { formatClock, formatLongDate, parseISODate } from "@/lib/time";

export const metadata = {
  title: "Today",
  description: "Where you are in the day, by the sun rather than the clock.",
};

export default async function TodayPage() {
  const nowIso = new Date().toISOString();
  const view = await loadDay(new Date(nowIso));
  const { plan, day, clock24h, timeZone } = view;

  const clock = (m: number | null) => (m === null ? " -- " : formatClock(m, { hour24: clock24h }));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">
          {formatLongDate(parseISODate(view.date))}
        </h1>
        <p className="nums mt-1 text-sm text-text-3">
          {plan.place.city}, {plan.place.region} · sunrise {clock(plan.sun.sunrise)} · sunset{" "}
          {clock(plan.sun.sunset)}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <DayRing plan={plan} clock24h={clock24h} nowIso={nowIso} />
          <RingLegend clock24h={clock24h} />
        </Card>
        <div className="space-y-4">
          <NowNext plan={plan} clock24h={clock24h} nowIso={nowIso} />
          <AdvisoryPanel advisories={view.advisories} />
        </div>
      </div>

      <ScheduleList
        date={view.date}
        entries={day.entries}
        completions={view.completions}
        clock24h={clock24h}
        nowIso={nowIso}
        timeZone={timeZone}
        routineName={view.routine.name}
      />

      <DayNumbers plan={plan} clock24h={clock24h} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <LandmarkList plan={plan} clock24h={clock24h} nowIso={nowIso} />
        <WindowsCard plan={plan} clock24h={clock24h} />
      </div>
    </div>
  );
}
