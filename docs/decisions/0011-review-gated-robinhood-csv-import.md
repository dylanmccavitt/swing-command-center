# 0011: Review-Gated Robinhood CSV Import

## Chosen

Support Robinhood data through local CSV file import only, normalize imported
rows into typed review records, and feed only accepted sell rows into the
existing sell-fill buying-power model.

## Why

AGE-558 needs more accurate proceeds, basis, realized P/L, holding period,
wash-sale, dividend, and interest data without crossing the brokerage boundary.
Official account activity and realized gain/loss CSV files are enough for this
slice and keep the app credential-free, local-first, and testable.

## Options Considered

- Keep all sell fills manual.
- Import Robinhood CSV rows directly as filled sell records.
- Add a typed Robinhood CSV normalization and review layer.
- Connect to Robinhood through login, scraping, unofficial APIs, or trading APIs.

## Tradeoffs

The review layer adds extra UI and model code before buying power updates, but
it prevents imported rows from silently changing cash planning. CSV formats can
vary, so the parser supports common official report headers and keeps unknown
or incomplete rows visible instead of guessing. Realized gain/loss rows are
preferred over matching account-activity sell rows because they carry basis,
holding period, realized P/L, and wash-sale fields.

## Consequences

- Imported rows default to `needs_review`.
- Accepted sells map to reviewed sell-fill records; rejected and pending rows do
  not affect buying power, pay-yourself, or reinvest cash.
- Missing basis, proceeds, holding period, wash-sale, fee, and tax fields stay
  missing. The app may derive a per-share fill price from imported proceeds and
  quantity, but it must not invent unavailable data.
- Exported planning JSON includes import metadata, normalized rows,
  reconciliation decisions, buying-power summary, and tax-planning buckets.
- The app must not log in to Robinhood, scrape Robinhood, handle credentials,
  call unofficial Robinhood APIs, use the Robinhood Crypto Trading API, execute
  orders, automate trading, or present outputs as tax advice or filing
  documents.
