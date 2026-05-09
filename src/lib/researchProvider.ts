import {
  getAiStackLayerLabel,
  type AiStackLayerId,
  type ResearchFields,
  type SeedWatchlistItem,
} from '../data/seedWatchlist'

export type ResearchSourceType =
  | 'recent_news'
  | 'investor_relations'
  | 'sec_filings'
  | 'earnings_call'
  | 'sector_context'
  | 'analyst_context'

export type ResearchSourceFreshness = 'fresh' | 'stale'

export type ResearchSource = {
  id: string
  symbol: string
  type: ResearchSourceType
  title: string
  url: string
  summary: string
  observedAt: string
  retrievedAt: string
  freshness: ResearchSourceFreshness
}

export type ResearchContextStatus = 'ready' | 'empty_source' | 'stale_source'

export type ResearchContextBundle = {
  symbol: string
  name: string
  stackLayer: AiStackLayerId
  layerLabel: string
  generatedAt: string
  sources: ResearchSource[]
  status: ResearchContextStatus
  warning: string | null
}

export type ResearchProvider = {
  name: 'curated_ai_stack'
  loadResearchContext: (
    symbols: readonly string[],
  ) => Promise<ResearchContextBundle[]>
}

export type ResearchProviderConfig = {
  cards: readonly SeedWatchlistItem[]
  now?: () => Date
  sourceObservedAt?: () => Date
  staleAfterMs?: number
}

export type ResearchDraftFields = Pick<
  ResearchFields,
  | 'thesis'
  | 'catalyst'
  | 'invalidation'
  | 'riskNotes'
  | 'sourceNotes'
  | 'plannedEntry'
  | 'stop'
  | 'target'
  | 'reviewDate'
>

export type ResearchDraft = {
  symbol: string
  draftedAt: string
  sourceCount: number
  reviewState: 'needs_review'
  fields: ResearchDraftFields
  disclosure: string
}

type CompanySourceConfig = {
  investorUrl: string
  earningsUrl: string
}

type LayerContext = {
  url: string
  title: string
  focus: string
  risk: string
}

const DEFAULT_STALE_AFTER_MS = 72 * 60 * 60 * 1000
const DEFAULT_REVIEW_DAYS = 7

export const RESEARCH_DRAFT_DISCLOSURE =
  'Draft research notes for manual review only. Not a recommendation, rating, guaranteed outcome, or buy/sell instruction.'

const COMPANY_SOURCES: Record<string, CompanySourceConfig> = {
  AAPL: {
    investorUrl: 'https://investor.apple.com/',
    earningsUrl: 'https://investor.apple.com/investor-relations/default.aspx',
  },
  GOOG: {
    investorUrl: 'https://abc.xyz/investor/',
    earningsUrl: 'https://abc.xyz/investor/earnings/',
  },
  NVDA: {
    investorUrl: 'https://investor.nvidia.com/',
    earningsUrl: 'https://investor.nvidia.com/events-and-presentations/',
  },
  IREN: {
    investorUrl: 'https://investors.iren.com/',
    earningsUrl: 'https://investors.iren.com/news-events/events',
  },
  AMD: {
    investorUrl: 'https://ir.amd.com/',
    earningsUrl: 'https://ir.amd.com/news-events/ir-calendar',
  },
  TSM: {
    investorUrl: 'https://investor.tsmc.com/english',
    earningsUrl: 'https://investor.tsmc.com/english/quarterly-results',
  },
  MU: {
    investorUrl: 'https://investors.micron.com/',
    earningsUrl: 'https://investors.micron.com/events-and-presentations',
  },
  ASML: {
    investorUrl: 'https://www.asml.com/en/investors',
    earningsUrl: 'https://www.asml.com/en/investors/financial-results',
  },
  SNPS: {
    investorUrl: 'https://investor.synopsys.com/',
    earningsUrl: 'https://investor.synopsys.com/events-and-presentations',
  },
  ANET: {
    investorUrl: 'https://investors.arista.com/',
    earningsUrl: 'https://investors.arista.com/events-and-presentations',
  },
  VRT: {
    investorUrl: 'https://investors.vertiv.com/',
    earningsUrl: 'https://investors.vertiv.com/events-and-presentations',
  },
  CEG: {
    investorUrl: 'https://investors.constellationenergy.com/',
    earningsUrl: 'https://investors.constellationenergy.com/news-and-events',
  },
}

