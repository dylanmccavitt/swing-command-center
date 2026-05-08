# 0009: Manual Trade Journal

## Chosen

Add a typed manual trade-ticket and journal boundary for checklist tickets,
browser-session journal entries, realized P/L summaries, configurable
pay-yourself estimates, and tax-helper export JSON.

## Why

The command center needs to help Dylan move from a scenario to a disciplined
manual action and then record what happened without adding brokerage access or
automation. Keeping ticket generation, journal math, pay-yourself rules, and
export shape in `src/lib/tradeJournal.ts` makes the behavior testable and keeps
React focused on local review/editing.

## Options Considered

- Leave profit-lock and target/stop scenarios as read-only outputs.
- Add view-local journal math directly in React.
- Add a typed helper plus local browser-session journal UI.
- Add Robinhood-connected order tickets or broker statement sync.

## Tradeoffs

The journal is not durable storage yet; entries live in the browser session and
the user must export JSON when they want a review artifact. That is acceptable
for this slice because it preserves the no-credentials, no-brokerage,
no-automation boundary while creating a stable data model for later local
persistence.

## Consequences

- Profit-lock scenarios and trade setups can generate manual checklist tickets
  with estimated shares, cash raised or spent, realized gain, reserve, reason,
  invalidation, and checklist copy.
- Journal rows support planned, executed, mistake, and result statuses with
  editable realized P/L, reserve, pay-yourself amount, notes, and tax-prep
  notes.
- Realized-profit summaries exclude planned entries, aggregate executed/mistake
  / result rows, and estimate a default 5% pay-yourself amount from net realized
  trading profit after reserve.
- Export JSON is framed for tax-helper review only. It is not a filing document,
  tax advice, brokerage integration, or order-execution surface.
