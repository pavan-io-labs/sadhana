/**
 * Science library  --  saved papers.
 */

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { getSavedPapers } from "@/lib/literature";

export const metadata = {
  title: "Library",
  description: "Saved papers from the literature search.",
};

export default async function ScienceLibraryPage() {
  const papers = await getSavedPapers(100);

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/science"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-3 hover:text-accent transition-colors"
        >
          ← Science
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Library</h1>
        <p className="mt-1 text-sm text-text-3">
          {papers.length} saved paper{papers.length !== 1 ? "s" : ""}
        </p>
      </header>

      {papers.length === 0 ? (
        <Card padded>
          <div className="py-6 text-center text-sm text-text-3">
            No papers saved yet.{" "}
            <Link href="/science/search" className="text-accent hover:underline">
              Search the literature
            </Link>{" "}
            and save papers here.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => (
            <Card key={paper.id} padded>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-text-1 leading-snug">{paper.title}</h3>
                  <p className="mt-1 text-xs text-text-3">
                    {paper.authors.slice(0, 80)}{paper.authors.length > 80 ? "…" : ""}
                    {paper.journal ? ` · ${paper.journal}` : ""}
                    {paper.year ? ` (${paper.year})` : ""}
                  </p>
                </div>
                <Badge tone={paper.evidenceType.includes("meta") || paper.evidenceType.includes("systematic") ? "ok" : "neutral"}>
                  {paper.evidenceType.replace("-", " ")}
                </Badge>
              </div>
              {paper.abstract && (
                <p className="mt-2 text-xs text-text-3 leading-relaxed line-clamp-2">{paper.abstract}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {paper.citedByCount !== null && (
                  <span className="nums text-text-3">{paper.citedByCount} citations</span>
                )}
                {paper.url && (
                  <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    Read →
                  </a>
                )}
                {paper.note && <span className="text-text-3">📝 {paper.note}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
