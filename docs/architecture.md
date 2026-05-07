# Architecture

## Current System Shape

Swing Command Center is a local Vite, React, and TypeScript frontend app. It
renders a dense portfolio cockpit shell from static seed holding metadata,
accepts manual local lot inputs in the browser session, polls a replaceable
market-data provider for holdings and research watchlist symbols, turns
complete positions into concentration status, chart rows, and manual
profit-lock scenario tickets, and keeps an editable AI-stack research watchlist
for thesis-first trade setup tracking. The research desk can run a typed
research-provider flow for one symbol or the selected AI-stack layer, then
draft editable research fields with visible source URLs, timestamps, and review
state.

## Major Components

- `src/App.tsx`: app shell, first-screen cockpit composition, chart rendering,
  manual lot inputs, settings controls, and market-data state surfaces.
- `src/data/seedHoldings.ts`: known current holding symbols and lightweight
  metadata for AAPL, GOOG, NVDA, and IREN.
- `src/data/seedWatchlist.ts`: AI-stack layer definitions plus editable seed
  research cards for current holdings and placeholder candidates.
- `src/lib/marketData.ts`: market-data provider boundary, Alpaca quote
  normalization, stale/freshness labeling, and mock fallback data.
- `src/lib/portfolio.ts`: typed portfolio model, settings normalization,
  position valuation, concentration thresholds, and seed summaries.
- `src/lib/profitLock.ts`: manual scenario ticket calculators for trimming to
  target weight, locking unrealized gains, recovering cost basis, raising a
  cash target, and estimating an editable tax reserve bucket.
- `src/lib/cockpit.ts`: first-screen derived summaries, top profit-lock
  scenario ranking, allocation/gain/concentration chart rows, and symbol color
  mapping.
- `src/lib/researchWatchlist.ts`: manual research-card grouping, checklist
  scoring, and filtering helpers. Scores are field-completeness checks, not
  expected-return or recommendation scores.
- `src/lib/researchProvider.ts`: typed research source boundary, curated
  source-pack builder, stale/empty source states, and normalized AI-drafted
  research fields for manual review.
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
  failed requests fall back to mock quotes. Issue worktrees may reuse the
  canonical checkout's ignored `.env.local` through the shared git directory;
  worktree-local env files still override it.
- Persistence boundary: MVP state should stay local. Repo fixtures must not
  contain account-specific secrets or private brokerage data.
- Advice boundary: the app can calculate and organize planning information, but
  tax reserves and trade plans are estimates/helpers, not financial advice.
- Scenario boundary: profit-lock outputs are manual scenario tickets. The app
  must not present them as certain buy/sell recommendations or execute them.
- Research boundary: AI-stack candidate scores only measure whether user-editable
  thesis/setup fields are filled. They must not be framed as an AI model,
  guaranteed recommendation, ranking of expected returns, or automated trade
  signal.
- Research-draft boundary: generated research drafts must stay behind a typed
  `ResearchProvider`, show source metadata, write into editable fields only,
  and remain marked AI-drafted / needs review until the user reviews them.
  Drafts must not include guaranteed recommendations, buy/sell instructions,
  brokerage access, or order execution.

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
6. Cockpit helpers rank ready manual profit-lock scenarios across complete
   positions and summarize concentration and cash/runway status for the first
   screen.
7. Chart components render allocation, gains by holding, concentration, and
   session price/watchlist movement from typed derived rows.
8. Profit-lock helpers turn a complete selected position into scenario tickets
   for target-weight trims, gain locks, cost-basis recovery, and cash raising.
9. Research watchlist helpers group current holdings and placeholder candidates
   by AI-stack layer, calculate manual checklist completeness, and filter the
   candidate list by layer, score, holding status, and missing inputs.
10. The user can run research for the selected symbol or selected layer. The
   research provider returns recent-news, investor, filing, earnings, and
   sector-context source metadata; the app drafts thesis, catalyst,
   invalidation, risk notes, review date, and source notes into the editable
   card.
11. Tests verify that the seed list remains limited to the known symbols, does
   not invent lot data, and that portfolio/profit-lock/cockpit math remains
   stable. Research-provider tests cover source metadata, stale/empty states,
   draft normalization, and non-recommendation copy.

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
- AI-stack research layers are hyperscalers, GPU/chip designers, foundries,
  memory, semiconductor equipment, EDA/IP, networking, power/cooling, data
  centers, and energy.
- Research card and trade setup data stays manually editable in the browser
  session; source-controlled seeds must not be presented as guaranteed
  recommendations.
- Research source packs must show URL, retrieved timestamp, and freshness before
  the draft can be treated as reviewed.
- UI state must clearly show loading, empty, stale-data, and error/fallback
  market and research conditions without inventing brokerage holdings or trade
  history.
- Issue work should preserve one issue, one branch, one worktree, one thread.