const LAYER_CONTEXT: Record<AiStackLayerId, LayerContext> = {
  hyperscalers: {
    url: 'https://www.statista.com/topics/11185/artificial-intelligence-ai-in-cloud-computing/',
    title: 'Cloud AI demand context',
    focus: 'AI capex returns, cloud growth, model distribution, and product adoption',
    risk: 'capex intensity, regulation, search disruption, and margin pressure',
  },
  gpu_chip_designers: {
    url: 'https://www.semiconductors.org/',
    title: 'Semiconductor demand context',
    focus: 'accelerator demand, product cadence, supply allocation, and software ecosystem durability',
    risk: 'cycle resets, export controls, crowded positioning, and gross-margin pressure',
  },
  foundries: {
    url: 'https://www.semiconductors.org/',
    title: 'Foundry and advanced-node context',
    focus: 'advanced-node utilization, packaging constraints, AI chip backlog, and customer concentration',
    risk: 'geopolitical exposure, capex timing, and utilization swings',
  },
  memory: {
    url: 'https://www.semiconductors.org/',
    title: 'Memory and HBM context',
    focus: 'HBM demand, pricing recovery, AI server memory content, and supply discipline',
    risk: 'memory-price cyclicality, inventory corrections, and capex timing',
  },
  semiconductor_equipment: {
    url: 'https://www.semi.org/en/market-data',
    title: 'Semiconductor equipment context',
    focus: 'wafer-fab equipment demand, backlog quality, advanced-node capex, and export restrictions',
    risk: 'long-cycle order pauses, China controls, and customer capex resets',
  },
  eda_ip: {
    url: 'https://www.semi.org/en/market-data',
    title: 'EDA and custom silicon context',
    focus: 'design starts, custom AI silicon activity, IP attach, and AI-assisted design tooling',
    risk: 'software multiple compression, deal integration, and slower design starts',
  },
  networking: {
    url: 'https://www.ethernetalliance.org/',
    title: 'AI networking context',
    focus: 'AI cluster networking demand, Ethernet adoption, cloud capex, and customer concentration',
    risk: 'hyperscaler digestion periods, margin compression, and product-cycle misses',
  },
  power_cooling: {
    url: 'https://datacenters.lbl.gov/',
    title: 'Data-center power and cooling context',
    focus: 'rack density, thermal management demand, backlog growth, and execution against AI buildouts',
    risk: 'industrial cycle exposure, supply constraints, and elevated expectations',
  },
  data_centers: {
    url: 'https://datacenters.lbl.gov/',
    title: 'Data-center infrastructure context',
    focus: 'power access, utilization, financing, customer demand, and AI workload conversion',
    risk: 'funding needs, power economics, construction execution, and utilization gaps',
  },
  energy: {
    url: 'https://www.eia.gov/electricity/',
    title: 'Power demand context',
    focus: 'data-center power demand, contract duration, generation scarcity, and grid policy',
    risk: 'regulatory resets, commodity exposure, and demand expectation reversals',
  },
  general_watchlist: {
    url: 'https://www.sec.gov/search-filings',
    title: 'General equity research context',
    focus: 'company news, filings, earnings commentary, valuation, and thesis fit',
    risk: 'thesis drift, regulatory issues, margin pressure, competition, and valuation resets',
  },
}

