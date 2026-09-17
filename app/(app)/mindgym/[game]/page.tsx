/**
 * /mindgym/[game]  --  individual game page with history and trend.
 *
 * Server-rendered: loads the game's history, computes trend data, and
 * renders the results list. The actual game UI would be a client component.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gameTrend, listGames, type GameId } from "@/lib/games";

const GAME_META: Record<
  string,
  {
    name: string;
    icon: string;
    description: string;
    instructions: string[];
    primaryLabel: string;
    unit: string;
  }
> = {
  pvt: {
    name: "Psychomotor Vigilance Task",
    icon: "⚡",
    description:
      "A 3-minute reaction-time test. When the counter appears, tap as fast as you can. Measures sustained attention and sleep debt.",
    instructions: [
      "Wait for the red counter to appear  --  it will start at a random interval (2–10 seconds).",
      "Tap or press Space the instant you see the number start counting.",
      "Reactions over 500ms count as lapses. False starts (before the counter) are recorded separately.",
      "Run at the same time each day (ideally right after waking) for meaningful trends.",
    ],
    primaryLabel: "Median RT",
    unit: "ms",
  },
  stroop: {
    name: "Stroop Task",
    icon: "🎨",
    description:
      "Name the colour of the ink, not the word. The interference between reading and colour naming measures inhibitory control.",
    instructions: [
      "A colour word appears in a coloured font. Name the COLOUR of the font, not the word itself.",
      "Press the key matching the font colour (R=Red, G=Green, B=Blue, Y=Yellow).",
      "Some trials are congruent (word matches colour), others incongruent. The gap in RT is your interference cost.",
      "Speed and accuracy both matter.",
    ],
    primaryLabel: "Interference",
    unit: "ms",
  },
  nback: {
    name: "Dual N-Back",
    icon: "🧠",
    description:
      "Track both position and sound N steps back simultaneously. Adaptive: the level increases when you are accurate, decreases when you struggle.",
    instructions: [
      "A square appears in one of 9 positions while a letter is spoken.",
      "Press A if the position matches N steps back. Press L if the sound matches N steps back.",
      "The N level adapts to your performance. Higher d-prime = better signal detection.",
      "Note: near-transfer is real; far-transfer to general intelligence is contested.",
    ],
    primaryLabel: "d′",
    unit: "",
  },
  gonogo: {
    name: "Go / No-Go",
    icon: "🚦",
    description:
      "Respond to go stimuli, withhold on no-go stimuli. Measures response inhibition  --  the ability to stop a prepotent response.",
    instructions: [
      "Green = Go (press Space). Red = No-Go (do nothing).",
      "Most trials are Go, making the No-Go harder  --  you must override the habit.",
      "Commission errors (responding to No-Go) are the key metric.",
      "Try to be both fast and accurate.",
    ],
    primaryLabel: "Commissions",
    unit: "",
  },
  "digit-span": {
    name: "Digit Span",
    icon: "🔢",
    description:
      "Remember and repeat sequences of digits  --  forward (as heard) and backward (reversed). Measures verbal working memory capacity.",
    instructions: [
      "A sequence of digits is shown one at a time.",
      "Forward: type them back in the same order.",
      "Backward: type them back in reverse order.",
      "The sequence gets longer until you make two errors at the same length.",
    ],
    primaryLabel: "Max span",
    unit: "",
  },
  corsi: {
    name: "Corsi Block-Tapping",
    icon: "🟦",
    description:
      "Remember the order in which blocks light up, then tap them back. The visuospatial equivalent of digit span.",
    instructions: [
      "Nine blocks are arranged irregularly. Some will flash in sequence.",
      "After the sequence finishes, tap the blocks in the same order.",
      "The sequence gets longer until you make two errors at the same length.",
      "Average span is 5–7; trained individuals reach 8–9.",
    ],
    primaryLabel: "Max span",
    unit: "",
  },
  insight: {
    name: "Insight & Reframe",
    icon: "💡",
    description:
      "Insight problem-solving and cognitive reappraisal. A different kind of cognitive exercise  --  creative rather than reactive.",
    instructions: [
      "You are presented with a problem that requires an insight (aha!) rather than deliberate reasoning.",
      "Take your time. There is no speed pressure.",
      "After solving (or giving up), you may journal a reframe of the problem in your own terms.",
      "Solve time is tracked, but the value here is the practice, not the score.",
    ],
    primaryLabel: "Solve time",
    unit: "s",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const meta = GAME_META[game];
  if (!meta) return { title: "Mind Gym" };
  return {
    title: `${meta.name}  --  Mind Gym`,
    description: meta.description,
  };
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const meta = GAME_META[game];
  if (!meta) notFound();

  const gameId = game as GameId;
  const [trend, recent] = await Promise.all([
    gameTrend(gameId, 30),
    listGames({ game: gameId, limit: 10 }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/mindgym"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-3 hover:text-accent transition-colors"
        >
          ← Mind Gym
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-1">{meta.name}</h1>
            <p className="mt-0.5 text-sm text-text-3">{meta.description}</p>
          </div>
        </div>
      </header>

      {/* Instructions */}
      <Card padded>
        <CardHeader title="How to play" />
        <ol className="space-y-2">
          {meta.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-text-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Trend summary */}
      {trend.length > 0 && (
        <Card padded>
          <CardHeader title="Trend" subtitle={`Last ${trend.length} sessions`} />
          <div className="flex items-end gap-1 h-24">
            {trend.map((r) => {
              const maxVal = Math.max(...trend.map((t) => t.primaryMetric ?? 0), 1);
              const height = ((r.primaryMetric ?? 0) / maxVal) * 100;
              return (
                <div
                  key={r.id}
                  className="flex-1 rounded-t bg-accent/60 transition-all hover:bg-accent"
                  style={{ height: `${Math.max(4, height)}%` }}
                  title={`${r.date}: ${r.primaryMetric ?? " -- "} ${meta.unit}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-text-3">
            <span>{trend[0]?.date}</span>
            <span>{trend[trend.length - 1]?.date}</span>
          </div>
        </Card>
      )}

      {/* Recent results */}
      <Card padded={false}>
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-3">
            Recent results
          </h2>
        </div>
        {recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-3">
            No results yet. Play your first session above.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 sm:px-5">
                <div>
                  <p className="nums text-sm text-text-1">{r.date}</p>
                  <p className="nums text-xs text-text-3">
                    {r.durationSeconds > 0 ? `${Math.round(r.durationSeconds / 60)}m` : " -- "}
                    {r.isPractice ? " · practice" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="nums text-lg font-bold text-text-1">
                    {r.primaryMetric !== null
                      ? `${r.primaryMetric}${meta.unit ? ` ${meta.unit}` : ""}`
                      : " -- "}
                  </span>
                  {r.isPractice && (
                    <Badge tone="neutral" className="ml-2 text-[10px]">Practice</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
