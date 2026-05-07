export type MarketDataFeed =
  | 'iex'
  | 'sip'
  | 'delayed_sip'
  | 'boats'
  | 'overnight'
  | 'mock'

export type MarketDataMode = 'auto' | 'alpaca' | 'mock'

export type QuoteFreshness =
  | 'live_iex'
  | 'live_sip'
  | 'delayed'
  | 'cached'
  | 'mock'

export type MarketQuote = {
  symbol: string
  price: number | null
  bidPrice: number | null
  askPrice: number | null
  observedAt: string
  receivedAt: string
  source: 'alpaca' | 'mock'
  feed: MarketDataFeed
  freshness: QuoteFreshness
  note: string | null
}

export type MarketDataSnapshot = {
  provider: 'alpaca' | 'mock'
  mode: 'live' | 'fallback' | 'mock'
  sourceLabel: string
  fetchedAt: string
  quotes: MarketQuote[]
  warning: string | null
}

export type AlpacaQuotePayload = {
  t?: string
  bp?: number
  ap?: number
  bs?: number
  as?: number
}

export type MarketDataProvider = {
  name: 'alpaca' | 'mock'
  loadLatestQuotes: (symbols: readonly string[]) => Promise<MarketDataSnapshot>
}

export type MarketDataProviderConfig = {
  mode?: string
  feed?: string
  proxyBaseUrl?: string
  alpacaAvailable?: boolean
  fetch?: typeof fetch
  now?: () => Date
  staleAfterMs?: number
}

type AlpacaLatestQuotesResponse = {
  quotes?: Record<string, AlpacaQuotePayload | undefined>
}

type NormalizeAlpacaQuoteOptions = {
  feed: MarketDataFeed
  receivedAt: Date
  staleAfterMs?: number
}

const DEFAULT_ALPACA_PROXY_BASE_URL = '/api/market-data/alpaca'
export const MARKET_DATA_POLL_INTERVAL_MS = 60_000
export const MARKET_DATA_STALE_AFTER_MS = 5 * 60_000

const MOCK_PRICE_BY_SYMBOL: Record<string, number> = {
  AAPL: 196.12,
  GOOG: 186.4,
  NVDA: 181.88,
  IREN: 8.32,
}

export function createMarketDataProvider(
  config: MarketDataProviderConfig = {},
): MarketDataProvider {
  const mode = normalizeMode(config.mode)
  const feed = normalizeFeed(config.feed)
  const now = config.now ?? (() => new Date())

  if (mode === 'mock') {
    return createMockMarketDataProvider(now)
  }

  if (!config.alpacaAvailable) {
    return createFallbackMarketDataProvider(
      now,
      'Alpaca market-data environment variables are missing.',
    )
  }

  return createAlpacaMarketDataProvider({
    feed,
    proxyBaseUrl: config.proxyBaseUrl ?? DEFAULT_ALPACA_PROXY_BASE_URL,
    fetch: config.fetch ?? globalThis.fetch.bind(globalThis),
    now,
    staleAfterMs: config.staleAfterMs ?? MARKET_DATA_STALE_AFTER_MS,
  })
}

export function createMarketDataProviderFromEnv(
  env: Record<string, string | boolean | undefined>,
): MarketDataProvider {
  return createMarketDataProvider({
    mode: envString(env.VITE_MARKET_DATA_MODE),
    feed: envString(env.VITE_ALPACA_MARKET_DATA_FEED),
    proxyBaseUrl: envString(env.VITE_ALPACA_MARKET_DATA_PROXY_URL),
    alpacaAvailable: envBoolean(env.VITE_ALPACA_MARKET_DATA_PROXY_READY),
  })
}

