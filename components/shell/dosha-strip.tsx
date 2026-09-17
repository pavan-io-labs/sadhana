"use client";

/**
 * The live dosha readout in the shell.
 *
 * `nowIso` is the server's clock reading, used until the client's own interval starts, so
 * the markup hydrates against itself. Without it the countdown would differ between the
 * two renders by however long the request took.
 */

import { useLiveDate } from "@/components/hooks";
import { Dot } from "@/components/ui/badge";
import { doshaAt, doshaProgress, nextDoshaChange } from "@/lib/dosha";
import { formatClock, formatDuration, minuteOfDayInZone, wrapMinute } from "@/lib/time";

export function DoshaStrip({
  timeZone,
  clock24h,
  nowIso,
  compact = false,
}: {
  timeZone: string;
  clock24h: boolean;
  nowIso: string;
  compact?: boolean;
}) {
  const minute = minuteOfDayInZone(useLiveDate(nowIso), timeZone);

  const period = doshaAt(minute);
  const { inMinutes, next } = nextDoshaChange(minute);
  const progress = doshaProgress(minute);
  const endsAt = wrapMinute(minute + inMinutes);

  return (
    <div className={compact ? "flex items-center gap-2" : ""}>
      <p className="flex items-center gap-2 text-xs font-medium text-text-2">
        <Dot tone={period.dosha} />
        <span className="truncate">{period.label}</span>
      </p>

      {compact ? (
        <span className="nums text-xs text-text-3">{formatDuration(inMinutes)} left</span>
      ) : (
        <>
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={`Progress through ${period.label}`}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${Math.max(2, progress * 100)}%` }}
            />
          </div>
          <p className="nums mt-1.5 text-xs text-text-3">
            {formatDuration(inMinutes)} left · {next.label.split("  --  ")[0]} at{" "}
            {formatClock(endsAt, { hour24: clock24h })}
          </p>
        </>
      )}
    </div>
  );
}
