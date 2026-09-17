/**
 * Briefing page  --  morning and evening composed prose.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { renderSettings, dayInputFromSettings } from "@/lib/settings";
import { buildDayPlan } from "@/lib/day";
import { calendarDateInZone, toISODate, minuteOfDayInZone } from "@/lib/time";
import { composeMorningBriefing, composeEveningBriefing } from "@/lib/briefing";
import { sessionsOnDate, weekInCycle, isDeloadWeek } from "@/lib/training";

export const metadata = {
  title: "Briefing",
  description: "The day's briefing  --  morning anchors and evening review.",
};

export default async function BriefingPage() {
  const settings = await renderSettings();
  const now = new Date();
  const today = calendarDateInZone(now, settings.timeZone);
  const todayISO = toISODate(today);
  const nowMinute = minuteOfDayInZone(now, settings.timeZone);
  const dayInput = dayInputFromSettings(settings);
  const plan = buildDayPlan(today, dayInput);

  const week = weekInCycle(
    settings.trackStartedOn ? { year: Number(settings.trackStartedOn.slice(0, 4)), month: Number(settings.trackStartedOn.slice(5, 7)), day: Number(settings.trackStartedOn.slice(8, 10)) } : null,
    today,
  );
  const deload = isDeloadWeek(week);
  const sessions = sessionsOnDate(today, settings.activeTrack);

  const briefingInput = {
    plan,
    clock24h: settings.clock24h,
    activeTrack: settings.activeTrack,
    sessionNames: sessions.map((s) => s.name),
    isDeload: deload,
    completedBlocks: 0,
    totalBlocks: 0,
    sleepMinutes: null,
    restingHr: null,
    pvtMedianRt: null,
    caffeineMg: 0,
    lastFoodMinute: null,
    waterMl: 0,
  };

  const isEvening = nowMinute > plan.personal.bedtime - 120;
  const morning = composeMorningBriefing(briefingInput);
  const evening = isEvening ? composeEveningBriefing(briefingInput) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Briefing</h1>
        <p className="nums mt-1 text-sm text-text-3">{todayISO}</p>
      </header>

      {/* Morning briefing */}
      <Card padded>
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🌅</span>
          <h2 className="font-semibold text-text-1">Morning</h2>
          <Badge tone="accent">Today</Badge>
        </div>
        <div className="space-y-4">
          {morning.sections.map((section, i) => (
            <div key={i}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
                {section.heading}
              </h3>
              <p className="mt-1 text-sm text-text-2 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Evening briefing */}
      {evening ? (
        <Card padded>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-lg">🌙</span>
            <h2 className="font-semibold text-text-1">Evening Review</h2>
          </div>
          <div className="space-y-4">
            {evening.sections.map((section, i) => (
              <div key={i}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
                  {section.heading}
                </h3>
                <p className="mt-1 text-sm text-text-2 leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card padded className="border-line/50">
          <div className="flex items-center gap-2 text-text-3">
            <span className="text-lg">🌙</span>
            <p className="text-sm">Evening review appears 2 hours before bedtime.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
