/**
 * Train  --  the training view.
 *
 * Server-rendered: looks up what sessions today's track schedules, reads the last
 * performance of each movement for the overload suggestion, and hands the whole plan
 * down as props. The logger itself is a client component.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sessionsForTrack } from "@/data/exercises";
import { renderSettings } from "@/lib/settings";
import { calendarDateInZone, toISODate } from "@/lib/time";
import {
  sessionsOnDate,
  weekInCycle,
  describeWeek,
  isDeloadWeek,
  describeSuggestion,
} from "@/lib/training";
import { planSession } from "@/lib/workouts";

export const metadata = {
  title: "Train",
  description: "Today's training session  --  logged, with load suggestions.",
};

export default async function TrainPage() {
  const settings = await renderSettings();
  const now = new Date();
  const today = calendarDateInZone(now, settings.timeZone);
  const todayISO = toISODate(today);

  const week = weekInCycle(
    settings.trackStartedOn ? { year: Number(settings.trackStartedOn.slice(0, 4)), month: Number(settings.trackStartedOn.slice(5, 7)), day: Number(settings.trackStartedOn.slice(8, 10)) } : null,
    today,
  );
  const weekLabel = describeWeek(week);
  const deload = isDeloadWeek(week);

  const todaySessions = sessionsOnDate(today, settings.activeTrack);

  // Build exercise plans with suggestions for each session
  const sessionPlans = await Promise.all(
    todaySessions.map(async (session) => ({
      session,
      exercises: await planSession(session, { isDeload: deload, before: todayISO }),
    })),
  );

  const allSessions = sessionsForTrack(settings.activeTrack);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Train</h1>
        <p className="nums mt-1 text-sm text-text-3">
          {settings.activeTrack === "gentle" ? "Gentle track" : "Hardcore track"}
          {weekLabel ? ` · ${weekLabel}` : ""}
        </p>
      </header>

      {deload && (
        <div className="card flex items-start gap-3 border-warn/30 bg-warn/5 p-4">
          <span className="mt-0.5 text-warn text-lg">⚡</span>
          <div>
            <p className="font-medium text-warn">Deload week</p>
            <p className="mt-1 text-sm text-text-2">
              Same weights, fewer sets. Volume comes down so recovery can catch up.
              Three hard weeks earned this  --  use it.
            </p>
          </div>
        </div>
      )}

      {todaySessions.length === 0 ? (
        <Card className="p-6">
          <p className="text-text-2">No session scheduled for today on this track.</p>
          <p className="mt-2 text-sm text-text-3">
            Check the timeline, or pick a session from below.
          </p>
        </Card>
      ) : (
        sessionPlans.map(({ session, exercises }) => (
          <Card key={session.slug} className="overflow-hidden">
            <div className="border-b border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-1">{session.name}</h2>
                  <p className="mt-1 text-sm text-text-3">{session.tagline}</p>
                </div>
                <Badge tone="accent">{session.durationMinutes} min</Badge>
              </div>
            </div>

            {/* Fuel guidance */}
            <div className="border-b border-line bg-surface-2/50 px-4 py-3">
              <p className="text-sm font-medium text-text-1">
                🍌 {session.fuel.headline}
              </p>
              <p className="mt-1 text-xs text-text-3">{session.fuel.why.slice(0, 140)}…</p>
            </div>

            {/* Cautions */}
            {session.cautions.length > 0 && (
              <div className="border-b border-line px-4 py-3">
                {session.cautions.map((caution, i) => (
                  <p key={i} className="text-xs text-warn flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">⚠</span>
                    <span>{caution}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Exercises */}
            <div className="divide-y divide-line">
              {exercises.map(({ exercise, suggestion, last }) => (
                <div key={exercise.slug} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-text-1">{exercise.name}</h3>
                      <p className="mt-0.5 text-xs text-text-3">{exercise.target}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-accent">
                        {describeSuggestion(suggestion)}
                      </p>
                      <p className="text-xs text-text-3">
                        {exercise.sets} × {exercise.prescription.split("×")[1]?.trim() ?? exercise.prescription}
                      </p>
                    </div>
                  </div>

                  {/* Form cue */}
                  <p className="mt-2 text-xs text-text-3 leading-relaxed italic">
                    💡 {exercise.cue}
                  </p>

                  {/* Suggestion reasoning */}
                  <p className="mt-1.5 text-xs text-text-3">
                    {suggestion.reason}
                  </p>

                  {last && (
                    <p className="mt-1 text-xs text-text-3/70">
                      Last: {last.date}  --  {last.sets.filter(s => !s.isWarmup && s.completed).length} working sets
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {/* All sessions in this track */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-3">
          All sessions · {settings.activeTrack}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {allSessions.map((session) => {
            const isToday = todaySessions.some((s) => s.slug === session.slug);
            return (
              <Card
                key={session.slug}
                className={`p-4 ${isToday ? "border-accent/30 bg-accent/5" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium text-text-1">{session.name}</h3>
                    <p className="mt-0.5 text-xs text-text-3">{session.tagline}</p>
                  </div>
                  {isToday && <Badge tone="accent">Today</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {session.exercises.map((ex) => (
                    <span
                      key={ex.slug}
                      className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-3"
                    >
                      {ex.name}
                    </span>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
