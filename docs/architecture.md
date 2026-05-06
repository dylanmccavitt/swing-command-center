# Architecture

## Current System Shape

Swing Command Center is a local Vite, React, and TypeScript frontend app. The
current bootstrap slice renders a portfolio cockpit shell from static seed
holdings and keeps manual lot details unset until a later local-input slice.

## Major Components

- `src/App.tsx`: app shell and first-screen composition.
- `src/data/seedHoldings.ts`: known current holding symbols and lightweight
  metadata for AAPL, GOOG, NVDA, and IREN.
- `src/lib/portfolio.ts`: typed portfolio summary helpers used by the UI and
  tests.
- `docs/handoffs/`: resume state for active or recently completed issue work.
- `docs/decisions/`: durable decision records.
- `docs/plans/`: active larger work only. Keep empty except for placeholders
  when there is no active multi-step plan.

## Boundaries

- Brokerage boundary: the app must not log in to Robinhood, scrape Robinhood,
  hold credentials, or execute trades.
- Market-data boundary: live prices belong behind a provider abstraction. The
  bootstrap app has no live provider yet.
- Persistence boundary: MVP state should stay local. Repo fixtures must not
  contain account-specific secrets or private brokerage data.
- Advice boundary: the app can calculate and organize planning information, but
  tax reserves and trade plans are estimates/helpers, not financial advice.

## Main Flows

1. App loads static seed holdings.
2. Portfolio helpers summarize the known symbols and unset manual lot fields.
3. The React shell renders bootstrap status, seeded holdings, and guardrails.
4. Tests verify that the seed list remains limited to the known symbols and
   does not invent lot data.

## Important Invariants

- Known bootstrap holdings are AAPL, GOOG, NVDA, and IREN.
- Share counts and average cost are manual fields until real local input exists.
- Source-controlled data must never include brokerage credentials or secrets.
- Issue work should preserve one issue, one branch, one worktree, one thread.
