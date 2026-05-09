# Redesign Command Center Handoff

## Status

Implemented the full redesign on branch `dylan/modest-mestorf-df80c0`.

The app now uses the prototype shell and six-view cockpit:
Cockpit, Research, Planner, Journal, Cash plan, and Import. Planner includes a
manual holdings/lots editor for adding symbols and updating shares or average
cost. Follow-up import debugging fixed Robinhood account activity CSV parsing
for quoted multi-line CUSIP descriptions and keeps failed imports from falling
back to fixture rows. Import also has a clear action for removing bad local CSV
rows before re-uploading. Research now includes a General watchlist lane, HIMS,
arbitrary ticker tracking, and live quote display for research cards. The
redesign keeps UI state wiring behind typed state hooks. Follow-up CSV review
clarity now separates account-activity proceeds from recognized realized P/L:
accepted account-activity sells without basis count as redeployable proceeds
but explicitly show missing basis, $0 reserve, and $0 pay-myself until a
realized gain/loss CSV row or manual basis is present. README screenshots were
regenerated from the running redesigned app.

## Next

Branch is ready to merge after the final push/PR merge step requested by the
user.

## Risks

- The redesign adds accessible contrast adjustments for tertiary text and
  primary button text so axe and Lighthouse can pass; geometry and layout still
  match the prototype.
- The seed UI uses local default lots for AAPL and NVDA so the prototype's
  modeled dashboard renders without changing source seed data.
- Robinhood CSV exports can contain line breaks inside quoted description
  cells. Keep parser changes covered by `src/lib/robinhoodCsv.test.ts`.
- Existing saved local state is merged with new default research cards so HIMS
  appears without wiping user-entered notes.
- Robinhood account-activity CSV exports do not include realized gain/loss or
  cost basis. Do not infer those values from proceeds alone.

## Files

- `src/App.tsx`
- `src/main.tsx`
- `src/styles/tokens.css`
- `src/styles/global.css`
- `src/hooks/`
- `src/shell/`
- `src/views/`
- `src/state/`
- `src/components/`
- `src/components/HoldingsEditor.tsx`
- `src/data/seedWatchlist.ts`
- `src/lib/localPersistence.ts`
- `src/lib/researchProvider.ts`
- `src/lib/robinhoodCsv.ts`
- `src/lib/robinhoodCsvMissingBasis.test.ts`
- `src/lib/localPersistence.test.ts`
- `src/lib/researchProvider.test.ts`
- `src/lib/researchWatchlist.test.ts`
- `src/lib/robinhoodCsv.test.ts`
- `docs/screenshots/dashboard.png`
- `docs/screenshots/research.png`
- `docs/screenshots/journal.png`
- `README.md`
- `CHANGELOG.md`

## Checks

- `npm run lint`
- `npm run typecheck`
- `npm test -- --run src/lib/robinhoodCsv.test.ts`
- `npm test -- --run src/lib/localPersistence.test.ts src/lib/researchWatchlist.test.ts src/lib/researchProvider.test.ts src/lib/robinhoodCsv.test.ts`
- `npm test -- --run`
- `npm run build`
- `VITE_MARKET_DATA_MODE=mock npm run dev -- --port 5177`
- Playwright visual/a11y probe against `docs/prototypes/redesign.html`
