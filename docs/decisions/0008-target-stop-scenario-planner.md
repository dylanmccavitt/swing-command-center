# 0008: Target/Stop Scenario Planner

## Chosen

Add a typed target/stop scenario planner that reuses current holdings and
research cards, accepts editable planning inputs, and renders manual review
levels with calculation reasons.

## Why

The cockpit needs to translate a holding or watchlist idea into concrete levels
without crossing into brokerage actions or recommendations. Keeping the math in
`src/lib/scenarioPlanner.ts` makes stop, target, trim, proceeds, gain/loss, and
remaining-position calculations testable outside React, while the UI can stay
focused on editable review fields.

## Options Considered

- Extend the existing profit-lock tickets only.
- Add view-local calculations in the scenario desk.
- Add a typed helper plus a target/stop planner UI.
- Add brokerage-connected order ticket generation.

## Tradeoffs

The helper adds a second planning surface next to the existing profit-lock
tickets, but the distinction is useful: profit-lock tickets rank current
position trims, while the target/stop planner drafts explicit levels for either
holdings or research cards. The planner still depends on manual inputs for cost
basis, shares, support, risk, and time horizon because source-controlled data
must not invent private lot details.

## Consequences

- Planned entry, stop, stop-limit buffer, first target, stretch target, trim
  size, estimated proceeds, estimated gain/loss, and remaining position are
  produced by typed helper code.
- Missing cost basis, missing/stale market data, invalid risk/reward, and stops
  above planned entry are surfaced as guardrails.
- Output copy remains manual scenario review only: no guaranteed outcomes, tax
  advice, order tickets, brokerage integration, or buy/sell instructions.
