# Redesign Command Center Handoff

## Status

Implemented the full redesign on branch `dylan/modest-mestorf-df80c0`.

The app now uses the prototype shell and six-view cockpit:
Cockpit, Research, Planner, Journal, Cash plan, and Import. Planner includes a
manual holdings/lots editor for adding symbols and updating shares or average
cost. Follow-up import debugging fixed Robinhood account activity CSV parsing
for quoted multi-line CUSIP descriptions and keeps failed imports from falling
back to fixture rows. Import also has a clear action for removing bad local CSV
rows before re-uploading. The redesign keeps the locked `src/data` layer
unchanged and moves UI state wiring behind typed state hooks.

## Next

Review the PR after it is opened. Do not merge until the review is complete.

## Risks

- The redesign adds accessible contrast adjustments for tertiary text and
  primary button text so axe and Lighthouse can pass; geometry and layout still
  match the prototype.
- The seed UI uses local default lots for AAPL and NVDA so the prototype's
  modeled dashboard renders without changing source seed data.
- Robinhood CSV exports can contain line breaks inside quoted description
  cells. Keep parser changes covered by `src/lib/robinhoodCsv.test.ts`.

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
- `src/lib/robinhoodCsv.ts`
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
- `npm test -- --run`
- `npm run build`
- `VITE_MARKET_DATA_MODE=mock npm run dev -- --port 5177`
- Playwright visual/a11y probe against `docs/prototypes/redesign.html`
