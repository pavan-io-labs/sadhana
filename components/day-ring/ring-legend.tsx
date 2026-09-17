/**
 * What the bands on the dial mean.
 *
 * The dosha times are derived from `DOSHA_PERIODS` rather than written out, so the legend
 * cannot drift from what the ring actually draws. A server component: none of it moves.
 */

import { Dot } from "@/components/ui/badge";
import { type Dosha, DOSHA_LABELS, DOSHA_PERIODS } from "@/lib/dosha";
import { formatClock } from "@/lib/time";

function doshaOrder(): Dosha[] {
  const seen: Dosha[] = [];
  for (const period of DOSHA_PERIODS) {
    if (!seen.includes(period.dosha)) seen.push(period.dosha);
  }
  return seen;
}

export function RingLegend({ clock24h }: { clock24h: boolean }) {
  const clock = (m: number) => formatClock(m, { hour24: clock24h, compact: true });

  return (
    <div className="mt-4 border-t border-line pt-3.5">
      <dl className="flex flex-wrap gap-x-5 gap-y-1.5">
        {doshaOrder().map((dosha) => (
          <div key={dosha} className="flex items-baseline gap-1.5">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-text-2">
              <Dot tone={dosha} />
              {DOSHA_LABELS[dosha]}
            </dt>
            <dd className="nums text-xs text-text-3">
              {DOSHA_PERIODS.filter((p) => p.dosha === dosha)
                .map((p) => `${clock(p.start)}–${clock(p.end)}`)
                .join(", ")}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-text-3">
        Outer band: the dosha period. Inside it, the traditional windows, then your sleep span,
        then the hours of daylight. The hand is now.
      </p>
    </div>
  );
}
