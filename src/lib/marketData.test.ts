import { describe, expect, it } from 'vitest'
import {
  createMarketDataProvider,
  createMarketDataProviderFromEnv,
  describeQuoteFreshness,
  normalizeAlpacaQuote,
} from './marketData'

describe('market data provider', () => {
  it('normalizes Alpaca quote payloads into midpoint prices', () => {
    const quote = normalizeAlpacaQuote(
      'aapl',
      {
        bp: 100.1,
        ap: 100.3,
        t: '2026-05-06T15:30:00.000Z',
      },
      {
        feed: 'iex',
        receivedAt: new Date('2026-05-06T15:31:00.000Z'),
      },
    )

    expect(quote).toMatchObject({
      symbol: 'AAPL',
      price: 100.2,
      bidPrice: 100.1,
      askPrice: 100.3,
      source: 'alpaca',
      feed: 'iex',
      freshness: 'live_iex',
      note: null,
    })
    expect(describeQuoteFreshness(quote.freshness)).toBe('Live IEX')
  })

  it('marks quotes as cached when the observed timestamp is stale', () => {
    const quote = normalizeAlpacaQuote(
      'NVDA',
      {
        bp: 181.8,
        ap: 182,
        t: '2026-05-06T15:20:00.000Z',
      },
      {
        feed: 'iex',
        receivedAt: new Date('2026-05-06T15:31:00.000Z'),
        staleAfterMs: 5 * 60_000,
      },
    )

    expect(quote.freshness).toBe('cached')
    expect(describeQuoteFreshness(quote.freshness)).toBe('Cached')
  })

  it('uses mock fallback quotes when Alpaca is not configured', async () => {
    const provider = createMarketDataProvider({
      mode: 'auto',
      alpacaAvailable: false,
      now: () => new Date('2026-05-06T15:31:00.000Z'),
    })

    const snapshot = await provider.loadLatestQuotes(['AAPL', 'GOOG'])

    expect(snapshot.provider).toBe('mock')
    expect(snapshot.mode).toBe('fallback')
    expect(snapshot.sourceLabel).toBe('Mock fallback')
    expect(snapshot.warning).toContain('environment variables are missing')
    expect(snapshot.quotes.map((quote) => quote.freshness)).toEqual([
      'mock',
      'mock',
    ])
  })

  it('uses the env readiness flag to enable the Alpaca provider', async () => {
    const provider = createMarketDataProviderFromEnv({
      VITE_ALPACA_MARKET_DATA_FEED: 'iex',
      VITE_ALPACA_MARKET_DATA_PROXY_READY: 'true',
    })

    expect(provider.name).toBe('alpaca')
  })

  it('falls back to mock quotes when Alpaca requests fail', async () => {
    const provider = createMarketDataProvider({
      mode: 'alpaca',
      alpacaAvailable: true,
      feed: 'iex',
      fetch: async () => new Response(null, { status: 401 }),
      now: () => new Date('2026-05-06T15:31:00.000Z'),
    })

    const snapshot = await provider.loadLatestQuotes(['IREN'])

    expect(snapshot.provider).toBe('mock')
    expect(snapshot.mode).toBe('fallback')
    expect(snapshot.warning).toContain('401')
    expect(snapshot.quotes[0]).toMatchObject({
      symbol: 'IREN',
      source: 'mock',
      freshness: 'mock',
    })
  })
})
