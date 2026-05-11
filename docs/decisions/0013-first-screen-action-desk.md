# 0013: First-Screen Action Desk

## Chosen

Add a typed first-screen action desk that ranks the next manual workflow steps
from existing local cockpit state.

## Why

The app already stores holdings, lots, research cards, planner fields, sell
fills, Robinhood CSV review rows, and buying-power inputs locally. The usability
gap is that those surfaces are separate: the user has to remember whether the
next useful step is entering lot data, fixing missing basis, queueing Codex
research, importing research output, reviewing concentration, or assigning
available cash. A first-screen action queue makes the cockpit useful on open
without adding broker access or hidden automation.

## Options Considered

- Leave each workflow isolated in its own view.
- Add a generic dashboard checklist with hard-coded copy.
- Add a typed action desk derived from portfolio, sell-fill, research, Codex
  queue, and cash-plan helpers.
- Add broker-connected recommendations or automatic research execution.

## Tradeoffs

The action desk can only be as good as the local data already entered or
imported. It may route the user to planning and research surfaces, but it cannot
decide trades, infer missing private account data, or replace source review.
That keeps the slice useful without crossing the brokerage, advice, or tax
guardrails.

## Consequences

- `src/lib/actionDesk.ts` owns next-action ranking and disclosure copy.
- Cockpit renders the action desk before the deeper scenario/allocation panels.
- Queue rows can create Codex request JSON from the cockpit and route back to
  Research for import/review.
- Missing sell basis and missing holding lots rank ahead of cash redeploy and
  research polish because they block reliable math.
- The feature remains local-first and manual-only: no brokerage login, no
  scraping, no order execution, no automated trading, and no tax advice.
