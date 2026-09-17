/**
 * Insights  --  charts, heatmaps, and correlations.
 *
 * Server-rendered: reads all the historical data and renders summary stats.
 * Client-side Recharts components would be added for interactive charts.
 */

import { Card, CardHeader, Stat, StatGrid } from "@/components/ui/card";

import { renderSettings } from "@/lib/settings";
import { formatDuration } from "@/lib/time";
import { listGames } from "@/lib/games";
import { getDb, schema } from "@/lib/db";
import { desc, count, sql } from "drizzle-orm";

export const metadata = {
  title: "Insights",
  description: "Sleep vs PVT, adherence heatmap, and the three numbers that matter.",
};

export default async function InsightsPage() {
  const settings = await renderSettings();

  const db = await getDb();

  // Fetch recent day logs
  const recentLogs = await db
    .select()
    .from(schema.dayLogs)
    .orderBy(desc(schema.dayLogs.date))
    .limit(30);

  // Fetch recent PVT results
  const pvtResults = await listGames({ game: "pvt", limit: 30 });

  // Compute averages
  // Compute sleep duration from wakeMinute and previous sleepMinute
  // Simplified: use sleepQuality and sleepMinute/wakeMinute as available
  const logsWithSleep = recentLogs.filter((l) => l.sleepMinute !== null && l.wakeMinute !== null);
  const sleepDurations = logsWithSleep.map((l) => {
    // Sleep duration = next wake - sleep (sleep is the previous night)
    // Since wakeMinute is the wake time and sleepMinute is the sleep time,
    // duration is approximately (1440 - sleepMinute + wakeMinute) or (sleepMinute is past midnight already)
    const wake = l.wakeMinute!;
    const sleep = l.sleepMinute!;
    // sleepMinute > 1440 means after midnight, so duration = wakeMinute + (sleepMinute - 1440)
    return sleep > 1440 ? wake + (1440 - (sleep - 1440)) : 1440 - sleep + wake;
  });
  const avgSleep =
    sleepDurations.length > 0
      ? sleepDurations.reduce((s, d) => s + d, 0) / sleepDurations.length
      : null;

  const logsWithHr = recentLogs.filter((l) => l.restingHr !== null);
  const avgHr =
    logsWithHr.length > 0
      ? Math.round(logsWithHr.reduce((s, l) => s + (l.restingHr ?? 0), 0) / logsWithHr.length)
      : null;

  const avgPvt =
    pvtResults.length > 0
      ? Math.round(
          pvtResults.reduce((s, r) => s + (r.primaryMetric ?? 0), 0) / pvtResults.length,
        )
      : null;

  // Completion stats
  const completionRows = await db
    .select({
      total: count(),
      completed: count(
        sql`CASE WHEN ${schema.blockCompletions.status} = 'done' THEN 1 END`,
      ),
    })
    .from(schema.blockCompletions);

  const totalCompletions = completionRows[0]?.total ?? 0;
  const doneCompletions = completionRows[0]?.completed ?? 0;
  const completionRate =
    totalCompletions > 0 ? Math.round((doneCompletions / totalCompletions) * 100) : 0;

  // Hard task before noon rate
  const hardTaskLogs = recentLogs.filter((l) => l.hardTaskBeforeNoon !== null);
  const hardTaskRate =
    hardTaskLogs.length > 0
      ? Math.round(
          (hardTaskLogs.filter((l) => l.hardTaskBeforeNoon).length / hardTaskLogs.length) * 100,
        )
      : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Insights</h1>
        <p className="mt-1 text-sm text-text-3">
          Last 30 days · {recentLogs.length} day logs · {pvtResults.length} PVT sessions
        </p>
      </header>

      {/* The three numbers */}
      <Card padded>
        <CardHeader title="The three numbers" subtitle="Weekly averages that matter" />
        <StatGrid cols={3}>
          <Stat
            label="Avg sleep"
            value={avgSleep !== null ? formatDuration(avgSleep) : " -- "}
            hint={
              avgSleep !== null
                ? avgSleep >= settings.sleepTargetMinutes - 15
                  ? "On target ✓"
                  : "Below target"
                : "Log sleep to see"
            }
            tone={
              avgSleep !== null && avgSleep >= settings.sleepTargetMinutes - 15
                ? "accent"
                : "default"
            }
          />
          <Stat
            label="Avg resting HR"
            value={avgHr !== null ? `${avgHr} bpm` : " -- "}
            hint={avgHr !== null ? (avgHr <= 65 ? "Good range" : "Track the trend") : "Log HR to see"}
          />
          <Stat
            label="Avg PVT"
            value={avgPvt !== null ? `${avgPvt} ms` : " -- "}
            hint={
              avgPvt !== null
                ? avgPvt <= 250
                  ? "Well-rested range"
                  : avgPvt <= 350
                    ? "Moderate"
                    : "Possible sleep debt"
                : "Play PVT to see"
            }
          />
        </StatGrid>
      </Card>

      {/* Adherence */}
      <Card padded>
        <CardHeader title="Adherence" />
        <StatGrid cols={3}>
          <Stat
            label="Completion rate"
            value={`${completionRate}%`}
            hint={`${doneCompletions} of ${totalCompletions} blocks`}
            tone={completionRate >= 80 ? "accent" : "default"}
          />
          <Stat
            label="Hard task before noon"
            value={hardTaskRate !== null ? `${hardTaskRate}%` : " -- "}
            hint="The Pitta peak is the cognitive prime time"
          />
          <Stat
            label="Days logged"
            value={`${recentLogs.length}`}
            hint="Last 30 days"
          />
        </StatGrid>
      </Card>

      {/* PVT trend */}
      {pvtResults.length > 0 && (
        <Card padded>
          <CardHeader
            title="PVT Trend"
            subtitle={`${pvtResults.length} sessions  --  lower is better`}
          />
          <div className="flex items-end gap-1 h-28">
            {pvtResults.map((r) => {
              const maxVal = Math.max(...pvtResults.map((t) => t.primaryMetric ?? 0), 1);
              const height = ((r.primaryMetric ?? 0) / maxVal) * 100;
              const isGood = (r.primaryMetric ?? 999) <= 250;
              return (
                <div
                  key={r.id}
                  className={`flex-1 rounded-t transition-all ${
                    isGood ? "bg-ok/60 hover:bg-ok" : "bg-warn/60 hover:bg-warn"
                  }`}
                  style={{ height: `${Math.max(4, height)}%` }}
                  title={`${r.date}: ${r.primaryMetric ?? " -- "} ms`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-text-3">
            <span>{pvtResults[0]?.date}</span>
            <span>{pvtResults[pvtResults.length - 1]?.date}</span>
          </div>
        </Card>
      )}

      {/* Sleep log */}
      {logsWithSleep.length > 0 && (
        <Card padded>
          <CardHeader title="Sleep History" subtitle="Last 30 days" />
          <div className="flex items-end gap-1 h-24">
            {logsWithSleep.map((log) => {
              const logIdx = logsWithSleep.indexOf(log);
              const mins = logIdx >= 0 ? sleepDurations[logIdx] : 0;
              const target = settings.sleepTargetMinutes;
              const height = Math.min(100, (mins / (target * 1.2)) * 100);
              const met = mins >= target - 15;
              return (
                <div
                  key={log.id}
                  className={`flex-1 rounded-t transition-all ${
                    met ? "bg-accent/60 hover:bg-accent" : "bg-surface-2 hover:bg-surface-2/80"
                  }`}
                  style={{ height: `${Math.max(4, height)}%` }}
                  title={`${log.date}: ${formatDuration(mins)}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-text-3">
            <span>{logsWithSleep[logsWithSleep.length - 1]?.date}</span>
            <span>{logsWithSleep[0]?.date}</span>
          </div>
        </Card>
      )}

      {/* No data guidance */}
      {recentLogs.length === 0 && pvtResults.length === 0 && (
        <Card padded>
          <div className="py-8 text-center text-sm text-text-3">
            <p>No data yet. Insights appear as you log:</p>
            <ul className="mt-3 space-y-1 text-left mx-auto max-w-xs">
              <li>😴 Sleep hours (in day logs)</li>
              <li>❤️ Resting heart rate</li>
              <li>⚡ PVT reaction time (Mind Gym)</li>
              <li>✅ Block completions</li>
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}
