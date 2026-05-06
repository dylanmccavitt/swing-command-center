# Architecture

## Current System Shape

Swing Command Center is a local Vite, React, and TypeScript frontend app. It
renders a portfolio cockpit shell from static seed holdings, keeps manual lot
details unset until a later local-input slice, and polls a replaceable
market-data provider for holdings and research watchlist symbols.

## Major Components

- `src/App.tsx`: app shell and first-screen composition.
- `src/data/seedHoldings.ts`: known current holding symbols and lightweight
  metadata for AAPL, GOOG, NVDA, and IREN.
- `src/data/seedWatchlist.ts`: small AI/semiconductor/data-center research
  watchlist symbols used by the market-data feed.
- `src/lib/marketData.ts`: market-data provider boundary, Alpaca quote
  normalization, stale/freshness labeling, and mock fallback data.
- `src/lib/portfolio.ts`: typed portfolio summary helpers used by the UI and
  tests.
- `vite.config.ts`: Vite/Vitest config plus the local dev proxy that injects
  Alpaca Market Data headers from local environment variables.
- `docs/handoffs/`: resume state for active or recently completed issue work.
- `docs/decisions/`: durable decision records.
- `docs/plans/`: active larger work only. Keep empty except for placeholders
  when there is no active multi-step plan.

## Boundaries

- Brokerage boundary: the app must not log in to Robinhood, scrape Robinhood,
  hold credentials, or execute trades.
- Market-data boundary: live prices belong behind `MarketDataProvider`.
  Alpaca Market Data is the first provider and uses the Vite dev proxy so
  secret-bearing headers stay out of the browser bundle. Missing keys or
  failed requests fall back to mock quotes.
- Persistence boundary: MVP state should stay local. Repo fixtures must not
  contain account-specific secrets or private brokerage data.
- Advice boundary: the app can calculate and organize planning information, but
  tax reserves and trade plans are estimates/helpers, not financial advice.

## Main Flows

1. App loads static seed holdings and research watchlist symbols.
2. Portfolio helpers summarize the known symbols and unset manual lot fields.
3. Market-data helpers create the configured provider. Auto mode uses Alpaca
   when local env keys are present and mock fallback otherwise.
4. The React shell polls the provider every minute and renders source,
   freshness, and quote timestamps.
5. Tests verify that the seed list remains limited to the known symbols and
   does not invent lot data.

## Important Invariants

- Known bootstrap holdings are AAPL, GOOG, NVDA, and IREN.
- Share counts and average cost are manual fields until real local input exists.
- Source-controlled data must never include brokerage credentials or secrets.
- Market data may be live IEX, delayed, cached, or mock, and the UI must label
  the source/timestamp clearly.
- Issue work should preserve one issue, one branch, one worktree, one thread.
