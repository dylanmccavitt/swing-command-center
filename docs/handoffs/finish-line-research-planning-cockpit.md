# Finish-Line Research Planning Cockpit Handoff

## Status

Implemented a user-directed finish-line slice on branch
`feat/finish-line-research-planning-cockpit`.

The app now has a typed first-screen decision desk. It derives next actions
from persisted local cockpit state instead of adding a new storage or broker
layer. The desk ranks missing sell basis, available buying power, missing lot
inputs, concentration trim scenarios, and Codex research queue/import/review
work. Cockpit action buttons route into the existing Import, Cash plan, Planner,
and Research workflows; Codex rows can create the local request JSON directly
from Cockpit.

## Next

If this continues in a follow-up thread, the next useful product step is making
the Codex queue worker loop even smoother, such as a paste-ready request/result
handoff panel or a local CLI that validates result JSON before import.

## Risks

- The app still stays browser-local. Saved holdings persist when the user opens
  the same local origin; this slice does not add cloud sync or a database.
- The action desk is prioritization and routing only. It does not recommend
  buys/sells, place orders, scrape broker data, or provide tax advice.
- Browser verification used mock market data on `127.0.0.1:5180` with desktop
  and mobile screenshots.

## Files

- `src/lib/actionDesk.ts`
- `src/lib/actionDesk.test.ts`
- `src/state/useCommandCenterState.ts`
- `src/views/Cockpit.tsx`
- `src/App.tsx`
- `src/styles/global.css`
- `docs/architecture.md`
- `docs/decisions/0013-first-screen-action-desk.md`
- `docs/handoffs/finish-line-research-planning-cockpit.md`
- `README.md`
- `CHANGELOG.md`

## Checks

- `npm test -- --run src/lib/actionDesk.test.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `VITE_MARKET_DATA_MODE=mock npm run dev -- --port 5180`
- `npx --yes playwright screenshot --viewport-size=1440,1000 http://127.0.0.1:5180 /tmp/scc-action-desk.png`
- `npx --yes playwright screenshot --full-page --viewport-size=390,900 http://127.0.0.1:5180 /tmp/scc-action-desk-mobile-full-2.png`
