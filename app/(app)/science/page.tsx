/**
 * Science browse  --  curated evidence cards with tier filtering and search.
 */

import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { SCIENCE_CARDS, TIERS, type EvidenceTier } from "@/data/science-cards";

export const metadata = {
  title: "Science",
  description: "Evidence cards behind every practice  --  tiered honestly from Strong to Traditional-only.",
};

export default function SciencePage() {
  const byTier = (tier: EvidenceTier) => SCIENCE_CARDS.filter((c) => c.tier === tier);

  const tiers: EvidenceTier[] = ["strong", "moderate", "weak", "traditional"];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Science</h1>
        <p className="mt-1 text-sm text-text-3">
          {SCIENCE_CARDS.length} evidence cards. Every block, exercise, and practice links to its card  --  the reasoning is one tap from the action.
        </p>
      </header>

      {/* Tier legend */}
      <Card padded>
        <CardHeader title="Evidence tiers" />
        <div className="grid gap-2 sm:grid-cols-2">
          {tiers.map((tier) => {
            const info = TIERS[tier];
            return (
              <div key={tier} className="flex items-start gap-2">
                <Badge tone={info.color as "ok" | "info" | "warn" | "neutral"}>{info.label}</Badge>
                <span className="text-xs text-text-3">{info.description}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Nav links */}
      <div className="flex gap-3">
        <Link
          href="/science/search"
          className="card px-4 py-2 text-sm text-accent hover:border-accent/40 transition-colors"
        >
          🔍 Literature search
        </Link>
        <Link
          href="/science/library"
          className="card px-4 py-2 text-sm text-text-2 hover:border-accent/40 transition-colors"
        >
          📚 Saved papers
        </Link>
      </div>

      {/* Cards by tier */}
      {tiers.map((tier) => {
        const cards = byTier(tier);
        if (cards.length === 0) return null;
        const tierInfo = TIERS[tier];
        return (
          <div key={tier}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-text-3">
              <Badge tone={tierInfo.color as "ok" | "info" | "warn" | "neutral"}>{tierInfo.label}</Badge>
              <span>{cards.length} cards</span>
            </h2>
            <div className="space-y-3">
              {cards.map((card) => (
                <Link key={card.id} href={`/science/${card.id}`}>
                  <Card className="transition-all hover:border-accent/30 hover:shadow-sm" padded>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-text-1">{card.title}</h3>
                        <p className="mt-1 text-sm text-text-3">{card.headline}</p>
                      </div>
                      {card.effectSize && (
                        <span className="shrink-0 text-xs text-text-3/70">{card.effectSize}</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-3"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
