# Swing Command Center

Local-first manual swing trading command center for portfolio visibility,
profit-lock planning, and trade discipline. The app is intentionally separate
from brokerage access: no Robinhood login, no order execution, and no secrets
stored in repo data.

## Run

```bash
npm install
npm run dev
```

Market data defaults to Alpaca-first auto mode and falls back to mock quotes
when keys are not configured. Put local Alpaca Market Data keys in `.env.local`
to enable the Vite dev proxy:

```bash
VITE_MARKET_DATA_MODE=auto
VITE_ALPACA_MARKET_DATA_FEED=iex
ALPACA_MARKET_DATA_API_KEY_ID=...
ALPACA_MARKET_DATA_SECRET_KEY=...
```

Issue worktrees also read the canonical checkout's ignored `.env.local` through
the shared git directory. Put the Alpaca keys once in
`/Users/dylanmccavitt/projects/swing-command-center/.env.local`, and new
worktrees can reuse them without copying secrets into source control.

## Check

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Seed Data

The bootstrap seed includes the known current holding symbols:

- AAPL
- GOOG
- NVDA
- IREN

Share counts and cost basis are intentionally left as manual local inputs for
the browser session. The planner combines those inputs with current market data
to show position value, cost basis, unrealized P/L, concentration status, and
manual profit-lock scenario tickets. Scenario tickets are planning aids only and
do not place trades.

## Cockpit Surface

The first screen is a dense working cockpit: portfolio value, unrealized gain,
cash/runway target, concentration risk, top manual profit-lock scenarios,
allocation, and session watchlist movement. Secondary panels keep gains by
holding, concentration thresholds, manual lots, risk settings, selected
scenario tickets, and quote freshness visible without brokerage login or order
execution.

The AI-stack research desk groups current holdings and editable placeholder
candidates by hyperscalers, GPU/chip designers, foundries, memory,
semiconductor equipment, EDA/IP, networking, power/cooling, data centers, and
energy. Research cards and trade setup fields are manual checklist inputs; the
score only measures filled fields and is not a recommendation engine.

`Run research` drafts thesis, catalyst, invalidation, risk notes, review date,
and source notes from a typed research-provider boundary. The source pack shows
URLs, timestamps, and freshness for recent news, investor materials, filings,
earnings materials, and sector context. Drafts are marked AI-drafted / needs
review until the user manually reviews them, and every drafted field remains
editable.

## Codex Research Queue

The research card can also queue a local Codex/ChatGPT research request. The
app downloads a structured request JSON for the selected card, including symbol,
company name, AI-stack layer, current editable fields, required result schema,
and guardrails. A human or Codex worker processes that file manually with
browser, Chrome, ChatGPT, or Deep Research using `docs/codex-research-worker.md`,
then writes a result JSON under `research-queue/results/`.

Generated `research-queue/requests/*.json` and
`research-queue/results/*.json` files are ignored by git. The app validates a
selected result file before importing thesis, catalyst, invalidation, risk
notes, review date, source notes, and source metadata into the existing editable
research card as AI-drafted / Needs review. This flow does not call OpenAI APIs,
does not require API keys, and must not produce buy/sell instructions or
guaranteed recommendations.
