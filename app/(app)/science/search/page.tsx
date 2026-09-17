/**
 * Science search  --  live literature search through the server proxy.
 */

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type LitResult = {
  source: string;
  doi: string | null;
  title: string;
  authors: string;
  journal: string;
  year: number | null;
  abstract: string;
  url: string;
  evidenceType: string;
  isOpenAccess: boolean;
  citedByCount: number | null;
};

const EVIDENCE_TONES: Record<string, "ok" | "info" | "warn" | "neutral" | "accent"> = {
  "meta-analysis": "ok",
  "systematic-review": "ok",
  rct: "info",
  "clinical-trial": "info",
  review: "warn",
  other: "neutral",
};

export default function ScienceSearchPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [results, setResults] = useState<LitResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "20" });
      if (filter) params.set("filter", filter);
      const resp = await fetch(`/api/literature/search?${params}`);
      const data = await resp.json();
      if (data.ok) {
        setResults(data.data.results);
      } else {
        setError(data.error ?? "Search failed");
      }
    } catch {
      setError("Network error  --  check your connection");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  async function handleSave(result: LitResult) {
    try {
      await fetch("/api/literature/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
    } catch {
      // silent fail
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/science"
          className="mb-2 inline-flex items-center gap-1 text-xs text-text-3 hover:text-accent transition-colors"
        >
          ← Science
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-text-1">Literature Search</h1>
        <p className="mt-1 text-sm text-text-3">
          Europe PMC + Crossref  --  meta-analyses and systematic reviews surface first.
        </p>
      </header>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. morning light exposure circadian"
            className="field flex-1"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="btn btn-accent shrink-0"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {["", "meta-analysis", "systematic-review", "rct", "review"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === f
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-text-3 hover:border-accent/30"
              }`}
            >
              {f === "" ? "All types" : f.replace("-", " ")}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="card border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</div>
      )}

      {/* Results */}
      {searched && results.length === 0 && !loading && !error && (
        <div className="text-center py-8 text-sm text-text-3">
          No results found. Try different keywords.
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-text-3">{results.length} results</p>
          {results.map((r, i) => (
            <Card key={`${r.doi ?? i}`} padded>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-text-1 leading-snug">{r.title}</h3>
                  <p className="mt-1 text-xs text-text-3">
                    {r.authors.slice(0, 80)}{r.authors.length > 80 ? "…" : ""}
                    {r.journal ? ` · ${r.journal}` : ""}
                    {r.year ? ` (${r.year})` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={EVIDENCE_TONES[r.evidenceType] ?? "neutral"}>
                    {r.evidenceType.replace("-", " ")}
                  </Badge>
                  {r.isOpenAccess && (
                    <Badge tone="ok" className="text-[10px]">OA</Badge>
                  )}
                </div>
              </div>

              {r.abstract && (
                <p className="mt-2 text-xs text-text-3 leading-relaxed line-clamp-3">
                  {r.abstract}
                </p>
              )}

              <div className="mt-2 flex items-center gap-3 text-xs">
                {r.citedByCount !== null && (
                  <span className="nums text-text-3">
                    {r.citedByCount} citations
                  </span>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Read →
                  </a>
                )}
                <button
                  onClick={() => handleSave(r)}
                  className="text-text-3 hover:text-accent transition-colors"
                >
                  Save to library
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
