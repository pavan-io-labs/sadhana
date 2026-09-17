/**
 * Practice  --  meditation, pranayama, nidra, abhyanga.
 *
 * Server-rendered summary of today's practice sessions, with client-side timers
 * and loggers for each practice type.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { renderSettings } from "@/lib/settings";
import { calendarDateInZone, toISODate, formatDuration } from "@/lib/time";
import { practiceOn, practiceTotalSeconds } from "@/lib/practice";

export const metadata = {
  title: "Practice",
  description: "Meditation, pranayama, yoga nidra, and abhyanga  --  with timers and contraindication gates.",
};

/** Practices the user can log, with their metadata. */
const PRACTICES = [
  {
    slug: "meditation",
    kind: "meditation" as const,
    name: "Meditation",
    icon: "🧘",
    description: "Seated mindfulness. Set a timer, sit, and come back when it rings.",
    defaultDuration: 600,
    requiresEmptyStomach: false,
    contraindications: [] as string[],
  },
  {
    slug: "nadi-shodhana",
    kind: "pranayama" as const,
    name: "Nadi Shodhana",
    icon: "🌬️",
    description: "Alternate-nostril breathing. Calming, balancing  --  safe on a full stomach.",
    defaultDuration: 300,
    requiresEmptyStomach: false,
    contraindications: [],
  },
  {
    slug: "bhramari",
    kind: "pranayama" as const,
    name: "Bhramari",
    icon: "🐝",
    description: "Humming bee breath. Calms the nervous system; safe anytime.",
    defaultDuration: 300,
    requiresEmptyStomach: false,
    contraindications: [],
  },
  {
    slug: "kapalabhati",
    kind: "pranayama" as const,
    name: "Kapalabhati",
    icon: "🔥",
    description: "Skull-shining breath. Forceful exhalation  --  empty stomach required.",
    defaultDuration: 300,
    requiresEmptyStomach: true,
    contraindications: [
      "Not on a full stomach  --  wait at least three hours after a meal.",
      "Avoid if pregnant, menstruating heavily, or with uncontrolled hypertension.",
      "Stop if dizzy or lightheaded  --  forceful breathing is not something to push through.",
    ],
  },
  {
    slug: "bhastrika",
    kind: "pranayama" as const,
    name: "Bhastrika",
    icon: "💨",
    description: "Bellows breath. Energising and heating  --  empty stomach required.",
    defaultDuration: 300,
    requiresEmptyStomach: true,
    contraindications: [
      "Not on a full stomach  --  wait at least three hours after a meal.",
      "Avoid if pregnant, epileptic, or with heart conditions.",
      "Start with fewer rounds if new. Hyperventilation is not the goal.",
    ],
  },
  {
    slug: "box-breathing",
    kind: "pranayama" as const,
    name: "Box Breathing",
    icon: "⬜",
    description: "4–4–4–4: inhale, hold, exhale, hold. Used by everyone from meditators to soldiers.",
    defaultDuration: 300,
    requiresEmptyStomach: false,
    contraindications: [],
  },
  {
    slug: "478-breathing",
    kind: "pranayama" as const,
    name: "4-7-8 Breathing",
    icon: "🌙",
    description: "Inhale 4, hold 7, exhale 8. A wind-down practice for before sleep.",
    defaultDuration: 300,
    requiresEmptyStomach: false,
    contraindications: [],
  },
  {
    slug: "yoga-nidra",
    kind: "nidra" as const,
    name: "Yoga Nidra / NSDR",
    icon: "😴",
    description: "Non-sleep deep rest. Lie down and follow the guidance  --  20 to 45 minutes.",
    defaultDuration: 1200,
    requiresEmptyStomach: false,
    contraindications: [],
  },
  {
    slug: "abhyanga",
    kind: "abhyanga" as const,
    name: "Abhyanga",
    icon: "🫧",
    description: "Self-massage with warm oil before bathing. The tradition's daily luxury.",
    defaultDuration: 900,
    requiresEmptyStomach: false,
    contraindications: [
      "Skip if you have a fever, acute illness, or indigestion.",
      "Caution during menstruation  --  tradition advises avoiding; modern practice is personal.",
      "Use sesame or coconut oil  --  not mineral oil. Warm, not hot.",
    ],
  },
] as const;

export default async function PracticePage() {
  const settings = await renderSettings();
  const now = new Date();
  const today = calendarDateInZone(now, settings.timeZone);
  const todayISO = toISODate(today);

  const sessions = await practiceOn(todayISO);
  const totalSeconds = await practiceTotalSeconds(todayISO);

  const totalMinutes = Math.round(totalSeconds / 60);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Practice</h1>
        <p className="nums mt-1 text-sm text-text-3">
          {sessions.length === 0
            ? "No practice logged today"
            : `${sessions.length} session${sessions.length > 1 ? "s" : ""} · ${formatDuration(totalMinutes)} today`}
        </p>
      </header>

      {/* Today's logged sessions */}
      {sessions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-text-1">Today&apos;s sessions</h2>
          </div>
          <div className="divide-y divide-line">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-1">
                    {session.practiceSlug || session.kind}
                  </p>
                  <p className="nums text-xs text-text-3">
                    {formatDuration(Math.round(session.durationSeconds / 60))}
                    {session.rounds ? ` · ${session.rounds} rounds` : ""}
                  </p>
                </div>
                <Badge tone={session.kind === "pranayama" ? "accent" : "neutral"}>
                  {session.kind}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Practice cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-3">
          Practices
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {PRACTICES.map((practice) => (
            <Card key={practice.slug} className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{practice.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-1">{practice.name}</h3>
                    {practice.requiresEmptyStomach && (
                      <Badge tone="warn" className="text-[10px]">
                        Empty stomach
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-3 leading-relaxed">
                    {practice.description}
                  </p>
                  {practice.contraindications.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {practice.contraindications.map((c, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-[11px] text-warn/80">
                          <span className="mt-0.5 shrink-0">⚠</span>
                          <span>{c}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
