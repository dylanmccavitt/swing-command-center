# 0005: Manual AI-Stack Research Watchlist

## Chosen

Add an editable AI-stack research watchlist with fixed layer groupings,
research-card fields, trade setup fields, and a checklist-completeness score.

## Why

The app needs to organize semiconductor and AI supply-chain ideas without
turning the cockpit into a recommendation engine. Fixed layers keep the
research surface scannable, and typed helper functions make grouping, scoring,
and filtering testable outside the React view.

## Options Considered

- Keep a flat symbol watchlist with market movement only.
- Add free-form notes directly in the React view.
- Add typed research cards with manual checklist scoring.
- Add AI ranking, backtesting, or generated recommendations.

## Tradeoffs

Manual checklist scoring is less sophisticated than a model or backtest, but it
matches the MVP guardrails. It tells the user whether thesis, risk, and setup
fields are filled in; it does not score attractiveness, probability, or expected
return.

## Consequences

- AI-stack layers are fixed in `src/data/seedWatchlist.ts`.
- Current holdings and placeholder candidates share the same editable research
  card shape.
- Trade setup fields remain browser-session state for now.
- UI copy must keep the score framed as a field-completeness checklist, not a
  recommendation.
