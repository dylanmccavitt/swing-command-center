# Architecture

## Current System Shape

Swing Command Center is a local Vite, React, and TypeScript frontend app. It
renders a dense portfolio cockpit shell from starter holding metadata and
user-added holdings, accepts manual local lot inputs in the browser session,
polls a replaceable market-data provider for holdings and research watchlist
symbols, turns complete positions into concentration status, chart rows, and
manual profit-lock scenario tickets, and keeps an editable AI-stack research
watchlist for thesis-first trade setup tracking. A target/stop scenario planner
combines selected holdings or research cards with editable price, risk, trim,
support, and time-horizon inputs to draft manual planning levels with
calculation reasons. Manual trade-ticket and journal helpers convert
profit-lock scenarios and trade setups into local checklist tickets,
browser-session journal rows, realized P/L summaries, configurable
pay-yourself estimates, profit-cash planning rows, and exportable tax-helper
review JSON. The research desk can run a typed
research-provider flow for one symbol or the selected AI-stack layer, then
draft editable research fields with visible source URLs, timestamps, and review
state. It can also queue a local Codex/ChatGPT research request JSON and import
a validated local result JSON into the same editable research card as
AI-drafted / Needs review.

## Major Components

- `src/App.tsx`: app shell, first-screen cockpit composition, chart rendering,
  editable holding list, manual lot inputs, settings controls, and market-data
  state surfaces.
- `src/data/seedHoldings.ts`: starter current holding symbols and lightweight
  metadata used to bootstrap the editable local holding list.
- `src/data/seedWatchlist.ts`: AI-stack layer definitions plus editable seed
  research cards for current holdings and placeholder candidates.
- `src/lib/marketData.ts`: market-data provider boundary, Alpaca quote
  normalization, stale/freshness labeling, and mock fallback data.
- `src/lib/portfolio.ts`: typed portfolio model, settings normalization,
  position valuation, concentration thresholds, and seed summaries.
- `src/lib/profitLock.ts`: manual scenario ticket calculators for trimming to
  target weight, locking unrealized gains, recovering cost basis, raising a
  cash target, and estimating an editable tax reserve bucket.
- `src/lib/scenarioPlanner.ts`: manual target/stop scenario calculator for
  planned entry, stop level, stop-limit buffer, first target, stretch target,
  trim size, proceeds, gain/loss, and remaining position.
- `src/lib/tradeJournal.ts`: manual trade-ticket, journal-entry, realized P/L
  summary, pay-yourself, and tax-helper export helpers.
- `src/lib/profitCashPlan.ts`: manual helper that calculates profit cash left
  after reserve and pay-yourself, then lists current holdings, research ideas,
  and cash as review choices.
- `src/lib/cockpit.ts`: first-screen derived summaries, top profit-lock
  scenario ranking, allocation/gain/concentration chart rows, and symbol color
  mapping.
- `src/lib/researchWatchlist.ts`: manual research-card grouping, checklist
  scoring, and filtering helpers. Scores are field-completeness checks, not
  expected-return or recommendation scores.
- `src/lib/researchProvider.ts`: typed research source boundary, curated
  source-pack builder, stale/empty source states, and normalized AI-drafted
  research fields for manual review.
- `src/lib/codexResearchQueue.ts`: local Codex research request builder,
  result validator, source metadata normalizer, and ignored queue path helpers.
- `vite.config.ts`: Vite/Vitest config plus the local dev proxy that injects
  Alpaca Market Data headers from local environment variables.
- `research-queue/`: ignored runtime request/result JSON folders plus committed
  queue shape docs and `.gitkeep` placeholders.
- `docs/schemas/`: JSON schemas for Codex research request and result files.
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
- Persistence boundary: MVP state should stay local in the browser session.
  Repo fixtures must not contain account-specific secrets or private brokerage
  data.
- Advice boundary: the app can calculate and organize planning information, but
  tax reserves and trade plans are estimates/helpers, not financial advice.
- Scenario boundary: profit-lock outputs are manual scenario tickets. The app
  must not present them as certain buy/sell recommendations or execute them.
- Target/stop boundary: target and stop outputs are review scenarios only. The
  planner can explain levels from risk budgets, R multiples, gain percents,
  and manual reference prices, but it must not guarantee a result, recommend a
  buy/sell action, create an order ticket, or automate execution.
- Trade journal boundary: generated tickets and journal entries are manual
  checklists and browser-session records only. They may estimate cash raised or
  spent, realized P/L, reserve buckets, pay-yourself amounts, and tax-helper
  export fields, but they must not store credentials, connect to Robinhood,
  execute orders, automate trading, or present export JSON as a tax filing
  document or tax advice.
- Research boundary: AI-stack candidate scores only measure whether user-editable
  thesis/setup fields are filled. They must not be framed as an AI model,
  guaranteed recommendation, ranking of expected returns, or automated trade
  signal.
- Research-draft boundary: generated research drafts must stay behind a typed
  `ResearchProvider`, show source metadata, write into editable fields only,
  and remain marked AI-drafted / needs review until the user reviews them.
  Drafts may source-report analyst ratings, target prices, and option strike
  context, but must not create their own rating, guarantee an outcome, write
  buy/sell instructions, access brokerage accounts, or execute orders.
- Codex queue boundary: local request/result JSON can be generated and imported,
  but the app must not call OpenAI APIs, require API keys, silently invoke a
  Codex subscription, or commit generated research artifacts. Result JSON must
  be validated before it drafts card fields.

