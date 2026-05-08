# Swing Command Center

Swing Command Center is a local-first trading dashboard I made to organize
manual swing trades.

It helps me:

- see current holdings and watchlist movement
- add the stocks I actually want to track
- enter my own shares and cost basis
- review position size and ways to lock in gains
- draft manual trade checklists
- journal planned trades, executed trades, mistakes, results, realized P/L, and
  tax notes
- plan where realized profit could go after reserve and paying myself
- queue stock research prompts for Codex or ChatGPT, then import reviewed
  research notes back into the dashboard

It does not connect to Robinhood, store broker credentials, place orders,
automate trading, or provide tax advice. Everything is for manual planning and
review.

## Screenshots

![Dashboard overview](docs/screenshots/dashboard.png)

![Research card and Codex queue](docs/screenshots/research.png)

![Manual tickets and journal](docs/screenshots/journal.png)

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Open the local URL Vite prints, usually:

```text
http://127.0.0.1:5173/
```

## Optional Market Data

The app can run with mock quotes. To use Alpaca Market Data locally, create a
`.env.local` file:

```bash
VITE_MARKET_DATA_MODE=auto
VITE_ALPACA_MARKET_DATA_FEED=iex
ALPACA_MARKET_DATA_API_KEY_ID=your_key
ALPACA_MARKET_DATA_SECRET_KEY=your_secret
```

Do not commit `.env.local`.

## How I Use It

1. Add the holdings I want to model, then enter shares and average cost.
2. Review portfolio value, unrealized P/L, position size, and watchlist
   movement.
3. Use the plan builder to draft gain-lock or price plans.
4. Turn plans into manual trade tickets.
5. Add journal entries after planning or manually executing a trade.
6. Review the profit cash plan after realized gains are logged.
7. Export journal data when I want a tax review summary.
8. Use the Codex research queue when I want a structured research prompt and an
   import path for reviewed notes.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
