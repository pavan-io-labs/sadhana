/**
 * Mind Gym  --  the hub page.
 *
 * Shows all six cognitive games with their latest scores and quick descriptions.
 * Links to individual game pages. The PVT is highlighted as the keystone measure.
 */

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { latestResult } from "@/lib/games";

export const metadata = {
  title: "Mind Gym",
  description: "Six measured cognitive modules  --  PVT, Stroop, N-Back, Go/No-Go, Span, and Insight.",
};

type GameCard = {
  id: string;
  name: string;
  icon: string;
  measures: string;
  reports: string;
  primary: string;
  unit: string;
  lowerIsBetter: boolean;
  note?: string;
};

const GAMES: GameCard[] = [
  {
    id: "pvt",
    name: "PVT",
    icon: "⚡",
    measures: "Vigilance / sleep debt",
    reports: "Median RT, lapses > 500ms, slowest 10%",
    primary: "Median RT",
    unit: "ms",
    lowerIsBetter: true,
    note: "The gold standard  --  run at wake, it turns the routine into a measurable experiment.",
  },
  {
    id: "stroop",
    name: "Stroop",
    icon: "🎨",
    measures: "Inhibitory control",
    reports: "Interference cost, accuracy",
    primary: "Interference",
    unit: "ms",
    lowerIsBetter: true,
  },
  {
    id: "nback",
    name: "Dual N-Back",
    icon: "🧠",
    measures: "Working memory",
    reports: "d-prime, level reached",
    primary: "d′",
    unit: "",
    lowerIsBetter: false,
    note: "Near-transfer is real; far-transfer to general intelligence is contested.",
  },
  {
    id: "gonogo",
    name: "Go / No-Go",
    icon: "🚦",
    measures: "Response inhibition",
    reports: "Commission vs omission errors, RT",
    primary: "Commissions",
    unit: "",
    lowerIsBetter: true,
  },
  {
    id: "digit-span",
    name: "Digit Span",
    icon: "🔢",
    measures: "Verbal working memory",
    reports: "Max span (fwd & bwd)",
    primary: "Max span",
    unit: "",
    lowerIsBetter: false,
  },
  {
    id: "corsi",
    name: "Corsi Blocks",
    icon: "🟦",
    measures: "Visuospatial working memory",
    reports: "Max spatial span",
    primary: "Max span",
    unit: "",
    lowerIsBetter: false,
  },
];

export default async function MindGymPage() {
  // Fetch latest result for each game in parallel
  const latestResults = await Promise.all(
    GAMES.map(async (game) => ({
      game,
      latest: await latestResult(game.id as Parameters<typeof latestResult>[0]),
    })),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Mind Gym</h1>
        <p className="mt-1 text-sm text-text-3">
          Six measured modules. Scores mean something  --  each tracks a specific cognitive domain.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {latestResults.map(({ game, latest }) => (
          <Link key={game.id} href={`/mindgym/${game.id}`} className="group">
            <Card className="h-full transition-all duration-200 group-hover:border-accent/40 group-hover:shadow-md" padded={false}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{game.icon}</span>
                    <div>
                      <h2 className="font-semibold text-text-1 group-hover:text-accent transition-colors">
                        {game.name}
                      </h2>
                      <p className="text-xs text-text-3">{game.measures}</p>
                    </div>
                  </div>
                  {game.id === "pvt" && (
                    <Badge tone="accent" className="text-[10px]">Keystone</Badge>
                  )}
                </div>

                <p className="mt-3 text-xs text-text-3 leading-relaxed">
                  {game.reports}
                </p>

                {game.note && (
                  <p className="mt-2 text-[11px] text-text-3/70 italic leading-relaxed">
                    {game.note}
                  </p>
                )}

                {/* Latest score */}
                <div className="mt-3 flex items-baseline gap-2 border-t border-line pt-3">
                  <span className="text-xs text-text-3">{game.primary}:</span>
                  {latest ? (
                    <span className="nums text-lg font-bold text-text-1">
                      {latest.primaryMetric !== null
                        ? `${latest.primaryMetric}${game.unit ? ` ${game.unit}` : ""}`
                        : " -- "}
                    </span>
                  ) : (
                    <span className="text-sm text-text-3/50">No data yet</span>
                  )}
                  {latest && (
                    <span className="text-[10px] text-text-3 ml-auto">
                      {latest.date}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* All accessible note */}
      <Card padded>
        <p className="text-xs text-text-3 leading-relaxed">
          All games are keyboard-operable with <code className="text-text-2">aria-live</code> feedback.
          Practice trials are stored but excluded from trends  --  warm up without
          dragging down your real scores.
        </p>
      </Card>
    </div>
  );
}
