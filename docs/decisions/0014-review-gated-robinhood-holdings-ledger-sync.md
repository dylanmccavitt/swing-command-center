# 0014: Review-Gated Robinhood Holdings and Ledger Sync

## Chosen

Extend the local Robinhood CSV layer so current positions CSVs and accepted
account-activity ledger rows can derive holdings/lots behind a separate review
gate. Stable row fingerprints dedupe newer full-history CSV exports before any
portfolio state changes.

## Why

Periodic Robinhood CSV exports should become the main update path for holdings
without adding broker credentials, scraping, order execution, or automated
trading. Current positions files, when available, are the cleanest source for
shares and basis. Full account activity files are still useful as a ledger, but
only where the accepted rows carry enough quantity and basis data to project a
position without guessing.

## Options Considered

- Keep current holdings entry fully manual.
- Import current positions directly into holdings with no review step.
- Treat account activity rows as a deduped ledger and derive holdings only from
  accepted rows.
- Connect to Robinhood through login, scraping, unofficial APIs, or trading APIs.

## Tradeoffs

The review layer means importing a CSV is a two-step flow: accept rows, then
apply reviewed holdings. That keeps the portfolio from changing silently and
lets missing basis stay visible. Ledger-derived positions are conservative:
they require accepted buy/sell quantities and enough basis to compute average
cost; unsupported transfers, splits, and missing quantities are not inferred.

## Consequences

- Current positions CSV rows normalize as `position` rows and can update shares
  plus average cost after review.
- Full account activity re-imports use stable fingerprints so previously
  imported rows keep their review decisions and do not duplicate.
- Accepted realized gain/loss rows continue to take precedence over matching
  account-activity sells for sold-position realized P/L and sell-fill buying
  power.
- Missing basis applies shares with average cost left blank; missing shares
  block applying the derived holding.
- Import batches, row decisions, holdings review decisions, and applied
  holdings/lots persist through the existing local storage boundary.
- The app remains file-only and local-first: no Robinhood login, credentials,
  scraping, unofficial APIs, Crypto Trading API, order execution, automated
  trading, or tax-advice framing.
