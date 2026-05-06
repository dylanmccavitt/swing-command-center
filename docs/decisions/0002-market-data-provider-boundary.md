# 0002: Market-Data Provider Boundary

## Chosen

Use a typed `MarketDataProvider` boundary with Alpaca Market Data as the first
adapter and deterministic mock quotes as the fallback path.

## Why

The app needs live or live-ish prices without adding brokerage integration or
order execution. A provider boundary keeps quote loading separate from portfolio
views and leaves room for Polygon, Twelve Data, or paid Alpaca SIP later.

## Options Considered

- Client-only mock data.
- Browser fetches directly to Alpaca.
- Local Vite dev proxy plus a typed Alpaca adapter.
- Full backend service.

## Tradeoffs

The Vite proxy works for the local MVP and keeps Alpaca headers out of the
browser bundle, but it is not a production backend. Static preview builds fall
back to mock quotes unless an equivalent proxy exists.

## Consequences

- Alpaca credentials live in local environment files only.
- The default mode is Alpaca-first auto mode with mock fallback when keys or
  network access are unavailable.
- UI surfaces must show the source, freshness label, and quote timestamp.
- Tests cover quote normalization, stale quote labeling, and missing-provider
  fallback behavior.
