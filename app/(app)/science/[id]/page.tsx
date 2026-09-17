/**
 * /science/[id]  --  individual evidence card detail page.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { findCard, TIERS } from "@/data/science-cards";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = findCard(id);
  if (!card) return { title: "Science" };
  return { title: `${card.title}  --  Science`, description: card.headline };
}

export default async function ScienceCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = findCard(id);
  if (!card) notFound();

  const tierInfo = TIERS[card.tier];

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/science"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-3 hover:text-accent transition-colors"
        >
          ← Science
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-text-1">{card.title}</h1>
          <Badge tone={tierInfo.color as "ok" | "info" | "warn" | "neutral"}>
            {tierInfo.label}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-text-2">{card.headline}</p>
      </header>

      {/* Body */}
      <Card padded>
        <p className="text-sm text-text-2 leading-relaxed">{card.body}</p>
      </Card>

      {/* Effect size */}
      {card.effectSize && (
        <Card padded>
          <CardHeader title="Effect size" />
          <p className="nums text-sm text-text-1">{card.effectSize}</p>
        </Card>
      )}

      {/* Citations */}
      <Card padded>
        <CardHeader title="Citations" />
        <ul className="space-y-1">
          {card.citations.map((citation, i) => (
            <li key={i} className="text-sm text-text-2">
              {citation}
            </li>
          ))}
        </ul>
      </Card>

      {/* Tags and links */}
      <div className="flex flex-wrap gap-2">
        {card.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-surface-2 px-2 py-1 text-xs text-text-3"
          >
            {tag}
          </span>
        ))}
      </div>

      {card.linkedTo.length > 0 && (
        <Card padded>
          <CardHeader title="Linked to" />
          <div className="flex flex-wrap gap-2">
            {card.linkedTo.map((slug) => (
              <Badge key={slug} tone="accent">
                {slug}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
