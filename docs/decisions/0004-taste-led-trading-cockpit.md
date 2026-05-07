# 0004: Taste-Led Trading Cockpit

## Chosen

Use a dense, border-separated cockpit layout with typed derived chart rows and
manual scenario ranking instead of stacked marketing sections or generic admin
cards.

## Why

The app needs to be legible under market pressure. The first screen should show
portfolio value, unrealized gain, cash/runway target, concentration risk, top
manual profit-lock scenarios, allocation, and watchlist movement without making
the user scroll through explanatory copy. Keeping chart data in typed helpers
also lets tests cover the high-level cockpit summaries without moving portfolio
math into React views.

## Options Considered

- Keep the existing stacked panel layout and add chart cards.
- Add a third-party charting library.
- Render dense CSS/HTML chart rows from typed local helpers.
- Build a brokerage-style order entry cockpit.

## Tradeoffs

CSS/HTML charts are less feature-rich than a charting package, but they avoid
new dependencies and are enough for the MVP allocation, gains, concentration,
and session movement views. The cockpit does not include order controls because
the repo guardrails prohibit automated trading and brokerage execution.

## Consequences

- First-screen summaries come from `src/lib/cockpit.ts`.
- Numbers use monospace styling and chart sections use restrained neutral
  surfaces with one primary accent.
- Loading, empty, stale-data, and error/fallback states are part of the main
  cockpit surface.
- Profit-lock scenario lists remain manual planning outputs only.
