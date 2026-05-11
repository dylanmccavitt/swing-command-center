# Robinhood CSV Holdings Ledger Sync Handoff

## Status

Implemented on branch `feat/robinhood-csv-holdings-ledger-sync`.

Robinhood CSV import remains file-only and local. The app now supports current
positions CSV rows, stable row fingerprints, duplicate full-history import
skips, accepted-ledger holdings derivation, and a holdings review table in the
Import view. Reviewed holdings can be applied per symbol or in bulk to
`holdings` and `manualLots`.

## Next

Branch is implemented and committed. Next closeout step is to push/open a PR,
then merge after review and fast-forward canonical `main` if requested.

## Risks

- Do not commit real Robinhood CSV files or account-specific screenshots.
- Missing basis must stay blank; missing share counts must block holdings apply.
- Accepted realized gain/loss rows must continue to win over matching
  account-activity sells for sold-position P/L and buying-power math.
- This slice must stay file-only: no login, scraping, credentials, order
  execution, automated trading, or tax advice.

## Files

- `src/lib/robinhoodCsv.ts`
- `src/lib/robinhoodHoldingsSync.ts`
- `src/lib/robinhoodCsv.test.ts`
- `src/lib/robinhoodHoldingsSync.test.ts`
- `src/lib/localPersistence.ts`
- `src/lib/localPersistence.test.ts`
- `src/state/useCommandCenterState.ts`
- `src/views/Import.tsx`
- `src/components/import/RowReviewModal.tsx`
- `docs/architecture.md`
- `docs/decisions/0014-review-gated-robinhood-holdings-ledger-sync.md`
- `README.md`
- `CHANGELOG.md`

## Checks

- `npm test -- --run src/lib/robinhoodCsv.test.ts src/lib/robinhoodCsvVariants.test.ts src/lib/robinhoodCsvMissingBasis.test.ts src/lib/robinhoodHoldingsSync.test.ts src/lib/localPersistence.test.ts` -> 5 files / 27 tests passed
- `npm run lint`
- `npm run typecheck`
- `npm test` -> 17 files / 92 tests passed
- `npm run build`
- `npm run dev -- --port 5180` -> port 5180 was already in use, so Vite served
  the validation app at `http://127.0.0.1:5181/`.
- Browser verification on `http://127.0.0.1:5181/`: opened Import, confirmed
  Account/Positions/Gain-loss CSV controls, holdings review panel, file-only /
  no-credentials / no-automation / no-tax-advice copy, and row-review modal
  basis/realized-gain precedence copy. Also updated an IREN Planner lot,
  reloaded, confirmed the Planner lot persisted, returned to Cockpit, confirmed
  the modeled-holdings count and IREN row reflected the persisted lot, and
  confirmed browser console warnings/errors were empty.
