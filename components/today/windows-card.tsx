/**
 * The traditional windows, with their arithmetic shown.
 *
 * A server component: these move with the date, not with the minute, so there is nothing
 * for the client to keep current  --  `NowNext` is what says whether you are inside one.
 *
 * The descriptions separate what the tradition holds from what the evidence supports. Where
 * the two happen to agree  --  Abhijit Muhurta landing inside the midday cognitive peak  --  it is
 * said plainly and not overstated, and the full evidence cards arrive in a later phase.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import type { DayPlan } from "@/lib/day";
import type { Window } from "@/lib/muhurta";
import { formatClock, formatDuration } from "@/lib/time";

type Row = { id: string; label: string; window: Window; note: string };

function rowsOf(plan: DayPlan): Row[] {
  const out: Row[] = [];
  const add = (id: string, label: string, window: Window | null, note: string) => {
    if (window) out.push({ id, label, window, note });
  };

  add(
    "brahma",
    "Brahma Muhurta",
    plan.muhurta.brahma,
    "The 14th muhurta of the night. The classical window for waking, meditation and study  --  held to be when the mind is least agitated.",
  );
  add(
    "pratah",
    "Pratah Sandhya",
    plan.muhurta.pratahSandhya,
    "The dawn junction: the last 48 minutes before sunrise. The realistic target when Brahma Muhurta is out of reach, and still ahead of the cortisol rise.",
  );
  add(
    "abhijit",
    "Abhijit Muhurta",
    plan.muhurta.abhijit,
    "Solar noon give or take 24 minutes. Traditionally auspicious for beginning things, and it does fall inside the midday peak in both digestion and sustained attention.",
  );
  add(
    "sayam",
    "Sayam Sandhya",
    plan.muhurta.sayamSandhya,
    "The dusk junction, from sunset. For stillness and light food  --  not exertion, and not the main meal of the day.",
  );

  return out;
}

export function WindowsCard({ plan, clock24h }: { plan: DayPlan; clock24h: boolean }) {
  const rows = rowsOf(plan);
  const clock = (m: number) => formatClock(m, { hour24: clock24h });
  const { mode, nightMuhurtaMinutes, dayMuhurtaMinutes } = plan.muhurta;

  const modeNote =
    mode === "fixed"
      ? "Fixed mode: one muhurta is 48 minutes, which is what a printed panchang uses."
      : `Proportional mode: the night divided by 15 gives ${formatDuration(
          nightMuhurtaMinutes,
        )}, the day ${formatDuration(dayMuhurtaMinutes)}.`;

  return (
    <Card>
      <CardHeader
        title="Traditional windows"
        subtitle={modeNote}
        aside={<Badge tone="neutral">{mode === "fixed" ? "Fixed" : "Proportional"}</Badge>}
      />
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li key={row.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium text-text-1">{row.label}</p>
              <p className="nums text-sm text-text-2">
                {clock(row.window.start)} – {clock(row.window.end)}
                <span className="text-text-3">
                  {" · "}
                  {formatDuration(row.window.end - row.window.start)}
                </span>
              </p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-text-3">{row.note}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
