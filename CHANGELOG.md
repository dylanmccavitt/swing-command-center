# Changelog

## 2026-05-11

- Hardened Robinhood CSV parsing for account-activity and realized gain/loss
  header variants, including sale proceeds, adjusted basis, quantity sold,
  disposed date, net cash amount, security description, and disallowed loss
  fields.
- Added focused synthetic CSV tests for header aliases, multiline descriptions,
  amount formats, missing-basis proceeds, realized gain/loss precedence,
  wash-sale fields, and accept/reject gating.
- Clarified Import review copy so accepted proceeds-only sells stay separate
  from recognized realized P/L, reserve, and pay-myself calculations until basis
  is present.

## 2026-05-09

- Redesigned the app into a Claude-Code-style command center shell with Cockpit,
  Research, Planner, Journal, Cash plan, and Import views.
- Added a visible holdings/lots editor in Planner for adding symbols and
  updating shares or average cost.
- Added a General watchlist research lane, HIMS research card, arbitrary ticker
  tracking, and live quote display for research cards.
- Made Robinhood CSV row review visible with accepted/rejected counts and
  clearer apply behavior.
- Clarified Robinhood account activity CSV behavior so missing cost basis is
  shown as missing, not as confirmed $0 realized P/L, reserve, or pay-myself.
- Regenerated README screenshots from the current redesigned app.
- Added offline Geist font loading, dark/light theme tokens, reusable primitive
  components, keyboard navigation, and a command palette.
- Preserved local-first market, research, journal, cash-plan, and Robinhood CSV
  behavior behind the existing `src/lib` boundaries.
