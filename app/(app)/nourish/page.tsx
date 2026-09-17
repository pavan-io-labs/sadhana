/**
 * Nourish  --  meals, caffeine, hydration.
 *
 * Server-rendered: reads the day's meals, caffeine doses, and hydration, computes
 * the dinner→bed gap and caffeine cutoff, then renders the gauges and loggers.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { renderSettings, dayInputFromSettings } from "@/lib/settings";
import { buildDayPlan } from "@/lib/day";
import { calendarDateInZone, toISODate, formatClock, formatDuration } from "@/lib/time";
import { nourishOn } from "@/lib/nourish";

export const metadata = {
  title: "Nourish",
  description: "Meals, caffeine, and hydration  --  timing is the thing being tracked.",
};

export default async function NourishPage() {
  const settings = await renderSettings();
  const now = new Date();
  const today = calendarDateInZone(now, settings.timeZone);
  const todayISO = toISODate(today);

  const dayInput = dayInputFromSettings(settings);
  const plan = buildDayPlan(today, dayInput);
  const nourish = await nourishOn(todayISO);
  const clock24h = settings.clock24h;

  const clock = (m: number | null) => (m === null ? " -- " : formatClock(m, { hour24: clock24h }));

  // Caffeine cutoff from the day plan
  const bedtimeMinute = plan.personal.bedtime;
  const caffeineCutoff = plan.personal.caffeineCutoff;

  // Last food time and dinner→bed gap
  const allFoodMinutes = nourish.meals.map((m) => m.atMinute);
  const lastFoodMinute = allFoodMinutes.length > 0 ? Math.max(...allFoodMinutes) : null;
  const dinnerGap =
    lastFoodMinute !== null && bedtimeMinute !== null
      ? bedtimeMinute - lastFoodMinute
      : null;

  // Caffeine status
  const lastCaffeineMinute =
    nourish.caffeine.length > 0
      ? Math.max(...nourish.caffeine.map((c) => c.atMinute))
      : null;

  type CaffeineStatus = "safe" | "marginal" | "too-late" | "unknown";
  let caffeineStatus: CaffeineStatus = "unknown";
  if (caffeineCutoff !== null && lastCaffeineMinute !== null) {
    if (lastCaffeineMinute <= caffeineCutoff - 60) caffeineStatus = "safe";
    else if (lastCaffeineMinute <= caffeineCutoff) caffeineStatus = "marginal";
    else caffeineStatus = "too-late";
  }

  // Hydration
  const waterMl = nourish.hydration?.milliliters ?? 0;

  // Total caffeine mg today
  const totalCaffeineMg = nourish.caffeine.reduce((sum, c) => sum + c.milligrams, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Nourish</h1>
        <p className="nums mt-1 text-sm text-text-3">
          {nourish.meals.length} meal{nourish.meals.length !== 1 ? "s" : ""} logged
          {" · "}
          {totalCaffeineMg > 0 ? `${totalCaffeineMg} mg caffeine` : "no caffeine"}
          {" · "}
          {waterMl > 0 ? `${waterMl} ml water` : "no water logged"}
        </p>
      </header>

      {/* Key gauges */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Dinner→bed gap gauge */}
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Dinner → bed gap
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`nums text-2xl font-bold ${
                dinnerGap === null
                  ? "text-text-3"
                  : dinnerGap >= settings.dinnerGapTargetMinutes
                    ? "text-ok"
                    : dinnerGap >= settings.dinnerGapTargetMinutes * 0.67
                      ? "text-warn"
                      : "text-danger"
              }`}
            >
              {dinnerGap !== null ? formatDuration(dinnerGap) : " -- "}
            </span>
            {dinnerGap !== null && (
              <span className="text-xs text-text-3">
                of {formatDuration(settings.dinnerGapTargetMinutes)} target
              </span>
            )}
          </div>
          {lastFoodMinute !== null && (
            <p className="mt-1 text-xs text-text-3">
              Last food at {clock(lastFoodMinute)} · bed at {clock(bedtimeMinute)}
            </p>
          )}
        </Card>

        {/* Caffeine cutoff */}
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Caffeine cutoff
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="nums text-2xl font-bold text-text-1">
              {caffeineCutoff !== null ? clock(caffeineCutoff) : " -- "}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {caffeineStatus !== "unknown" && (
              <Badge
                tone={
                  caffeineStatus === "safe"
                    ? "ok"
                    : caffeineStatus === "marginal"
                      ? "warn"
                      : "danger"
                }
              >
                {caffeineStatus === "safe"
                  ? "✓ safe"
                  : caffeineStatus === "marginal"
                    ? "borderline"
                    : "past cutoff"}
              </Badge>
            )}
            {lastCaffeineMinute !== null && (
              <span className="text-xs text-text-3">
                last at {clock(lastCaffeineMinute)}
              </span>
            )}
          </div>
        </Card>

        {/* Hydration */}
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Water
          </h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="nums text-2xl font-bold text-info">
              {waterMl > 0 ? `${waterMl}` : "0"}
            </span>
            <span className="text-sm text-text-3">ml</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-info transition-all duration-500"
              style={{ width: `${Math.min(100, (waterMl / 2500) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-text-3">
            {Math.round((waterMl / 2500) * 100)}% of 2.5 L target
          </p>
        </Card>
      </div>

      {/* Meals */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-text-1">Meals</h2>
        </div>
        {nourish.meals.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-3">
            No meals logged today. The eating window starts with your first one.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {nourish.meals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize text-text-1">{meal.kind}</p>
                  <p className="nums text-xs text-text-3">
                    {clock(meal.atMinute)}
                    {meal.notes ? ` · ${meal.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Size dots */}
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`inline-block h-2 w-2 rounded-full ${
                          i < meal.size ? "bg-accent" : "bg-surface-2"
                        }`}
                      />
                    ))}
                  </div>
                  {meal.kind === "lunch" && meal.size >= 4 && (
                    <Badge tone="accent" className="text-[10px]">Main meal</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Caffeine log */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-text-1">Caffeine</h2>
        </div>
        {nourish.caffeine.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-3">
            No caffeine logged today.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {nourish.caffeine.map((dose) => (
              <div key={dose.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm capitalize text-text-1">{dose.source}</p>
                  <p className="nums text-xs text-text-3">{clock(dose.atMinute)}</p>
                </div>
                <span className="nums text-sm font-medium text-text-2">{dose.milligrams} mg</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Eating window info */}
      {nourish.meals.length >= 2 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-3">
            Eating window
          </h3>
          <div className="mt-2">
            {(() => {
              const first = Math.min(...nourish.meals.map((m) => m.atMinute));
              const last = Math.max(...nourish.meals.map((m) => m.atMinute));
              const windowMinutes = last - first;
              return (
                <>
                  <p className="nums text-sm text-text-1">
                    {clock(first)} → {clock(last)} · {formatDuration(windowMinutes)}
                  </p>
                  {/* Window bar */}
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-surface-2 relative">
                    <div
                      className="absolute h-full rounded-full bg-accent/30"
                      style={{
                        left: `${(first / 1440) * 100}%`,
                        width: `${(windowMinutes / 1440) * 100}%`,
                      }}
                    />
                    {nourish.meals.map((meal) => (
                      <div
                        key={meal.id}
                        className="absolute top-0 h-full w-1 rounded-full bg-accent"
                        style={{ left: `${(meal.atMinute / 1440) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-text-3">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>24:00</span>
                  </div>
                </>
              );
            })()}
          </div>
        </Card>
      )}
    </div>
  );
}
