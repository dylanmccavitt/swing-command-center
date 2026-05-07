# 0006: Research Provider Draft Boundary

## Chosen

Add a typed `ResearchProvider` boundary for AI-stack source packs and keep
generated card updates as AI-drafted, manually editable research drafts.

## Why

The research desk needs to speed up thesis work without turning the app into a
recommendation engine. A provider boundary lets source collection change later
while the React surface only consumes typed source metadata and normalized
draft fields.

## Options Considered

- Keep all research fields manual.
- Hardcode source links directly inside the React view.
- Add a typed source-provider boundary with normalized drafts.
- Add live model ranking, buy/sell outputs, or brokerage-connected actions.

## Tradeoffs

The current provider uses transparent curated source URLs instead of a live
scraping or paid-news integration, so the user still has to inspect source
pages manually. That matches the slice guardrails and keeps the app local-first,
credential-free, and fast to test.

## Consequences

- Drafts update thesis, catalyst, invalidation, risk notes, review date, and
  source notes only.
- Source packs show URL, retrieved timestamp, and freshness state.
- Empty-source, stale-source, loading, and error states are explicit UI states.
- Drafts stay marked AI-drafted / needs review until the user marks them
  reviewed, and all fields remain editable.
- Generated copy must not be presented as a guaranteed recommendation or
  buy/sell instruction.
