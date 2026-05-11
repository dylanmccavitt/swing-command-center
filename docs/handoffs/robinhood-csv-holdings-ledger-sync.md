# Robinhood CSV Holdings Ledger Sync Handoff

## Status

Implemented on branch `feat/robinhood-csv-holdings-ledger-sync`.

Robinhood CSV import remains file-only and local. The app now supports current
positions CSV rows, stable row fingerprints, duplicate full-history import
skips, accepted-ledger holdings derivation, and a holdings review table in the
Import view. Reviewed holdings can be applied per symbol or in bulk to
`holdings` and `manualLots`.

Follow-up debugging against the user's real account-activity CSV fixed the
missing accept-to-portfolio state transition. Accepting an eligible CSV buy or
position row now syncs the affected symbol into holdings/manual lots
immediately. The Import view's catch-up action is now `Apply accepted rows`,
which syncs already accepted holdings and applies accepted sell rows to buying
power.

Second real-CSV parser pass fixed false unavailable/unsupported values from the
actual account-history export. The parser now skips Robinhood footer/disclaimer
rows, captures `CONV`, `SPL`, and `REC` share quantities as missing-basis
position adjustments, captures `SXCH` security-exchange quantities as
reviewable corporate actions that do not affect holdings automatically, and the
Import preview now shows a cash column using row amount/proceeds instead of
showing buys, dividends, fees, interest, and transfers as proceeds unavailable.

## Next

Branch is implemented and ready for review. Next closeout step is to push/open a
PR, then merge after review and fast-forward canonical `main` if requested.

## Risks

- Do not commit real Robinhood CSV files or account-specific screenshots.
- Missing basis must stay blank; missing share counts must block holdings apply.
- Corporate-action rows must stay conservative: use CSV-provided quantities
  only, do not infer split ratios, transfer intent, share direction, or basis.
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
- `docs/handoffs/robinhood-csv-holdings-ledger-sync.md`

## Checks

- `npm test -- src/lib/robinhoodCsv.test.ts src/lib/robinhoodHoldingsSync.test.ts` -> 2 files / 23 tests passed
- `npm test -- src/lib/robinhoodHoldingsSync.test.ts src/lib/robinhoodCsv.test.ts src/lib/localPersistence.test.ts` -> 3 files / 31 tests passed
- `npm run lint`
- `npm run typecheck`
- `npm test` -> 17 files / 101 tests passed
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
- Browser verification after accept-to-sync fix on `http://127.0.0.1:5181/`:
  with the real local Robinhood account-activity CSV loaded, confirmed 159 rows
  spanning 2018-11-12 to 2026-05-11, accepted/synced rows remained review-gated,
  clicked `Apply accepted rows`, synced HIMS into holdings/manual lots at 25
  shares and 27.34 average cost, reloaded, confirmed Cockpit showed HIMS as a
  modeled holding with live `alpaca iex` data, and confirmed Planner loaded HIMS
  with 25 shares and 27.34 average cost.
- Real local CSV audit after parser fix: `/Users/dylanmccavitt/Downloads/95e4acad-e9c2-59ef-a9b9-df46d3f34266.csv`
  parses as 158 activity rows, 0 unsupported rows, and categories: 39 buys, 22
  sells, 55 dividends, 19 transfers, 11 fees, 4 interest, 6 position/share
  adjustments, and 2 corporate-action security exchanges. The previous 159th row
  was Robinhood's disclaimer footer.
- Browser UI check after parser/display fix: Import preview now labels the
  cash column and shows buy cash amounts, dividend cash, fee cash, interest
  cash, and transfer cash instead of rendering those supplied values as
  proceeds unavailable. The existing in-app preview was cleared during the
  attempted fresh upload; re-upload the Account CSV to hydrate the new 158-row
  normalized state in the browser.
