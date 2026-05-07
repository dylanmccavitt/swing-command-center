# Architecture

## Current System Shape

Swing Command Center is a local Vite, React, and TypeScript frontend app. It
renders a portfolio cockpit shell from static seed holding metadata, accepts
manual local lot inputs in the browser session, polls a replaceable market-data
provider for holdings and research watchlist symbols, and turns complete
positions into concentration status plus manual profit-lock scenario tickets.

## Major Components

- `src/App.tsx`: app shell and first-screen composition.
- `src/data/seedHoldings.ts`: known current holding symbols and lightweight
  metadata for AAPL, GOOG, NVDA, and IREN.
- `src/data/seedWatchlist.ts`: small AI/semiconductor/data-center research
  watchlist symbols used by the market-data feed.
- `src/lib/marketData.ts`: market-data provider boundary, Alpaca quote
  normalization, stale/freshness labeling, and mock fallback data.
- `src/lib/portfolio.ts`: typed portfolio model, settings normalization,
  position valuation, concentration thresholds, and seed summaries.
- `src/lib/profitLock.ts`: manual scenario ticket calculators for trimming to
  target weight, locking unrealized gains, recovering cost basis, raising a
  cash target, and estimating an editable tax reserve bucket.
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
- Scenario boundary: profit-lock outputs are manual scenario tickets. The app
  must not present them as certain buy/sell recommendations or execute them.

## Main Flows

1. App loads static seed holdings and research watchlist symbols.
2. Market-data helpers create the configured provider. Auto mode uses Alpaca
   when local env keys are present and mock fallback otherwise.
3. The React shell polls the provider every minute and renders source,
   freshness, and quote timestamps.
4. The user can enter shares and average cost locally for seeded holdings.
5. Portfolio helpers combine manual lots with current prices to calculate
   market value, cost basis, unrealized P/L, portfolio weight, and
   concentration state.
6. Profit-lock helpers turn a complete selected position into scenario tickets
   for target-weight trims, gain locks, cost-basis recovery, and cash raising.
7. Tests verify that the seed list remains limited to the known symbols, does
   not invent lot data, and that portfolio/profit-lock math remains stable.

## Important Invariants

- Known bootstrap holdings are AAPL, GOOG, NVDA, and IREN.
- Share counts and average cost are manual local inputs; source-controlled seed
  data must not invent lot details.
- Source-controlled data must never include brokerage credentials or secrets.
- Market data may be live IEX, delayed, cached, or mock, and the UI must label
  the source/timestamp clearly.
- Default concentration rules warn at 25% and draft trim scenarios at 30%
  unless the user edits the session settings.
- Tax reserve is an editable estimate bucket for planning, not tax advice or a
  filing calculation.
- Issue work should preserve one issue, one branch, one worktree, one thread.
