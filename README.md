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
later slices.