export function createCuratedResearchProvider(
  config: ResearchProviderConfig,
): ResearchProvider {
  const now = config.now ?? (() => new Date())
  const sourceObservedAt = config.sourceObservedAt ?? now
  const staleAfterMs = config.staleAfterMs ?? DEFAULT_STALE_AFTER_MS
  const cardBySymbol = new Map(
    config.cards.map((card) => [normalizeSymbol(card.symbol), card]),
  )

  return {
    name: 'curated_ai_stack',
    loadResearchContext: async (symbols) => {
      const requestedAt = now()

      return normalizeSymbols(symbols).map((symbol) => {
        const card = cardBySymbol.get(symbol)

        if (!card) {
          return buildEmptyBundle(symbol, requestedAt)
        }

        const observedAt = sourceObservedAt()
        const sources = buildResearchSources({
          card,
          observedAt,
          retrievedAt: requestedAt,
          staleAfterMs,
        })
        const staleSources = sources.filter(
          (source) => source.freshness === 'stale',
        )
        const allSourcesStale =
          sources.length > 0 && staleSources.length === sources.length

        return {
          symbol: card.symbol,
          name: card.name,
          stackLayer: card.stackLayer,
          layerLabel: getAiStackLayerLabel(card.stackLayer),
          generatedAt: requestedAt.toISOString(),
          sources,
          status: allSourcesStale ? 'stale_source' : 'ready',
          warning: allSourcesStale
            ? 'All source timestamps are older than the freshness window.'
            : null,
        }
      })
    },
  }
}

export function buildResearchDraftFromBundle(
  bundle: ResearchContextBundle,
  options: { draftedAt?: Date; reviewDays?: number } = {},
): ResearchDraft | null {
  if (bundle.sources.length === 0) {
    return null
  }

  const draftedAt = options.draftedAt ?? new Date(bundle.generatedAt)
  const reviewDate = addDays(
    draftedAt,
    options.reviewDays ?? DEFAULT_REVIEW_DAYS,
  )
  const layerContext = LAYER_CONTEXT[bundle.stackLayer]

  return normalizeResearchDraft({
    symbol: bundle.symbol,
    draftedAt: draftedAt.toISOString(),
    sourceCount: bundle.sources.length,
    reviewState: 'needs_review',
    disclosure: RESEARCH_DRAFT_DISCLOSURE,
    fields: {
      thesis: `Check whether ${bundle.name} still fits your ${bundle.layerLabel.toLowerCase()} bucket by reviewing company updates, filings, earnings comments, and current sector news.`,
      catalyst: `Watch sourced updates around ${layerContext.focus}. Use company materials first before turning this into a setup.`,
      invalidation: `Rewrite the idea if sourced checks show ${layerContext.risk}, or if company commentary no longer supports the AI role.`,
      riskNotes: `Main risks to verify: ${layerContext.risk}. Treat this as a draft until you review the source notes.`,
      sourceNotes: formatSourceNotes(bundle),
      plannedEntry: '',
      stop: '',
      target: '',
      reviewDate: formatDateInput(reviewDate),
    },
  })
}

export function normalizeResearchDraft(draft: ResearchDraft): ResearchDraft {
  const draftedAt = normalizeIsoDate(draft.draftedAt)

  return {
    ...draft,
    symbol: normalizeSymbol(draft.symbol),
    draftedAt,
    disclosure: normalizeText(draft.disclosure || RESEARCH_DRAFT_DISCLOSURE),
    fields: {
      thesis: normalizeText(draft.fields.thesis),
      catalyst: normalizeText(draft.fields.catalyst),
      invalidation: normalizeText(draft.fields.invalidation),
      riskNotes: normalizeText(draft.fields.riskNotes),
      sourceNotes: normalizeSourceNotes(draft.fields.sourceNotes),
      plannedEntry: normalizeText(draft.fields.plannedEntry),
      stop: normalizeText(draft.fields.stop),
      target: normalizeText(draft.fields.target),
      reviewDate: normalizeDateInput(draft.fields.reviewDate, draftedAt),
    },
  }
}

export function describeResearchSourceType(type: ResearchSourceType): string {
  switch (type) {
    case 'recent_news':
      return 'Recent news'
    case 'investor_relations':
      return 'Investor relations'
    case 'sec_filings':
      return 'SEC filings'
    case 'earnings_call':
      return 'Earnings calls'
    case 'sector_context':
      return 'Sector context'
    case 'analyst_context':
      return 'Analyst context'
  }
}

