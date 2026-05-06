# 0001: Local-First Vite React App

## Chosen

Use Vite, React, and TypeScript as the local frontend foundation.

## Why

The MVP needs a fast local dashboard with rich UI headroom, typed portfolio
logic, and low setup overhead. Vite keeps the dev loop simple, React is a good
fit for the cockpit-style UI, and TypeScript gives later portfolio math and
market-data provider code a typed base.

## Options Considered

- Vite + React + TypeScript.
- Next.js.
- Electron-first desktop shell.
- Plain static HTML and TypeScript.

## Tradeoffs

Vite does not provide desktop packaging or a backend boundary by default. That
is acceptable for the current local MVP because the next slices can add local
storage, provider adapters, or a desktop wrapper only when needed.

## Consequences

- Local development starts with `npm run dev`.
- Repo checks use ESLint, TypeScript, Vitest, and Vite build.
- Any future secret-bearing market-data calls need a careful boundary before
  credentials are introduced.