export function getMarketDataSymbols(
  holdings: readonly { symbol: string }[],
  watchlist: readonly string[] = [],
): string[] {
  return Array.from(
    new Set(
      [...holdings.map((holding) => holding.symbol), ...watchlist]
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
  )
}

export function normalizeAlpacaQuote(
  symbol: string,
  quote: AlpacaQuotePayload,
  options: NormalizeAlpacaQuoteOptions,
): MarketQuote {
  const receivedAt = options.receivedAt
  const observedAt = parseTimestamp(quote.t) ?? receivedAt
  const bidPrice = validPriceOrNull(quote.bp)
  const askPrice = validPriceOrNull(quote.ap)
  const price = normalizeMarketPrice(bidPrice, askPrice)
  const stale = isMarketQuoteStale(
    observedAt,
    receivedAt,
    options.staleAfterMs ?? MARKET_DATA_STALE_AFTER_MS,
  )

  return {
    symbol: symbol.toUpperCase(),
    price,
    bidPrice,
    askPrice,
    observedAt: observedAt.toISOString(),
    receivedAt: receivedAt.toISOString(),
    source: 'alpaca',
    feed: options.feed,
    freshness: classifyFreshness(options.feed, stale),
    note: price === null ? 'No usable bid or ask was returned.' : null,
  }
}

export function isMarketQuoteStale(
  observedAt: Date,
  now: Date,
  staleAfterMs = MARKET_DATA_STALE_AFTER_MS,
): boolean {
  return now.getTime() - observedAt.getTime() > staleAfterMs
}

export function describeQuoteFreshness(freshness: QuoteFreshness): string {
  switch (freshness) {
    case 'live_iex':
      return 'Live IEX'
    case 'live_sip':
      return 'Live SIP'
    case 'delayed':
      return 'Delayed'
    case 'cached':
      return 'Cached'
    case 'mock':
      return 'Mock'
  }
}

function createAlpacaMarketDataProvider(config: {
  feed: MarketDataFeed
  proxyBaseUrl: string
  fetch: typeof fetch
  now: () => Date
  staleAfterMs: number
}): MarketDataProvider {
  return {
    name: 'alpaca',
    loadLatestQuotes: async (symbols) => {
      const requestedSymbols = normalizeSymbols(symbols)

      if (requestedSymbols.length === 0) {
        return buildMockMarketDataSnapshot([], config.now(), null, 'mock')
      }

      try {
        const fetchedAt = config.now()
        const url = buildAlpacaQuotesUrl(
          config.proxyBaseUrl,
          requestedSymbols,
          config.feed,
        )
        const response = await config.fetch(url, {
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Alpaca Market Data returned ${response.status}`)
        }

        const payload = (await response.json()) as AlpacaLatestQuotesResponse
        const quotes = requestedSymbols.map((symbol) => {
          const rawQuote = payload.quotes?.[symbol]

          if (!rawQuote) {
            return buildUnavailableAlpacaQuote(
              symbol,
              config.feed,
              fetchedAt,
              'No quote was returned for this symbol.',
            )
          }

          return normalizeAlpacaQuote(symbol, rawQuote, {
            feed: config.feed,
            receivedAt: fetchedAt,
            staleAfterMs: config.staleAfterMs,
          })
        })

        return {
          provider: 'alpaca',
          mode: 'live',
          sourceLabel: `Alpaca ${describeFeed(config.feed)}`,
          fetchedAt: fetchedAt.toISOString(),
          quotes,
          warning: null,
        }
      } catch (error) {
        return buildMockMarketDataSnapshot(
          requestedSymbols,
          config.now(),
          getFallbackWarning(error),
          'fallback',
        )
      }
    },
  }
}

function createMockMarketDataProvider(now: () => Date): MarketDataProvider {
  return {
    name: 'mock',
    loadLatestQuotes: async (symbols) =>
      buildMockMarketDataSnapshot(normalizeSymbols(symbols), now(), null, 'mock'),
  }
}

function createFallbackMarketDataProvider(
  now: () => Date,
  warning: string,
): MarketDataProvider {
  return {
    name: 'mock',
    loadLatestQuotes: async (symbols) =>
      buildMockMarketDataSnapshot(
        normalizeSymbols(symbols),
        now(),
        warning,
        'fallback',
      ),
  }
}

function buildMockMarketDataSnapshot(
  symbols: readonly string[],
  now: Date,
  warning: string | null,
  mode: 'fallback' | 'mock',
): MarketDataSnapshot {
  return {
    provider: 'mock',
    mode,
    sourceLabel: mode === 'fallback' ? 'Mock fallback' : 'Mock',
    fetchedAt: now.toISOString(),
    quotes: symbols.map((symbol) => buildMockQuote(symbol, now)),
    warning,
  }
}

function buildMockQuote(symbol: string, now: Date): MarketQuote {
  const price = MOCK_PRICE_BY_SYMBOL[symbol] ?? buildStableMockPrice(symbol)

  return {
    symbol,
    price,
    bidPrice: roundPrice(price - 0.03),
    askPrice: roundPrice(price + 0.03),
    observedAt: now.toISOString(),
    receivedAt: now.toISOString(),
    source: 'mock',
    feed: 'mock',
    freshness: 'mock',
    note: 'Development fallback quote.',
  }
}

function buildUnavailableAlpacaQuote(
  symbol: string,
  feed: MarketDataFeed,
  fetchedAt: Date,
  note: string,
): MarketQuote {
  return {
    symbol,
    price: null,
    bidPrice: null,
    askPrice: null,
    observedAt: fetchedAt.toISOString(),
    receivedAt: fetchedAt.toISOString(),
    source: 'alpaca',
    feed,
    freshness: 'cached',
    note,
  }
}

function buildAlpacaQuotesUrl(
  proxyBaseUrl: string,
  symbols: readonly string[],
  feed: MarketDataFeed,
): URL {
  const origin =
    typeof window === 'undefined' ? 'http://127.0.0.1' : window.location.origin
  const baseUrl = proxyBaseUrl.replace(/\/$/, '')
  const url = new URL(`${baseUrl}/v2/stocks/quotes/latest`, origin)
  url.searchParams.set('symbols', symbols.join(','))

  if (feed !== 'mock') {
    url.searchParams.set('feed', feed)
  }

  return url
}

function normalizeSymbols(symbols: readonly string[]): string[] {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter((symbol) => /^[A-Z][A-Z0-9. -]*$/.test(symbol)),
    ),
  )
}

function normalizeMode(mode: string | boolean | undefined): MarketDataMode {
  if (mode === 'alpaca' || mode === 'mock') {
    return mode
  }

  return 'auto'
}

function envString(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function envBoolean(value: string | boolean | undefined): boolean {
  return value === true || value === 'true'
}

function normalizeFeed(feed: string | boolean | undefined): MarketDataFeed {
  if (
    feed === 'sip' ||
    feed === 'delayed_sip' ||
    feed === 'boats' ||
    feed === 'overnight'
  ) {
    return feed
  }

  return 'iex'
}

function normalizeMarketPrice(
  bidPrice: number | null,
  askPrice: number | null,
): number | null {
  if (bidPrice !== null && askPrice !== null) {
    return roundPrice((bidPrice + askPrice) / 2)
  }

  return bidPrice ?? askPrice
}

function validPriceOrNull(price: number | undefined): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null
  }

  return price
}

function parseTimestamp(timestamp: string | undefined): Date | null {
  if (!timestamp) {
    return null
  }

  const parsed = new Date(timestamp)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function classifyFreshness(
  feed: MarketDataFeed,
  stale: boolean,
): QuoteFreshness {
  if (stale) {
    return 'cached'
  }

  if (feed === 'delayed_sip') {
    return 'delayed'
  }

  if (feed === 'iex') {
    return 'live_iex'
  }

  return 'live_sip'
}

function describeFeed(feed: MarketDataFeed): string {
  switch (feed) {
    case 'iex':
      return 'IEX'
    case 'sip':
      return 'SIP'
    case 'delayed_sip':
      return 'delayed SIP'
    case 'boats':
      return 'BOATS'
    case 'overnight':
      return 'overnight'
    case 'mock':
      return 'mock'
  }
}

function buildStableMockPrice(symbol: string): number {
  const score = [...symbol].reduce((sum, character) => {
    return sum + character.charCodeAt(0)
  }, 0)

  return roundPrice(25 + (score % 180) + (score % 17) / 10)
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100
}

function getFallbackWarning(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}; showing mock fallback quotes.`
  }

  return 'Alpaca Market Data was unavailable; showing mock fallback quotes.'
}
