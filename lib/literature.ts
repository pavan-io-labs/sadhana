/**
 * Literature search proxy  --  Europe PMC + Crossref.
 *
 * Server-side: no CORS issues, caches responses, deduplicates by DOI, and ranks
 * by evidence type (meta-analysis > systematic review > RCT > other).
 */

import { getDb, schema } from "./db";
import { eq } from "drizzle-orm";

export type LitSource = "europepmc" | "crossref";

export type LitResult = {
  source: LitSource;
  doi: string | null;
  pmid: string | null;
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

const EVIDENCE_RANK: Record<string, number> = {
  "meta-analysis": 0,
  "systematic-review": 1,
  rct: 2,
  "clinical-trial": 3,
  review: 4,
  other: 5,
};

function classifyEvidence(title: string, abstract: string, pubType?: string): string {
  const text = `${title} ${abstract} ${pubType ?? ""}`.toLowerCase();
  if (text.includes("meta-analysis") || text.includes("meta analysis")) return "meta-analysis";
  if (text.includes("systematic review")) return "systematic-review";
  if (text.includes("randomized controlled") || text.includes("randomised controlled") || text.includes("rct")) return "rct";
  if (text.includes("clinical trial")) return "clinical-trial";
  if (text.includes("review")) return "review";
  return "other";
}

/* ---------------------------------------------------------------- Europe PMC */

async function searchEuropePmc(query: string, limit = 20): Promise<LitResult[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${limit}&resultType=core`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: LitResult[] = (data.resultList?.result ?? []).map((r: Record<string, unknown>) => ({
      source: "europepmc" as const,
      doi: (r.doi as string) ?? null,
      pmid: (r.pmid as string) ?? null,
      title: (r.title as string) ?? "",
      authors: (r.authorString as string) ?? "",
      journal: (r.journalTitle as string) ?? "",
      year: r.pubYear ? Number(r.pubYear) : null,
      abstract: (r.abstractText as string) ?? "",
      url: r.doi ? `https://doi.org/${r.doi}` : (r.fullTextUrlList as Record<string, unknown[]>)?.fullTextUrl?.[0]
        ? String((r.fullTextUrlList as { fullTextUrl: { url: string }[] }).fullTextUrl[0].url)
        : "",
      evidenceType: classifyEvidence(
        (r.title as string) ?? "",
        (r.abstractText as string) ?? "",
        (r.pubTypeList as Record<string, string[]>)?.pubType?.[0] ?? "",
      ),
      isOpenAccess: r.isOpenAccess === "Y",
      citedByCount: typeof r.citedByCount === "number" ? r.citedByCount : null,
    }));
    return results;
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------- Crossref */

async function searchCrossref(query: string, limit = 10): Promise<LitResult[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${limit}&select=DOI,title,author,container-title,published-print,abstract,is-referenced-by-count`;
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Sadhana/1.0 (mailto:sadhana@example.com)" },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data.message?.items ?? [];
    return items.map((item: Record<string, unknown>) => {
      const title = Array.isArray(item.title) ? item.title[0] : "";
      const abstract = typeof item.abstract === "string" ? item.abstract.replace(/<[^>]+>/g, "") : "";
      return {
        source: "crossref" as const,
        doi: (item.DOI as string) ?? null,
        pmid: null,
        title,
        authors: Array.isArray(item.author)
          ? item.author.map((a: Record<string, string>) => `${a.given ?? ""} ${a.family ?? ""}`).join(", ")
          : "",
        journal: Array.isArray(item["container-title"]) ? item["container-title"][0] : "",
        year: (item["published-print"] as Record<string, number[][]>)?.["date-parts"]?.[0]?.[0] ?? null,
        abstract,
        url: item.DOI ? `https://doi.org/${item.DOI}` : "",
        evidenceType: classifyEvidence(title, abstract),
        isOpenAccess: false,
        citedByCount: typeof item["is-referenced-by-count"] === "number" ? item["is-referenced-by-count"] : null,
      };
    });
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------- combined */

/**
 * Search both sources, deduplicate by DOI, rank by evidence type, and cache.
 */
export async function searchLiterature(
  query: string,
  options: { limit?: number; filter?: string } = {},
): Promise<LitResult[]> {
  const limit = options.limit ?? 20;

  // Check cache first
  const cacheKey = `lit:${query}:${limit}:${options.filter ?? ""}`;
  const db = await getDb();
  const cached = await db
    .select()
    .from(schema.searchCache)
    .where(eq(schema.searchCache.key, cacheKey))
    .limit(1);

  if (cached[0]) {
    const age = Date.now() - new Date(cached[0].fetchedAt).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      // Cache valid for 24h
      return JSON.parse(cached[0].payload) as LitResult[];
    }
  }

  // Fetch from both sources
  const [epmc, cr] = await Promise.all([
    searchEuropePmc(query, limit),
    searchCrossref(query, Math.floor(limit / 2)),
  ]);

  // Deduplicate by DOI
  const seen = new Set<string>();
  const all: LitResult[] = [];
  for (const r of [...epmc, ...cr]) {
    const key = r.doi ?? `${r.title.slice(0, 50)}:${r.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(r);
  }

  // Filter by evidence type if requested
  let filtered = all;
  if (options.filter) {
    filtered = all.filter((r) => r.evidenceType === options.filter);
  }

  // Rank by evidence type, then by citation count
  filtered.sort((a, b) => {
    const ra = EVIDENCE_RANK[a.evidenceType] ?? 5;
    const rb = EVIDENCE_RANK[b.evidenceType] ?? 5;
    if (ra !== rb) return ra - rb;
    return (b.citedByCount ?? 0) - (a.citedByCount ?? 0);
  });

  const results = filtered.slice(0, limit);

  // Cache the result
  await db
    .insert(schema.searchCache)
    .values({ key: cacheKey, payload: JSON.stringify(results) })
    .onConflictDoUpdate({
      target: schema.searchCache.key,
      set: { payload: JSON.stringify(results), fetchedAt: new Date().toISOString() },
    });

  return results;
}

/* ---------------------------------------------------------------- library */

export async function saveToLibrary(result: LitResult, cardIds: string[] = []): Promise<void> {
  const db = await getDb();
  await db
    .insert(schema.papers)
    .values({
      source: result.source,
      doi: result.doi,
      pmid: result.pmid,
      title: result.title,
      authors: result.authors,
      journal: result.journal,
      year: result.year,
      abstract: result.abstract,
      url: result.url,
      evidenceType: result.evidenceType,
      isOpenAccess: result.isOpenAccess,
      citedByCount: result.citedByCount,
      cardIds,
    })
    .onConflictDoNothing();
}

export async function getSavedPapers(limit = 50) {
  const db = await getDb();
  return db
    .select()
    .from(schema.papers)
    .orderBy(schema.papers.savedAt)
    .limit(limit);
}

export async function deletePaper(id: number) {
  const db = await getDb();
  return db.delete(schema.papers).where(eq(schema.papers.id, id));
}
