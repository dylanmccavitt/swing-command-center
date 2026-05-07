import { useEffect, useMemo, useState } from 'react'
import { seedHoldings } from './data/seedHoldings'
import { seedWatchlist } from './data/seedWatchlist'
import {
  createMarketDataProviderFromEnv,
  describeQuoteFreshness,
  getMarketDataSymbols,
  MARKET_DATA_POLL_INTERVAL_MS,
} from './lib/marketData'
import type { MarketDataSnapshot, MarketQuote } from './lib/marketData'
import { buildPortfolioSeedSummary } from './lib/portfolio'
import './App.css'

function App() {
  const summary = buildPortfolioSeedSummary(seedHoldings)
  const marketSymbols = useMemo(
    () =>
      getMarketDataSymbols(
        seedHoldings,
        seedWatchlist.map((item) => item.symbol),
      ),
    [],
  )
  const { snapshot, errorMessage } = useMarketDataSnapshot(marketSymbols)
  const quotesBySymbol = useMemo(() => {
    return new Map(snapshot?.quotes.map((quote) => [quote.symbol, quote]))
  }, [snapshot])
  const marketStatus = snapshot?.sourceLabel ?? 'Loading'
  const marketTimestamp = snapshot
    ? formatTimestamp(snapshot.fetchedAt)
    : 'Waiting for first poll'

  return (
    <main className="app-shell">
      <section className="overview-panel" aria-labelledby="page-title">
        <div className="title-block">
          <p className="eyebrow">Local-first trading cockpit</p>
          <h1 id="page-title">Swing Command Center</h1>
          <p className="lede">
            Manual Robinhood-held portfolio planning with no broker login, no
            order execution, and no credential storage.
          </p>
        </div>

        <div className="status-grid" aria-label="Bootstrap status">
          <div className="metric-tile">
            <span className="metric-label">Seeded symbols</span>
            <strong>{summary.totalSymbols}</strong>
            <span>{summary.symbols.join(', ')}</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Market data</span>
            <strong>{marketStatus}</strong>
            <span>{marketTimestamp}</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Manual lots needed</span>
            <strong>{summary.manualLotsNeeded}</strong>
            <span>shares and cost basis stay local</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Broker access</span>
            <strong>None</strong>
            <span>planning only, no automation</span>
          </div>
        </div>
      </section>

      <section className="market-panel" aria-label="Market data feed">
        <div className="section-heading">
          <p className="eyebrow">Live market feed</p>
          <h2>Holdings and watchlist prices</h2>
        </div>

        <div className="feed-summary">
          <span className={`source-pill ${snapshot?.mode ?? 'loading'}`}>
            {marketStatus}
          </span>
          <span>Updated {marketTimestamp}</span>
          <span>Polls every {MARKET_DATA_POLL_INTERVAL_MS / 1000}s</span>
        </div>

        {(snapshot?.warning || errorMessage) && (
          <p className="market-warning">{snapshot?.warning ?? errorMessage}</p>
        )}

        <div className="quote-grid">
          {marketSymbols.map((symbol) => {
            const quote = quotesBySymbol.get(symbol)
            const label = getSymbolLabel(symbol)

            return (
              <article className="quote-card" key={symbol}>
                <div>
                  <span className="symbol">{symbol}</span>
                  <h3>{label.name}</h3>
                  <p>{label.layer}</p>
                </div>
                <dl>
                  <div>
                    <dt>Mid price</dt>
                    <dd>{formatMarketPrice(quote?.price)}</dd>
                  </div>
                  <div>
                    <dt>Bid / Ask</dt>
                    <dd>{formatBidAsk(quote)}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{formatQuoteSource(quote)}</dd>
                  </div>
                  <div>
                    <dt>Quote time</dt>
                    <dd>
                      {quote ? formatTimestamp(quote.observedAt) : 'Loading'}
                    </dd>
                  </div>
                </dl>
              </article>
            )
          })}
        </div>
      </section>

      <section className="workspace-grid" aria-label="Seeded workspace">
        <div className="section-heading">
          <p className="eyebrow">Current holdings seed</p>
          <h2>Ready for manual position details</h2>
        </div>

        <div className="holding-grid">
          {seedHoldings.map((holding) => (
            <article className="holding-card" key={holding.symbol}>
              <div>
                <span className="symbol">{holding.symbol}</span>
                <h3>{holding.name}</h3>
              </div>
              <p>{holding.thesisTag}</p>
              <dl>
                <div>
                  <dt>Layer</dt>
                  <dd>{holding.stackLayer}</dd>
                </div>
                <div>
                  <dt>Shares</dt>
                  <dd>{holding.shares ?? 'Manual'}</dd>
                </div>
                <div>
                  <dt>Average cost</dt>
                  <dd>{holding.averageCost ?? 'Manual'}</dd>
                </div>
                <div>
                  <dt>Market data</dt>
                  <dd>
                    {formatQuoteSource(quotesBySymbol.get(holding.symbol))}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="guardrail-band" aria-label="Safety guardrails">
        <h2>Bootstrap guardrails</h2>
        <ul>
          <li>Local storage and manual input first.</li>
          <li>Market data is separate from brokerage access.</li>
          <li>No secrets, API keys, account numbers, or trades in repo data.</li>
        </ul>
      </section>
    </main>
  )
}

export default App

function useMarketDataSnapshot(symbols: readonly string[]): {
  snapshot: MarketDataSnapshot | null
  errorMessage: string | null
} {
  const [snapshot, setSnapshot] = useState<MarketDataSnapshot | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const provider = useMemo(() => createMarketDataProviderFromEnv(import.meta.env), [])
  const symbolKey = symbols.join(',')

  useEffect(() => {
    let cancelled = false

    async function refreshQuotes() {
      try {
        const nextSnapshot = await provider.loadLatestQuotes(symbols)

        if (!cancelled) {
          setSnapshot(nextSnapshot)
          setErrorMessage(null)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Market data refresh failed.',
          )
        }
      }
    }

    void refreshQuotes()
    const intervalId = window.setInterval(() => {
      void refreshQuotes()
    }, MARKET_DATA_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [provider, symbolKey, symbols])

  return { snapshot, errorMessage }
}

function getSymbolLabel(symbol: string): { name: string; layer: string } {
  const holding = seedHoldings.find((item) => item.symbol === symbol)

  if (holding) {
    return { name: holding.name, layer: 'Current holding' }
  }

  const watchlistItem = seedWatchlist.find((item) => item.symbol === symbol)

  return {
    name: watchlistItem?.name ?? symbol,
    layer: watchlistItem?.stackLayer ?? 'Watchlist',
  }
}

function formatMarketPrice(price: number | null | undefined): string {
  if (typeof price !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(price)
}

function formatBidAsk(quote: MarketQuote | undefined): string {
  if (!quote) {
    return 'Loading'
  }

  return `${formatMarketPrice(quote.bidPrice)} / ${formatMarketPrice(
    quote.askPrice,
  )}`
}

function formatQuoteSource(quote: MarketQuote | undefined): string {
  if (!quote) {
    return 'Loading'
  }

  return describeQuoteFreshness(quote.freshness)
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}