## Main Flows

1. App loads static seed holdings and research watchlist symbols.
2. Market-data helpers create the configured provider. Auto mode uses Alpaca
   when local env keys are present and mock fallback otherwise.
3. The React shell polls the provider every minute and renders source,
   freshness, and quote timestamps.
4. The user can enter shares and average cost locally for seeded holdings.
5. The user can add, update, or remove holdings in the session. New holdings
   also get an editable research card so they can be planned alongside the
   watchlist.
6. Portfolio helpers combine manual lots with current prices to calculate
   market value, cost basis, unrealized P/L, portfolio weight, and
   concentration state.
7. Cockpit helpers rank ready manual profit-lock scenarios across complete
   positions and summarize concentration and cash/runway status for the first
   screen.
8. Chart components render allocation, gains by holding, concentration, and
   session price/watchlist movement from typed derived rows.
9. Profit-lock helpers turn a complete selected position into scenario tickets
   for target-weight trims, gain locks, cost-basis recovery, and cash raising.
10. Target/stop scenario helpers turn the selected current holding or research
   card plus editable inputs into planned entry, stop, stop-limit buffer, first
   target, stretch target, trim, proceeds, gain/loss, and remaining-position
   outputs with explicit reasons and guardrails.
11. Trade-journal helpers convert selected profit-lock scenarios and trade
    setups into manual checklist tickets with symbol, action, estimated shares,
    estimated cash raised or spent, estimated realized gain, tax reserve,
    reason, invalidation, and checklist copy.
12. The user can add local journal entries for planned, executed, mistake, and
    result states; edit realized P/L, reserve, pay-yourself, notes, and tax-prep
    notes; review the realized-profit summary; and export JSON for a tax-helper
    review.
13. Profit-cash planning subtracts reserve and the configured pay-yourself
    amount from realized trading profit, then lists current holdings,
    watchlist/research ideas, and cash as manual places to review.
14. Research watchlist helpers group current holdings and placeholder candidates
   by AI-stack layer, calculate manual checklist completeness, and filter the
   candidate list by layer, score, holding status, and missing inputs.
15. The user can run research for the selected symbol or selected layer. The
    research provider returns recent-news, investor, filing, earnings, and
    sector-context source metadata; the app drafts thesis, catalyst,
    invalidation, risk notes, review date, and source notes into the editable
    card.
16. The user can queue a Codex research request for the selected symbol. The app
    creates a structured request JSON for manual worker processing, then can
    import a local result JSON only after schema, symbol/request, source
    metadata, and non-recommendation validation pass.
17. Tests verify that holding summaries follow the current user-provided list,
    do not invent lot data, and that portfolio/profit-lock/cockpit math remains
    stable. Research-provider tests cover source metadata, stale/empty states,
    draft normalization, and non-recommendation copy. Codex queue tests cover
    request payloads, result validation, source metadata, ignored generated
    artifacts, and non-recommendation copy. Scenario-planner tests cover
    target/stop math, stop-limit buffers, missing-input states, invalid
    long-position stops, and non-recommendation copy. Trade-journal tests cover
    ticket generation, journal statuses and math, realized-profit summaries,
    pay-yourself rules, tax-helper export shape, and non-automation /
    non-tax-advice copy. Profit-cash tests cover post-pay-yourself math,
    candidate rows, and manual non-advisory copy.

## Important Invariants

- Starter bootstrap holdings are AAPL, GOOG, NVDA, and IREN, but the working
  portfolio is the editable local holding list.
- Share counts and average cost are manual local inputs; source-controlled seed
  data and generated rows must not invent lot details.
- Source-controlled data must never include brokerage credentials or secrets.
- Market data may be live IEX, delayed, cached, or mock, and the UI must label
  the source/timestamp clearly.
- Default concentration rules warn at 25% and draft trim scenarios at 30%
  unless the user edits the session settings.
- Tax reserve is an editable estimate bucket for planning, not tax advice or a
  filing calculation.
- Target/stop planning levels require user-reviewable inputs and must surface
  missing cost basis, stale or missing market data, invalid risk/reward, and
  stops above planned entry for long positions.
- Manual trade tickets and journal rows are local browser-session checklists.
  They must include reviewable reasons and invalidation, must keep planned
  entries out of realized P/L math, and must not claim broker execution.
- Pay-yourself estimates default to a small percentage of net realized trading
  profit after reserve and remain configurable.
- Profit-cash planning must remain a manual review list. It may show current
  holdings, watchlist cards, research completeness, estimated shares, and cash
  as a place to hold funds, but it must not recommend or execute buys/sells.
- Tax-helper exports are planning review JSON only, not filing documents or tax
  advice.
- AI-stack research layers are hyperscalers, GPU/chip designers, foundries,
  memory, semiconductor equipment, EDA/IP, networking, power/cooling, data
  centers, and energy.
- Research card and trade setup data stays manually editable in the browser
  session; source-controlled seeds must not be presented as guaranteed
  recommendations.
- Research source packs must show URL, retrieved timestamp, and freshness before
  the draft can be treated as reviewed.
- Codex research request/result JSON under `research-queue/requests/*.json` and
  `research-queue/results/*.json` is runtime-only and ignored by git.
- Codex result imports must include source metadata and remain AI-drafted /
  Needs review until the user manually reviews them.
- UI state must clearly show loading, empty, stale-data, and error/fallback
  market and research conditions without inventing brokerage holdings or trade
  history.
- Issue work should preserve one issue, one branch, one worktree, one thread.
