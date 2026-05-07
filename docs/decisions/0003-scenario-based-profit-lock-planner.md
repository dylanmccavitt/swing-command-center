# 0003: Scenario-Based Profit-Lock Planner

## Chosen

Keep portfolio math in typed helpers and render profit-lock outputs as manual
scenario tickets, not recommendations or executable orders.

## Why

The app needs to show concentration risk and concrete ways to lock gains while
staying inside the no-brokerage, no-automation guardrails. Typed helpers make
valuation, concentration thresholds, and tax-reserve estimates testable without
duplicating math in React views. Manual scenario tickets keep the output useful
without implying certainty.

## Options Considered

- Static explanatory copy only.
- View-local calculations inside React components.
- Typed portfolio and profit-lock helpers with manual scenario tickets.
- Brokerage-connected order ticket creation.

## Tradeoffs

The helper-driven planner is more code than a static dashboard, but it creates a
stable math surface for tests and later local persistence. It still requires
manual share and average-cost input because source-controlled seed data must not
invent lot details. It does not create or route real orders.

## Consequences

- Default concentration settings warn at 25% and draft trim scenarios at 30%.
- Tax reserve defaults to a 25% estimate bucket, can be edited, and can be
  disabled.
- Profit-lock scenarios can estimate proceeds, realized gain, reserve, net cash,
  remaining shares, and remaining portfolio weight.
- UI copy must keep these outputs framed as scenario drafts for manual review.
