# External Integrations

## Europe PMC

**Purpose**: open-access biomedical literature search.

- **Endpoint**: `https://www.ebi.ac.uk/europepmc/webservices/rest/search`
- **Auth**: none (public API, CORS `*`)
- **Usage**: proxied via `/api/literature/search`
- **Rate limit**: unspecified; we cache responses server-side

Returns: title, abstract, DOI, journal, year, authors, publication type.

## Crossref

**Purpose**: DOI metadata and abstract retrieval.

- **Endpoint**: `https://api.crossref.org/works`
- **Auth**: none (polite pool; we send a `mailto:` in the User-Agent)
- **Usage**: proxied via `/api/literature/search`, deduplicated against Europe PMC by DOI
- **Rate limit**: 50 req/s in the polite pool

Returns: title, abstract, DOI, journal, year, authors, type.

## NOAA Solar Equations

**Purpose**: sunrise, sunset, solar noon, civil twilight calculation.

- **Implementation**: direct computation in `lib/astro.ts` (no API call)
- **Algorithm**: NOAA solar position equations
  - Julian day to fractional year
  - Equation of time
  - Solar declination
  - Hour angle at zenith 90.833 degrees (includes atmospheric refraction)
- **Accuracy**: +/- 2 minutes against published values for known city/date pairs

## YouTube (Optional)

**Purpose**: curated video library and optional live search.

- **Curated library**: static data in `data/videos.ts`, no API needed
- **Live search**: requires `YOUTUBE_API_KEY` in `.env.local`
- **Embedding**: `youtube-nocookie.com` iframe, loaded only on user click
- **Privacy**: no requests to Google until the user explicitly plays a video

## No External Dependencies at Runtime

The app functions fully without any external API:
- Solar calculations are computed locally
- The curated science cards and videos are static data
- The briefing is template-composed (no LLM)
- Literature search and YouTube search are optional enhancements
