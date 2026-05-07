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
