# 0010: Manual Sell Fills Drive Buying Power

## Chosen

Use manual sell-fill records as the source of truth for realized P/L,
pay-yourself, buying power, and reinvest cash planning.

## Why

The app needs to separate "I planned or journaled something" from "a sell
actually filled." Pay-yourself and cash-to-reinvest math should come from
filled sell activity with entered shares, fill price, cost basis, fees, and
filled date, not from generic journal rows or scenario estimates.

## Options Considered

- Keep using generic journal rows for realized P/L and pay-yourself.
- Add view-local sell-fill calculations directly in React.
- Add a typed sell-fill and buying-power helper with manual entry/import.
- Connect to Robinhood or broker statements automatically.

## Tradeoffs

The manual helper requires Dylan to enter or locally import fill details before
the cash plan updates. That is intentional for the current local-first app
because it avoids credentials, scraping, order execution, and invented trade
history while creating a testable model for future persistence.

## Consequences

- Planned, ordered, and canceled sell rows do not affect realized P/L or buying
  power.
- Filled and reviewed sell rows can calculate cash raised, cost basis removed,
  realized gain/loss, reserve, pay-yourself, and reinvestable cash.
- Missing shares, fill price, filled date, average cost, or cost basis stay
  visible instead of being guessed.
- Local CSV/JSON import is manual only and does not connect to a broker.
- Export JSON is a planning/review artifact, not a filing document or tax
  advice.
