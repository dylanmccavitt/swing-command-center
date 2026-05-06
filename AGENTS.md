# Project Flow

## Core Rule

- One issue = one branch = one worktree = one Codex thread.
- Use repo docs for durable context.
- Use `docs/handoffs/` first when resuming work.
- Code and tests win if anything conflicts.

## How To Run

```bash
npm install
npm run dev
```

The dev server binds to `127.0.0.1` through the `dev` script.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run the narrow test or runtime path touched by the change in addition to the
repo-level checks when a slice changes app behavior.

## Coding Rules

- Keep the app local-first and fast to run.
- Prefer typed model/helper functions over duplicating portfolio math in views.
- Keep seed data explicit and small; do not invent share counts, cost basis,
  account numbers, or trade history.
- Keep market data behind a provider boundary as soon as live data is added.
- Keep UI copy direct and action-oriented. This is a working trading cockpit,
  not a marketing site.
- Avoid storing secrets in source, local fixtures, screenshots, or docs.

## Guardrails

- No brokerage login, scraping, credential handling, or order execution.
- No automated trading.
- No tax advice. Tax reserve outputs are estimates/helpers only.
- No Robinhood integration beyond manual input/export planning.
- Treat generated build output, coverage, dependencies, and local env files as
  untracked runtime artifacts.

## Definition Of Done

- The Linear issue acceptance criteria are satisfied.
- Relevant docs and the issue handoff are updated.
- Lint, typecheck, tests, build, and touched runtime checks pass or have a
  clearly documented blocker.
- Work is committed on the issue branch/worktree.
- The next step is clear for the following thread.
