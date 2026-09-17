# ADR-002: No LLM In-App

## Status

Accepted

## Context

The app needs an "assistant" that provides daily guidance (briefing, advisories). Options considered:

1. **LLM-based** (Claude/GPT API): conversational, flexible, natural language
2. **Deterministic rules engine + template-composed briefing**: predictable, offline, free
3. **Hybrid**: rules for safety-critical advisories, LLM for the briefing prose

## Decision

Use a **deterministic rules engine and template-composed briefing**. No LLM in the app.

## Rationale

- **No API key required**: the app works offline and has zero per-message cost
- **Cannot hallucinate**: a template system is structurally incapable of inventing a health claim. When the app says "caffeine past cutoff," it is because the arithmetic says so, not because a model pattern-matched.
- **Auditable**: every advisory traces to a specific rule in `lib/rules.ts` with a citation
- **Offline-first**: the briefing works without internet access
- **No vendor dependency**: no OpenAI/Anthropic account, no API rate limits, no billing surprises

## Consequences

- The briefing prose is formulaic (phrase bank with conditional branches), not conversational
- Complex "what if" questions cannot be answered in-app
- A conversational Claude layer is a clean later addition (additive, not a rewrite)
- The rules engine requires explicit rule authoring for each new advisory
