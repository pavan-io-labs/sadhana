# ADR-005: Evidence Tiering System

## Status

Accepted

## Context

The app surfaces health and wellness claims. Users need to know how strong the evidence is behind each recommendation. Options:

1. **No tiering**: present everything as equally valid
2. **Binary** (evidence-based / traditional): too coarse
3. **Four-tier system**: Strong / Moderate / Weak / Traditional-only
4. **Numeric confidence scores**: precise but misleading (false precision)

## Decision

Use a **four-tier system**: Strong, Moderate, Weak, Traditional-only.

## Rationale

- **Honest**: the tiers force the app to admit when evidence is limited. "Abhyanga reduces cortisol" gets "Traditional" because the studies are few and small. "Sleep below 7 hours impairs cognition" gets "Strong" because the PVT dose-response data is robust.
- **Granular enough**: four levels capture the real spread of evidence quality in the Ayurvedic + exercise science space without false precision.
- **Actionable**: the user can make informed decisions. "Strong" means "the data is good, do this with confidence." "Traditional" means "practiced for centuries, limited modern evidence, use your judgement."
- **Color-coded but accessible**: Strong = green, Moderate = blue, Weak = amber, Traditional = neutral. Always labelled in text, never color-only.

## Tier Definitions

| Tier | Criteria |
|------|----------|
| Strong | Multiple RCTs, meta-analyses, or systematic reviews with consistent results |
| Moderate | Some RCTs or consistent observational data; replicated but smaller samples |
| Weak | Limited studies, small samples, or inconsistent results |
| Traditional | Practiced for centuries; limited or no modern clinical evidence |

## Consequences

- Every evidence card requires a tier assignment (editorial judgement)
- The tiers are subjective at the boundaries (is a single large RCT "Strong" or "Moderate"?)
- The literature search proxy ranks results by publication type (meta-analysis > RCT > observational) to help users find stronger evidence
- Adding new cards requires honestly assessing the tier rather than defaulting to "Strong"