function buildResearchSources(input: {
  card: SeedWatchlistItem
  observedAt: Date
  retrievedAt: Date
  staleAfterMs: number
}): ResearchSource[] {
  const sourceConfig = COMPANY_SOURCES[input.card.symbol]
  const layerContext = LAYER_CONTEXT[input.card.stackLayer]
  const sources = [
    buildSource({
      ...input,
      type: 'recent_news',
      title: `${input.card.symbol} recent company news`,
      url: `https://finance.yahoo.com/quote/${input.card.symbol}/news`,
      summary:
        'Open recent headlines for company-specific demand, margin, product, regulatory, or financing updates.',
    }),
  ]

  if (sourceConfig) {
    sources.push(
      buildSource({
        ...input,
        type: 'investor_relations',
        title: `${input.card.name} investor relations`,
        url: sourceConfig.investorUrl,
        summary:
          'Use company materials for presentations, quarterly releases, event decks, and official guidance.',
      }),
    )
  }

  sources.push(
    buildSource({
      ...input,
      type: 'sec_filings',
      title: `${input.card.symbol} SEC filing search`,
      url: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(
        input.card.symbol,
      )}`,
      summary:
        'Review recent 10-K, 10-Q, 8-K, and foreign issuer filings where available before relying on the draft.',
    }),
  )

  if (sourceConfig) {
    sources.push(
      buildSource({
        ...input,
        type: 'earnings_call',
        title: `${input.card.name} earnings materials`,
        url: sourceConfig.earningsUrl,
        summary:
          'Check latest results, prepared remarks, call materials, and management commentary for catalyst and risk updates.',
      }),
    )
  }

  sources.push(
    buildSource({
      ...input,
      type: 'sector_context',
      title: layerContext.title,
      url: layerContext.url,
      summary: `Use sector context for ${layerContext.focus}.`,
    }),
  )

  return sources
}

function buildSource(
  input: {
    card: SeedWatchlistItem
    type: ResearchSourceType
    title: string
    url: string
    summary: string
  } & Parameters<typeof buildResearchSources>[0],
): ResearchSource {
  return {
    id: `${input.card.symbol}-${input.type}`,
    symbol: input.card.symbol,
    type: input.type,
    title: input.title,
    url: input.url,
    summary: input.summary,
    observedAt: input.observedAt.toISOString(),
    retrievedAt: input.retrievedAt.toISOString(),
    freshness: isStale(input.observedAt, input.retrievedAt, input.staleAfterMs)
      ? 'stale'
      : 'fresh',
  }
}

function buildEmptyBundle(
  symbol: string,
  generatedAt: Date,
): ResearchContextBundle {
  return {
    symbol,
    name: symbol,
    stackLayer: 'hyperscalers',
    layerLabel: getAiStackLayerLabel('hyperscalers'),
    generatedAt: generatedAt.toISOString(),
    sources: [],
    status: 'empty_source',
    warning: 'No transparent sources are configured for this symbol.',
  }
}

function formatSourceNotes(bundle: ResearchContextBundle): string {
  const sourceLines = bundle.sources.map((source) => {
    const label = describeResearchSourceType(source.type)

    return `${label}: ${source.title} (${source.url}) retrieved ${source.retrievedAt}; ${source.summary}`
  })

  return [
    ...sourceLines,
    `Draft state: draft notes, needs your review. ${RESEARCH_DRAFT_DISCLOSURE}`,
  ].join('\n')
}

function normalizeSymbols(symbols: readonly string[]): string[] {
  return Array.from(new Set(symbols.map(normalizeSymbol).filter(Boolean)))
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeSourceNotes(value: string): string {
  return value
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .join('\n')
}

function normalizeIsoDate(value: string): string {
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString()
}

function normalizeDateInput(value: string, draftedAt: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (!Number.isNaN(parsed.getTime())) {
    return formatDateInput(parsed)
  }

  return formatDateInput(addDays(new Date(draftedAt), DEFAULT_REVIEW_DAYS))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isStale(observedAt: Date, retrievedAt: Date, staleAfterMs: number) {
  return retrievedAt.getTime() - observedAt.getTime() > staleAfterMs
}
