/**
 * The figures on Today that are quantities rather than times  --  the ones worth comparing
 * against yesterday, and the ones that make the times above explicable.
 */

import { Card, CardHeader, Stat, StatGrid } from "@/components/ui/card";
import type { DayPlan } from "@/lib/day";
import { formatClock, formatDuration, formatSignedDuration } from "@/lib/time";

export function DayNumbers({ plan, clock24h }: { plan: DayPlan; clock24h: boolean }) {
  const { sun, personal } = plan;
  const caffeineHours = (personal.bedtime - personal.caffeineCutoff) / 60;

  return (
    <Card>
      <CardHeader
        title="The numbers"
        subtitle={`${plan.place.latitude.toFixed(3)}°, ${plan.place.longitude.toFixed(3)}° · ${plan.timeZone}`}
      />
      <StatGrid cols={4}>
        <Stat
          label="Day length"
          value={sun.dayLength === null ? " -- " : formatDuration(sun.dayLength)}
          hint="Sunrise to sunset"
        />
        <Stat
          label="Sleep target"
          value={formatDuration(personal.sleepTargetMinutes)}
          hint="Lights out to wake"
        />
        <Stat
          label="Caffeine by"
          value={formatClock(personal.caffeineCutoff, { hour24: clock24h })}
          hint={`${caffeineHours.toFixed(1)} h before lights out`}
          tone="accent"
        />
        <Stat
          label="Wake offset"
          value={formatSignedDuration(personal.wakeOffsetMinutes)}
          hint="Relative to sunrise"
        />
      </StatGrid>

      {sun.polar || sun.estimated ? (
        <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed text-text-2">
          {sun.polar
            ? "At this latitude the sun does not both rise and set on this date."
            : "Sunrise could not be computed for this date and latitude."}{" "}
          Your wake and lights-out times below are estimated from civil twilight or solar
          noon instead, and are marked as such rather than presented as a real sunrise.
        </p>
      ) : null}
    </Card>
  );
}
