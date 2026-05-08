# 0012: Versioned Local State Persistence

## Chosen

Persist user-entered Swing Command Center state in browser `localStorage`
through one typed, versioned persistence boundary.

## Why

The MVP already depends on manual inputs across holdings, lots, research cards,
scenario settings, journal rows, sell fills, Robinhood CSV review decisions,
buying power, and pay-yourself settings. Losing that state on reload makes the
cockpit unreliable, but adding a backend or account sync would cross the
current local-first boundary.

## Options Considered

- Keep browser-session state only.
- Scatter small `localStorage` reads and writes across React components.
- Use one typed local persistence snapshot with schema validation and reset.
- Add cloud sync or brokerage/account-backed storage.

## Tradeoffs

A single snapshot means any unsupported schema version blocks hydration until
the user resets local state. That is intentional: it is safer than partially
loading malformed financial planning state. The app still autosaves frequently,
but validation and reset behavior live in one module instead of being duplicated
through the view.

## Consequences

- `src/lib/localPersistence.ts` owns the storage key, schema version, load,
  save, clear, serialization, and validation behavior.
- Invalid JSON, unsupported versions, or malformed core arrays fail visibly and
  do not replace the current seed/default app state.
- Missing optional UI fields can hydrate from defaults with warnings.
- Robinhood rows keep their review states after reload. Pending and rejected
  rows still do not affect buying power, pay-yourself, reinvest cash, or tax
  planning.
- Reset is deliberate and visible from the settings panel.
- The app remains local-only: no broker login, no credentials, no order
  execution, no automated trading, no cloud sync, and no tax-advice framing.
