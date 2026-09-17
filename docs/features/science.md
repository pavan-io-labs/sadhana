# Science

## Evidence Cards

~40 curated cards, each carrying:

- **Title** and one-line headline
- **Tier**: Strong / Moderate / Weak / Traditional-only
- **Body**: the full explanation with mechanisms
- **Effect size** (when known)
- **Citations**: author (year) format
- **Tags**: for filtering and cross-linking

### Tier Definitions

| Tier | Meaning |
|------|---------|
| Strong | Multiple RCTs, meta-analyses, or systematic reviews with consistent results |
| Moderate | Some RCTs or consistent observational data; replicated but smaller samples |
| Weak | Limited studies, small samples, or inconsistent results |
| Traditional | Practiced for centuries; limited or no modern clinical evidence |

Every block, exercise, practice, and game deep-links to its evidence cards. The reasoning is one tap from the action.

## Literature Search

Server-side proxy querying two open scholarly sources:

1. **Europe PMC** -- open-access biomedical literature
2. **Crossref** -- DOI metadata and abstracts

The proxy handles:
- Cross-source deduplication by DOI
- Evidence-type ranking (meta-analysis and systematic review above narrative reviews)
- Response caching
- No CORS issues (server-side fetch)

### Saved Library

Users can save papers from search results to a local library (`papers` table). Papers can be tagged and exported as a structured digest.

## Components

- `data/science-cards.ts` -- 40 curated evidence cards
- `lib/literature.ts` -- search proxy logic
- `app/science/page.tsx` -- browse by tag
- `app/science/[id]/page.tsx` -- card detail
- `app/science/search/page.tsx` -- live literature search
- `app/science/library/page.tsx` -- saved papers
- `app/api/literature/search/route.ts` -- proxy API
- `app/api/literature/save/route.ts` -- save paper API
