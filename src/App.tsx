import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ChangeEvent, FormEvent } from 'react'
import { seedHoldings } from './data/seedHoldings'
import type { SeedHolding } from './data/seedHoldings'
import {
  AI_STACK_LAYERS,
  buildManualWatchlistCard,
  getAiStackLayerLabel,
  seedWatchlist,
} from './data/seedWatchlist'
import type {
  AiStackLayerId,
  ResearchFields,
  SeedWatchlistItem,
  TradeSetupFields,
} from './data/seedWatchlist'
import {
  buildAllocationRows,
  buildConcentrationRows,
  buildGainRows,
  buildTopProfitLockScenarios,
  getSymbolColor,
  summarizeCashRunway,
  summarizeConcentrationRisk,
} from './lib/cockpit'
import type {
  AllocationRow,
  ConcentrationRow,
  GainRow,
  ScenarioCandidate,
} from './lib/cockpit'
import {
  createMarketDataProviderFromEnv,
  describeQuoteFreshness,
  getMarketDataSymbols,
  MARKET_DATA_POLL_INTERVAL_MS,
} from './lib/marketData'
import type { MarketDataSnapshot, MarketQuote } from './lib/marketData'
import {
  buildPortfolioModel,
  buildPortfolioSeedSummary,
  DEFAULT_PORTFOLIO_SETTINGS,
} from './lib/portfolio'
import type { PortfolioSettings } from './lib/portfolio'
import {
  buildProfitCashPlan,
  PROFIT_CASH_PLAN_DISCLOSURE,
} from './lib/profitCashPlan'
import type { ProfitCashCandidate, ProfitCashPlan } from './lib/profitCashPlan'
import { buildProfitLockTickets } from './lib/profitLock'
import type { ProfitLockTicket } from './lib/profitLock'
import {
  buildTargetStopScenario,
  SCENARIO_PLANNER_DISCLOSURE,
} from './lib/scenarioPlanner'
import type {
  ScenarioPlannerInput,
  ScenarioPlannerQuoteState,
  TargetStopScenario,
} from './lib/scenarioPlanner'
import {
  buildJournalEntryFromTicket,
  buildManualJournalEntry,
  buildManualTradeTicketFromProfitLock,
  buildManualTradeTicketFromTradeSetup,
  buildRealizedProfitSummary,
  buildTaxHelperExport,
  DEFAULT_PAY_YOURSELF_RULE,
  normalizePayYourselfRule,
  TRADE_JOURNAL_DISCLOSURE,
} from './lib/tradeJournal'
import type {
  ManualTradeTicket,
  PayYourselfRule,
  RealizedProfitSummary,
  TradeJournalEntry,
  TradeJournalEntryStatus,
} from './lib/tradeJournal'
import {
  buildResearchCandidateScores,
  filterResearchCandidateScores,
  groupResearchCardsByLayer,
} from './lib/researchWatchlist'
import type {
  ResearchCandidateScore,
  ResearchLayerGroup,
} from './lib/researchWatchlist'
import {
  buildCodexResearchDownloadName,
  buildCodexResearchRequest,
  buildCodexResearchRequestPath,
  parseCodexResearchResultJson,
  serializeCodexResearchRequest,
  type CodexResearchRequest,
} from './lib/codexResearchQueue'
import {
  buildResearchDraftFromBundle,
  createCuratedResearchProvider,
  describeResearchSourceType,
  RESEARCH_DRAFT_DISCLOSURE,
} from './lib/researchProvider'
import type {
  ResearchContextBundle,
  ResearchDraft,
  ResearchSource,
} from './lib/researchProvider'
import './App.css'

type ManualLotInputs = Record<
  string,
  {
    shares: string
    averageCost: string
  }
>

type HoldingForm = {
  symbol: string
  name: string
  stackLayer: AiStackLayerId
  shares: string
  averageCost: string
}

type SettingsForm = {
  maxPositionWeightPercent: string
  alertPositionWeightPercent: string
  taxReserveRatePercent: string
  taxReserveEnabled: boolean
  cashRunwayDollars: string
  activeTradingSleeveDollars: string
}

type ResearchFiltersForm = {
  layer: AiStackLayerId | 'all'
  minimumScore: string
  holdingsOnly: boolean
  needsInputOnly: boolean
}

type ScenarioPlannerForm = {
  currentPrice: string
  averageCost: string
  shares: string
  maxLossDollars: string
  desiredRiskReward: string
  targetGainPercent: string
  trimPercent: string
  supportPrice: string
  stopLimitBufferPercent: string
  timeHorizon: string
}

type ScenarioPlannerFormMap = Record<
  string,
  Partial<ScenarioPlannerForm>
>

type PayYourselfForm = {
  enabled: boolean
  percentOfNetAfterReserve: string
}

type SymbolLabel = {
  name: string
  layer: string
}

type JournalEntryEditableField =
  | 'realizedProfitLoss'
  | 'taxReserveEstimate'
  | 'payYourselfAmount'
  | 'notes'
  | 'taxPrepNotes'

type ResearchRunStatus =
  | 'idle'
  | 'loading'
  | 'needs_review'
  | 'reviewed'
  | 'empty_source'
  | 'stale_source'
  | 'error'

type ResearchRunRecord = {
  status: ResearchRunStatus
  updatedAt: string | null
  message: string
  sources: ResearchSource[]
  draft: ResearchDraft | null
}

type ResearchRunMap = Record<string, ResearchRunRecord>

type CodexQueueStatus =
  | 'idle'
  | 'pending'
  | 'missing_result'
  | 'invalid_result'
  | 'imported'
  | 'error'

type CodexQueueRecord = {
  status: CodexQueueStatus
  updatedAt: string | null
  message: string
  request: CodexResearchRequest | null
  requestPath: string | null
  resultPath: string | null
  errors: string[]
}

type CodexQueueMap = Record<string, CodexQueueRecord>

type PriceMovementRow = {
  symbol: string
  name: string
  layer: string
  price: number | null
  baselinePrice: number | null
  change: number | null
  changePercent: number | null
  freshness: string
  color: string
}

const DEFAULT_CASH_TARGET_AMOUNT = 1000
const DEFAULT_RESEARCH_FILTERS: ResearchFiltersForm = {
  layer: 'all',
  minimumScore: '0',
  holdingsOnly: false,
  needsInputOnly: false,
}

const DEFAULT_HOLDING_FORM: HoldingForm = {
  symbol: '',
  name: '',
  stackLayer: 'hyperscalers',
  shares: '',
  averageCost: '',
}

const DEFAULT_SCENARIO_PLANNER_FORM: ScenarioPlannerForm = {
  currentPrice: '',
  averageCost: '',
  shares: '',
  maxLossDollars: '250',
  desiredRiskReward: '2',
  targetGainPercent: '20',
  trimPercent: '25',
  supportPrice: '',
  stopLimitBufferPercent: '0.5',
  timeHorizon: '2-4 weeks',
}

const DEFAULT_PAY_YOURSELF_FORM: PayYourselfForm = {
  enabled: DEFAULT_PAY_YOURSELF_RULE.enabled,
  percentOfNetAfterReserve: String(
    DEFAULT_PAY_YOURSELF_RULE.percentOfNetAfterReserve,
  ),
}

const IDLE_RESEARCH_RUN: ResearchRunRecord = {
  status: 'idle',
  updatedAt: null,
  message: 'Pull source links and draft notes you can edit.',
  sources: [],
  draft: null,
}

const IDLE_CODEX_QUEUE_RECORD: CodexQueueRecord = {
  status: 'idle',
  updatedAt: null,
  message: 'Create a local research request for Codex or ChatGPT.',
  request: null,
  requestPath: null,
  resultPath: null,
  errors: [],
}

const DEFAULT_SETTINGS_FORM: SettingsForm = {
  maxPositionWeightPercent: String(
    DEFAULT_PORTFOLIO_SETTINGS.maxPositionWeightPercent,
  ),
  alertPositionWeightPercent: String(
    DEFAULT_PORTFOLIO_SETTINGS.alertPositionWeightPercent,
  ),
  taxReserveRatePercent: String(
    DEFAULT_PORTFOLIO_SETTINGS.taxReserveRatePercent,
  ),
  taxReserveEnabled: DEFAULT_PORTFOLIO_SETTINGS.taxReserveEnabled,
  cashRunwayDollars: String(DEFAULT_CASH_TARGET_AMOUNT),
  activeTradingSleeveDollars: String(
    DEFAULT_PORTFOLIO_SETTINGS.activeTradingSleeveDollars,
  ),
}

function App() {
  const [holdings, setHoldings] = useState<SeedHolding[]>(() =>
    seedHoldings.map((holding) => ({ ...holding })),
  )
  const [manualLots, setManualLots] = useState<ManualLotInputs>(() =>
    Object.fromEntries(
      seedHoldings.map((holding) => [
        holding.symbol,
        {
          shares: '',
          averageCost: '',
        },
      ]),
    ),
  )
  const [holdingForm, setHoldingForm] =
    useState<HoldingForm>(DEFAULT_HOLDING_FORM)
  const [settingsForm, setSettingsForm] =
    useState<SettingsForm>(DEFAULT_SETTINGS_FORM)
  const [selectedPlannerSymbol, setSelectedPlannerSymbol] = useState<string>(
    seedWatchlist[0].symbol,
  )
  const [cashTargetInput, setCashTargetInput] = useState(
    String(DEFAULT_CASH_TARGET_AMOUNT),
  )
  const [researchCards, setResearchCards] = useState<
    SeedWatchlistItem[]
  >(() => cloneSeedWatchlist(seedWatchlist))
  const [selectedResearchSymbol, setSelectedResearchSymbol] = useState(
    seedWatchlist[0].symbol,
  )
  const [researchFilters, setResearchFilters] = useState<ResearchFiltersForm>(
    DEFAULT_RESEARCH_FILTERS,
  )
  const [scenarioPlannerForms, setScenarioPlannerForms] =
    useState<ScenarioPlannerFormMap>({})
  const [researchRuns, setResearchRuns] = useState<ResearchRunMap>({})
  const [codexQueue, setCodexQueue] = useState<CodexQueueMap>({})
  const [payYourselfForm, setPayYourselfForm] =
    useState<PayYourselfForm>(DEFAULT_PAY_YOURSELF_FORM)
  const [journalEntries, setJournalEntries] = useState<TradeJournalEntry[]>([])
  const summary = useMemo(() => buildPortfolioSeedSummary(holdings), [holdings])
  const symbolLabels = useMemo(
    () => buildSymbolLabels(holdings, researchCards),
    [holdings, researchCards],
  )
  const researchProvider = useMemo(
    () => createCuratedResearchProvider({ cards: researchCards }),
    [researchCards],
  )
  const marketSymbols = useMemo(
    () =>
      getMarketDataSymbols(
        holdings,
        researchCards.map((item) => item.symbol),
      ),
    [holdings, researchCards],
  )
  const { baselinePrices, snapshot, errorMessage } =
    useMarketDataSnapshot(marketSymbols)
  const quotesBySymbol = useMemo(() => {
    return new Map(snapshot?.quotes.map((quote) => [quote.symbol, quote]))
  }, [snapshot])
  const movementRows = useMemo(
    () =>
      buildPriceMovementRows(
        snapshot,
        marketSymbols,
        baselinePrices,
        symbolLabels,
      ),
    [baselinePrices, marketSymbols, snapshot, symbolLabels],
  )
  const researchScores = useMemo(
    () => buildResearchCandidateScores(researchCards),
    [researchCards],
  )
  const researchScoreBySymbol = useMemo(() => {
    return new Map(researchScores.map((score) => [score.symbol, score]))
  }, [researchScores])
  const researchLayerGroups = useMemo(
    () => groupResearchCardsByLayer(researchCards),
    [researchCards],
  )
  const filteredResearchScores = useMemo(
    () =>
      filterResearchCandidateScores(researchScores, {
        layer: researchFilters.layer,
        minimumScore: parseNumericInput(researchFilters.minimumScore) ?? 0,
        holdingsOnly: researchFilters.holdingsOnly,
        needsInputOnly: researchFilters.needsInputOnly,
      }),
    [researchFilters, researchScores],
  )
  const selectedResearchCard =
    researchCards.find((card) => card.symbol === selectedResearchSymbol) ??
    researchCards[0] ??
    null
  const selectedResearchScore = selectedResearchCard
    ? researchScoreBySymbol.get(selectedResearchCard.symbol) ?? null
    : null
  const selectedResearchRun = selectedResearchCard
    ? researchRuns[selectedResearchCard.symbol] ?? IDLE_RESEARCH_RUN
    : IDLE_RESEARCH_RUN
  const selectedCodexQueueRecord = selectedResearchCard
    ? codexQueue[selectedResearchCard.symbol] ?? IDLE_CODEX_QUEUE_RECORD
    : IDLE_CODEX_QUEUE_RECORD
  const selectedPlannerCard =
    researchCards.find((card) => card.symbol === selectedPlannerSymbol) ??
    selectedResearchCard
  const portfolioSettings = useMemo(
    () => parseSettingsForm(settingsForm),
    [settingsForm],
  )
  const portfolioInputs = useMemo(() => {
    return holdings.map((holding) => {
      const manualLot = manualLots[holding.symbol]
      const quote = quotesBySymbol.get(holding.symbol)

      return {
        ...holding,
        shares: parseNumericInput(manualLot?.shares),
        averageCost: parseNumericInput(manualLot?.averageCost),
        currentPrice: quote?.price ?? null,
      }
    })
  }, [holdings, manualLots, quotesBySymbol])
  const portfolioModel = useMemo(
    () => buildPortfolioModel(portfolioInputs, portfolioSettings),
    [portfolioInputs, portfolioSettings],
  )
  const selectedPlannerPosition =
    portfolioModel.positions.find(
      (position) => position.symbol === selectedPlannerSymbol,
    ) ?? null
  const selectedPlannerQuote = quotesBySymbol.get(selectedPlannerSymbol)
  const selectedPlannerForm = useMemo(
    () => scenarioPlannerForms[selectedPlannerSymbol] ?? {},
    [scenarioPlannerForms, selectedPlannerSymbol],
  )
  const scenarioPlannerFields = useMemo(
    () =>
      buildScenarioPlannerFieldValues({
        card: selectedPlannerCard,
        form: selectedPlannerForm,
        position: selectedPlannerPosition,
        quote: selectedPlannerQuote,
      }),
    [
      selectedPlannerCard,
      selectedPlannerForm,
      selectedPlannerPosition,
      selectedPlannerQuote,
    ],
  )
  const targetStopScenario = useMemo(
    () =>
      buildTargetStopScenario(
        buildScenarioPlannerInput({
          card: selectedPlannerCard,
          fields: scenarioPlannerFields,
          hasManualCurrentPrice: hasScenarioFormField(
            selectedPlannerForm,
            'currentPrice',
          ),
          labels: symbolLabels,
          quote: selectedPlannerQuote,
          symbol: selectedPlannerSymbol,
        }),
      ),
    [
      scenarioPlannerFields,
      selectedPlannerCard,
      selectedPlannerForm,
      selectedPlannerQuote,
      selectedPlannerSymbol,
      symbolLabels,
    ],
  )
  const cashTargetAmount =
    parseNumericInput(cashTargetInput) ??
    portfolioModel.settings.cashRunwayDollars
  const topProfitLockScenarios = useMemo(
    () =>
      buildTopProfitLockScenarios({
        model: portfolioModel,
        cashTargetAmount,
        limit: 3,
      }),
    [portfolioModel, cashTargetAmount],
  )
  const profitLockTickets = useMemo(
    () =>
      buildProfitLockTickets({
        position: selectedPlannerPosition,
        portfolioMarketValue: portfolioModel.totalMarketValue,
        settings: portfolioModel.settings,
        targetWeightPercent: portfolioModel.settings.maxPositionWeightPercent,
        cashTargetAmount,
      }),
    [
      selectedPlannerPosition,
      portfolioModel.totalMarketValue,
      portfolioModel.settings,
      cashTargetAmount,
    ],
  )
  const payYourselfRule = useMemo(
    () =>
      parsePayYourselfForm({
        enabled: payYourselfForm.enabled,
        percentOfNetAfterReserve: payYourselfForm.percentOfNetAfterReserve,
      }),
    [payYourselfForm],
  )
  const manualTradeTickets = useMemo(() => {
    if (!selectedPlannerCard) {
      return []
    }

    const invalidation =
      selectedPlannerCard.tradeSetup.invalidation ||
      selectedPlannerCard.research.invalidation

    return [
      ...profitLockTickets.map((ticket) =>
        buildManualTradeTicketFromProfitLock({
          symbol: selectedPlannerSymbol,
          name: selectedPlannerCard.name,
          ticket,
          invalidation,
        }),
      ),
      buildManualTradeTicketFromTradeSetup({
        card: selectedPlannerCard,
        scenario: targetStopScenario,
        settings: portfolioModel.settings,
      }),
    ]
  }, [
    portfolioModel.settings,
    profitLockTickets,
    selectedPlannerCard,
    selectedPlannerSymbol,
    targetStopScenario,
  ])
  const realizedProfitSummary = useMemo(
    () => buildRealizedProfitSummary(journalEntries, payYourselfRule),
    [journalEntries, payYourselfRule],
  )
  const profitCashPlan = useMemo(
    () =>
      buildProfitCashPlan({
        summary: realizedProfitSummary,
        positions: portfolioModel.positions,
        researchScores,
        quotesBySymbol,
      }),
    [
      portfolioModel.positions,
      quotesBySymbol,
      realizedProfitSummary,
      researchScores,
    ],
  )
  const concentrationSummary = useMemo(
    () => summarizeConcentrationRisk(portfolioModel),
    [portfolioModel],
  )
  const cashRunwaySummary = useMemo(
    () => summarizeCashRunway(portfolioModel, topProfitLockScenarios),
    [portfolioModel, topProfitLockScenarios],
  )
  const allocationRows = useMemo(
    () => buildAllocationRows(portfolioModel),
    [portfolioModel],
  )
  const gainRows = useMemo(() => buildGainRows(portfolioModel), [portfolioModel])
  const concentrationRows = useMemo(
    () => buildConcentrationRows(portfolioModel),
    [portfolioModel],
  )
  const isMarketLoading = snapshot === null && errorMessage === null
  const hasStaleQuotes =
    snapshot?.quotes.some((quote) => quote.freshness === 'cached') ?? false
  const marketStatus = snapshot?.sourceLabel ?? 'Loading'
  const marketTimestamp = snapshot
    ? formatTimestamp(snapshot.fetchedAt)
    : 'Waiting for first poll'

  function updateHoldingForm(field: keyof HoldingForm, value: string) {
    setHoldingForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function addHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const symbol = normalizeSymbolInput(holdingForm.symbol)

    if (!symbol) {
      return
    }

    const existingCard = researchCards.find((card) => card.symbol === symbol)
    const name = holdingForm.name.trim() || existingCard?.name || symbol
    const stackLayerLabel = getAiStackLayerLabel(holdingForm.stackLayer)
    const nextHolding: SeedHolding = {
      symbol,
      name,
      stackLayer: stackLayerLabel,
      thesisTag: `Manual holding in ${stackLayerLabel}. Add the thesis in the research card.`,
      shares: null,
      averageCost: null,
    }

    setHoldings((current) => {
      if (current.some((holding) => holding.symbol === symbol)) {
        return current.map((holding) =>
          holding.symbol === symbol ? nextHolding : holding,
        )
      }

      return [...current, nextHolding]
    })
    setManualLots((current) => ({
      ...current,
      [symbol]: {
        shares: holdingForm.shares || current[symbol]?.shares || '',
        averageCost:
          holdingForm.averageCost || current[symbol]?.averageCost || '',
      },
    }))
    setResearchCards((current) => {
      if (current.some((card) => card.symbol === symbol)) {
        return current.map((card) =>
          card.symbol === symbol
            ? {
                ...card,
                name,
                stackLayer: holdingForm.stackLayer,
                seedType: 'current_holding',
              }
            : card,
        )
      }

      return [
        ...current,
        buildManualWatchlistCard({
          symbol,
          name,
          stackLayer: holdingForm.stackLayer,
          seedType: 'current_holding',
        }),
      ]
    })
    setSelectedPlannerSymbol(symbol)
    setSelectedResearchSymbol(symbol)
    setHoldingForm(DEFAULT_HOLDING_FORM)
  }

  function removeHolding(symbol: string) {
    setHoldings((current) =>
      current.filter((holding) => holding.symbol !== symbol),
    )
    setManualLots((current) => {
      const next = { ...current }
      delete next[symbol]
      return next
    })
    setResearchCards((current) =>
      current.map((card) =>
        card.symbol === symbol ? { ...card, seedType: 'placeholder' } : card,
      ),
    )
  }

  function updateManualLot(
    symbol: string,
    field: keyof ManualLotInputs[string],
    value: string,
  ) {
    setManualLots((current) => ({
      ...current,
      [symbol]: {
        ...current[symbol],
        [field]: value,
      },
    }))
  }

  function updateSetting(field: keyof SettingsForm, value: string | boolean) {
    setSettingsForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateResearchField(
    symbol: string,
    field: keyof ResearchFields,
    value: string,
  ) {
    setResearchCards((current) =>
      current.map((card) =>
        card.symbol === symbol
          ? {
              ...card,
              research: {
                ...card.research,
                [field]: value,
              },
            }
          : card,
      ),
    )
  }

  function updateTradeSetupField(
    symbol: string,
    field: keyof TradeSetupFields,
    value: string,
  ) {
    setResearchCards((current) =>
      current.map((card) =>
        card.symbol === symbol
          ? {
              ...card,
              tradeSetup: {
                ...card.tradeSetup,
                [field]: value,
              },
            }
          : card,
      ),
    )
  }

  function updateResearchFilter(
    field: keyof ResearchFiltersForm,
    value: string | boolean,
  ) {
    setResearchFilters((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function selectPlannerSymbol(symbol: string) {
    setSelectedPlannerSymbol(symbol)

    if (researchCards.some((card) => card.symbol === symbol)) {
      setSelectedResearchSymbol(symbol)
    }
  }

  function updateScenarioPlannerField(
    field: keyof ScenarioPlannerForm,
    value: string,
  ) {
    setScenarioPlannerForms((current) => ({
      ...current,
      [selectedPlannerSymbol]: {
        ...current[selectedPlannerSymbol],
        [field]: value,
      },
    }))
  }

  function updatePayYourselfRule(
    field: keyof PayYourselfForm,
    value: string | boolean,
  ) {
    setPayYourselfForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function addJournalEntryFromTicket(
    ticket: ManualTradeTicket,
    status: TradeJournalEntryStatus,
  ) {
    const createdAt = new Date().toISOString()

    setJournalEntries((current) => [
      buildJournalEntryFromTicket(
        ticket,
        {
          createdAt,
          status,
        },
        payYourselfRule,
      ),
      ...current,
    ])
  }

  function addManualMistakeEntry() {
    const createdAt = new Date().toISOString()
    const selectedLabel = selectedPlannerCard
      ? selectedPlannerCard.name
      : selectedPlannerSymbol

    setJournalEntries((current) => [
      buildManualJournalEntry({
        id: `${selectedPlannerSymbol}-manual-mistake-${createdAt.replace(
          /\D/g,
          '',
        )}`,
        createdAt,
        symbol: selectedPlannerSymbol,
        name: selectedLabel,
        status: 'mistake',
        action: 'Manual mistake review',
        notes: 'Describe what happened, what rule was missed, and the correction.',
        taxPrepNotes:
          'Add actual fill, statement, and lot details if this changed realized P/L.',
      }),
      ...current,
    ])
  }

  function updateJournalEntry(
    id: string,
    field: JournalEntryEditableField,
    value: string,
  ) {
    setJournalEntries((current) =>
      current.map((entry) => {
        if (entry.id !== id) {
          return entry
        }

        if (
          field === 'realizedProfitLoss' ||
          field === 'taxReserveEstimate' ||
          field === 'payYourselfAmount'
        ) {
          return {
            ...entry,
            [field]: parseNumericInput(value) ?? 0,
          }
        }

        return {
          ...entry,
          [field]: value,
        }
      }),
    )
  }

  function exportTradeJournal() {
    const generatedAt = new Date().toISOString()
    const payload = buildTaxHelperExport({
      entries: journalEntries,
      generatedAt,
      payYourselfRule,
    })

    downloadJsonFile(
      `swing-command-center-tax-review-${generatedAt.slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
    )
  }

  async function runResearchForSymbols(symbols: readonly string[]) {
    const targetSymbols = Array.from(
      new Set(symbols.map((symbol) => symbol.trim().toUpperCase())),
    ).filter(Boolean)

    if (targetSymbols.length === 0) {
      return
    }

    const loadingAt = new Date().toISOString()

    setResearchRuns((current) => {
      const next = { ...current }

      for (const symbol of targetSymbols) {
        next[symbol] = {
          status: 'loading',
          updatedAt: loadingAt,
          message: 'Loading transparent source context.',
          sources: current[symbol]?.sources ?? [],
          draft: current[symbol]?.draft ?? null,
        }
      }

      return next
    })

    try {
      const bundles = await researchProvider.loadResearchContext(targetSymbols)
      const draftBySymbol = new Map<string, ResearchDraft>()
      const nextRecords = Object.fromEntries(
        bundles.map((bundle) => {
          const draft = buildResearchDraftFromBundle(bundle)

          if (draft) {
            draftBySymbol.set(bundle.symbol, draft)
          }

          return [bundle.symbol, buildResearchRunRecord(bundle, draft)]
        }),
      )

      if (draftBySymbol.size > 0) {
        setResearchCards((current) =>
          current.map((card) => {
            const draft = draftBySymbol.get(card.symbol)

            if (!draft) {
              return card
            }

            return {
              ...card,
              research: {
                ...card.research,
                ...draft.fields,
              },
            }
          }),
        )
      }

      setResearchRuns((current) => ({
        ...current,
        ...nextRecords,
      }))
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Research provider failed to load source context.'
      const failedAt = new Date().toISOString()

      setResearchRuns((current) => {
        const next = { ...current }

        for (const symbol of targetSymbols) {
          next[symbol] = {
            status: 'error',
            updatedAt: failedAt,
            message,
            sources: current[symbol]?.sources ?? [],
            draft: current[symbol]?.draft ?? null,
          }
        }

        return next
      })
    }
  }

  function runResearchForLayer(layer: AiStackLayerId) {
    const layerSymbols = researchCards
      .filter((card) => card.stackLayer === layer)
      .map((card) => card.symbol)

    void runResearchForSymbols(layerSymbols)
  }

  function markResearchReviewed(symbol: string) {
    setResearchRuns((current) => {
      const record = current[symbol]

      if (!record) {
        return current
      }

      return {
        ...current,
        [symbol]: {
          ...record,
          status: 'reviewed',
          updatedAt: new Date().toISOString(),
          message: 'Marked reviewed. You can still edit the notes.',
        },
      }
    })
  }

  function queueCodexResearchRequest(card: SeedWatchlistItem) {
    try {
      const request = buildCodexResearchRequest(card)
      const requestText = serializeCodexResearchRequest(request)
      const requestPath = buildCodexResearchRequestPath(request.requestId)

      downloadJsonFile(
        buildCodexResearchDownloadName(request.requestId),
        requestText,
      )

      setCodexQueue((current) => ({
        ...current,
        [card.symbol]: {
          status: 'pending',
          updatedAt: request.createdAt,
          message:
            'Research file created. Run it manually, then import the matching result file.',
          request,
          requestPath,
          resultPath: request.expectedResultPath,
          errors: [],
        },
      }))
    } catch (error) {
      setCodexQueue((current) => ({
        ...current,
        [card.symbol]: {
          status: 'error',
          updatedAt: new Date().toISOString(),
          message: getErrorMessage(error, 'Failed to queue request JSON.'),
          request: current[card.symbol]?.request ?? null,
          requestPath: current[card.symbol]?.requestPath ?? null,
          resultPath: current[card.symbol]?.resultPath ?? null,
          errors: [getErrorMessage(error, 'Failed to queue request JSON.')],
        },
      }))
    }
  }

  function markCodexResultMissing(symbol: string) {
    setCodexQueue((current) => {
      const record = current[symbol] ?? IDLE_CODEX_QUEUE_RECORD

      return {
        ...current,
        [symbol]: {
          ...record,
          status: 'missing_result',
          updatedAt: new Date().toISOString(),
          message:
            'No result file has been imported for this research request yet.',
          errors: [],
        },
      }
    })
  }

  async function importCodexResearchResult(symbol: string, file: File) {
    const queuedRecord = codexQueue[symbol] ?? IDLE_CODEX_QUEUE_RECORD

    try {
      const validation = parseCodexResearchResultJson(await file.text(), {
        expectedRequestId: queuedRecord.request?.requestId,
        expectedSymbol: symbol,
      })
      const importedAt = new Date().toISOString()

      if (!validation.ok) {
        setCodexQueue((current) => ({
          ...current,
          [symbol]: {
            ...(current[symbol] ?? queuedRecord),
            status: 'invalid_result',
            updatedAt: importedAt,
            message: 'Result JSON failed local schema validation.',
            errors: validation.errors,
          },
        }))

        return
      }

      setResearchCards((current) =>
        current.map((card) =>
          card.symbol === symbol
            ? {
                ...card,
                research: {
                  ...card.research,
                  ...validation.draft.fields,
                },
              }
            : card,
        ),
      )
      setResearchRuns((current) => ({
        ...current,
        [symbol]: {
          status: 'needs_review',
          updatedAt: importedAt,
          message:
            'Codex notes imported as a draft. Check the sources before trusting them.',
          sources: validation.sources,
          draft: validation.draft,
        },
      }))
      setCodexQueue((current) => ({
        ...current,
        [symbol]: {
          ...(current[symbol] ?? queuedRecord),
          status: 'imported',
          updatedAt: importedAt,
          message:
            'Result imported into the research card. Review it before using it.',
          errors: [],
        },
      }))
    } catch (error) {
      setCodexQueue((current) => ({
        ...current,
        [symbol]: {
          ...(current[symbol] ?? queuedRecord),
          status: 'error',
          updatedAt: new Date().toISOString(),
          message: getErrorMessage(error, 'Failed to read result JSON.'),
          errors: [getErrorMessage(error, 'Failed to read result JSON.')],
        },
      }))
    }
  }

  return (
    <main className="cockpit-shell">
      <section className="command-surface" aria-labelledby="page-title">
        <header className="command-header">
          <div className="identity-block">
            <p className="eyebrow">Manual swing cockpit</p>
            <h1 id="page-title">Swing Command Center</h1>
            <div className="scope-line">
              <span>
                {summary.symbols.length > 0
                  ? summary.symbols.join(' / ')
                  : 'Add holdings below'}
              </span>
              <span>{portfolioModel.completePositionCount} filled in</span>
              <span>{portfolioModel.manualLotsNeeded} need details</span>
            </div>
          </div>

          <div className="market-health" aria-label="Market data status">
            <span className={`source-dot ${snapshot?.mode ?? 'loading'}`} />
            <div>
              <strong>{marketStatus}</strong>
              <span>{marketTimestamp}</span>
            </div>
          </div>
        </header>

        <MarketStateBanner
          errorMessage={errorMessage}
          hasStaleQuotes={hasStaleQuotes}
          isLoading={isMarketLoading}
          snapshot={snapshot}
        />

        <div className="primary-metrics" aria-label="Portfolio status">
          <MetricCell
            detail={`${portfolioModel.completePositionCount}/${summary.totalSymbols} holdings have shares and cost`}
            label="Portfolio value"
            tone="neutral"
            value={formatCurrency(portfolioModel.totalMarketValue)}
          />
          <MetricCell
            detail={getGainMetricDetail(portfolioModel.totalCostBasis)}
            label="Unrealized gain"
            tone={getSignedTone(portfolioModel.totalUnrealizedGain)}
            value={formatSignedCurrency(portfolioModel.totalUnrealizedGain)}
          />
          <MetricCell
            detail={cashRunwaySummary.detail}
            label="Cash goal"
            tone={cashRunwaySummary.label === 'Short' ? 'warning' : 'neutral'}
            value={formatCurrency(cashRunwaySummary.targetAmount)}
          />
          <MetricCell
            detail={concentrationSummary.detail}
            label="Position size"
            tone={getConcentrationTone(concentrationSummary.state)}
            value={concentrationSummary.label}
          />
        </div>

        <div className="first-screen-grid">
          <section
            className="cockpit-panel scenario-panel"
            aria-labelledby="top-scenarios-title"
          >
            <PanelHeading
              eyebrow="Lock gains"
              title="Best cash ideas"
              value={
                topProfitLockScenarios.length > 0
                  ? `${topProfitLockScenarios.length} ready`
                  : 'No ideas'
              }
            />
            <TopScenarioList
              manualLotsNeeded={portfolioModel.manualLotsNeeded}
              scenarios={topProfitLockScenarios}
              selectedSymbol={selectedPlannerSymbol}
              onSelectSymbol={selectPlannerSymbol}
            />
          </section>

          <section
            className="cockpit-panel allocation-panel"
            aria-labelledby="allocation-title"
          >
            <PanelHeading
              eyebrow="Allocation"
              title="Modeled weight"
              value={formatCurrency(portfolioModel.totalMarketValue)}
            />
            <AllocationChart isLoading={isMarketLoading} rows={allocationRows} />
          </section>

          <section
            className="cockpit-panel movement-panel"
            aria-labelledby="movement-title"
          >
            <PanelHeading
              eyebrow="Watchlist"
              title="Session movement"
              value={`${movementRows.length} symbols`}
            />
            <MovementChart isLoading={isMarketLoading} rows={movementRows} />
          </section>
        </div>
      </section>

      <section
        className="research-workbench"
        aria-label="Research tracker"
      >
        <section className="cockpit-panel stack-map-panel">
          <PanelHeading
            eyebrow="Research"
            title="Watchlist groups"
            value={`${researchCards.length} cards`}
          />
          <StackLayerMap
            groups={researchLayerGroups}
            scoreBySymbol={researchScoreBySymbol}
            selectedSymbol={selectedResearchSymbol}
            onSelectSymbol={setSelectedResearchSymbol}
          />
        </section>

        <section className="cockpit-panel research-card-panel">
          <PanelHeading
            eyebrow="Research card"
            title={selectedResearchCard?.symbol ?? 'No symbol'}
            value={selectedResearchScore?.statusLabel ?? 'Needs thesis'}
          />
          <ResearchCardEditor
            card={selectedResearchCard}
            codexQueue={selectedCodexQueueRecord}
            runState={selectedResearchRun}
            score={selectedResearchScore}
            onCheckCodexResult={markCodexResultMissing}
            onImportCodexResult={importCodexResearchResult}
            onMarkReviewed={markResearchReviewed}
            onQueueCodexRequest={queueCodexResearchRequest}
            onRunLayer={runResearchForLayer}
            onRunSymbol={(symbol) => void runResearchForSymbols([symbol])}
            onUpdateResearch={updateResearchField}
            onUpdateTradeSetup={updateTradeSetupField}
          />
        </section>

        <section className="cockpit-panel candidate-panel">
          <PanelHeading
            eyebrow="Checklist"
            title="Find ideas"
            value={`${filteredResearchScores.length} shown`}
          />
          <CandidateFilterDesk
            filters={researchFilters}
            scores={filteredResearchScores}
            selectedSymbol={selectedResearchSymbol}
            onSelectSymbol={setSelectedResearchSymbol}
            onUpdateFilter={updateResearchFilter}
          />
        </section>
      </section>

      <section className="chart-deck" aria-label="Portfolio charts">
        <section
          className="cockpit-panel"
          aria-labelledby="gains-chart-title"
        >
          <PanelHeading
            eyebrow="Open profit"
            title="Gains by holding"
            value={formatSignedCurrency(portfolioModel.totalUnrealizedGain)}
          />
          <GainChart isLoading={isMarketLoading} rows={gainRows} />
        </section>

        <section
          className="cockpit-panel"
          aria-labelledby="concentration-chart-title"
        >
          <PanelHeading
            eyebrow="Risk"
            title="Position size map"
            value={formatPercent(concentrationSummary.maxWeightPercent)}
          />
          <ConcentrationChart
            alertPercent={portfolioModel.settings.alertPositionWeightPercent}
            capPercent={portfolioModel.settings.maxPositionWeightPercent}
            rows={concentrationRows}
          />
        </section>
      </section>

      <section className="workbench-grid" aria-label="Inputs and plan builder">
        <section className="cockpit-panel input-panel">
          <PanelHeading
            eyebrow="Inputs"
            title="Shares and cost"
            value={`${portfolioModel.manualLotsNeeded} missing`}
          />
          <ManualLotTable
            holdingForm={holdingForm}
            manualLots={manualLots}
            positions={portfolioModel.positions}
            onAddHolding={addHolding}
            onRemoveHolding={removeHolding}
            onUpdate={updateManualLot}
            onUpdateHoldingForm={updateHoldingForm}
          />
        </section>

        <section className="cockpit-panel settings-panel">
          <PanelHeading
            eyebrow="Rules"
            title="Simple rules"
            value={`${portfolioModel.settings.alertPositionWeightPercent}% / ${portfolioModel.settings.maxPositionWeightPercent}%`}
          />
          <div className="settings-grid">
            <NumberSetting
              label="Warning weight"
              max="100"
              min="1"
              suffix="%"
              value={settingsForm.alertPositionWeightPercent}
              onChange={(value) =>
                updateSetting('alertPositionWeightPercent', value)
              }
            />
            <NumberSetting
              label="Max weight"
              max="100"
              min="1"
              suffix="%"
              value={settingsForm.maxPositionWeightPercent}
              onChange={(value) =>
                updateSetting('maxPositionWeightPercent', value)
              }
            />
            <NumberSetting
              label="Cash goal"
              min="0"
              prefix="$"
              value={settingsForm.cashRunwayDollars}
              onChange={(value) => updateSetting('cashRunwayDollars', value)}
            />
            <NumberSetting
              label="Trading cash"
              min="0"
              prefix="$"
              value={settingsForm.activeTradingSleeveDollars}
              onChange={(value) =>
                updateSetting('activeTradingSleeveDollars', value)
              }
            />
            <label className="setting-control toggle-control">
              <span>Tax reserve</span>
              <input
                checked={settingsForm.taxReserveEnabled}
                type="checkbox"
                onChange={(event) =>
                  updateSetting('taxReserveEnabled', event.target.checked)
                }
              />
            </label>
            <NumberSetting
              disabled={!settingsForm.taxReserveEnabled}
              label="Tax reserve %"
              max="100"
              min="0"
              suffix="%"
              value={settingsForm.taxReserveRatePercent}
              onChange={(value) =>
                updateSetting('taxReserveRatePercent', value)
              }
            />
          </div>
          <p className="state-note">
            Tax reserve is just an estimate for planning. It is not tax advice
            or filing math.
          </p>
        </section>

        <section className="cockpit-panel planner-panel">
          <PanelHeading
            eyebrow="Plan builder"
            title="Price plan"
            value={selectedPlannerSymbol}
          />
          <ScenarioPlannerDesk
            cards={researchCards}
            cashTargetInput={cashTargetInput}
            fields={scenarioPlannerFields}
            profitLockTickets={profitLockTickets}
            scenario={targetStopScenario}
            selectedSymbol={selectedPlannerSymbol}
            taxReserveLabel={
              portfolioModel.settings.taxReserveEnabled
                ? `${portfolioModel.settings.taxReserveRatePercent}%`
                : 'Off'
            }
            onSelectSymbol={selectPlannerSymbol}
            onUpdateCashTarget={setCashTargetInput}
            onUpdateField={updateScenarioPlannerField}
          />
        </section>

        <section className="cockpit-panel journal-panel">
          <PanelHeading
            eyebrow="Journal"
            title="Tickets and realized P/L"
            value={formatSignedCurrency(
              realizedProfitSummary.netRealizedTradingProfit,
            )}
          />
          <TradeJournalDesk
            entries={journalEntries}
            payYourselfForm={payYourselfForm}
            profitCashPlan={profitCashPlan}
            summary={realizedProfitSummary}
            tickets={manualTradeTickets}
            onAddEntry={addJournalEntryFromTicket}
            onAddMistake={addManualMistakeEntry}
            onExport={exportTradeJournal}
            onSelectSymbol={selectPlannerSymbol}
            onUpdateEntry={updateJournalEntry}
            onUpdatePayYourself={updatePayYourselfRule}
          />
        </section>
      </section>

      <section className="cockpit-panel quote-panel" aria-label="Quote feed">
        <PanelHeading
          eyebrow="Market data"
          title="Prices"
          value={`Poll ${MARKET_DATA_POLL_INTERVAL_MS / 1000}s`}
        />
        <QuoteTable
          isLoading={isMarketLoading}
          labels={symbolLabels}
          quotesBySymbol={quotesBySymbol}
          symbols={marketSymbols}
        />
      </section>
    </main>
  )
}

export default App

function MetricCell(props: {
  label: string
  value: string
  detail: string
  tone: 'neutral' | 'positive' | 'negative' | 'warning' | 'danger'
}) {
  return (
    <div className={`metric-cell ${props.tone}`}>
      <span className="metric-label">{props.label}</span>
      <strong>{props.value}</strong>
      <span>{props.detail}</span>
    </div>
  )
}

function PanelHeading(props: { eyebrow: string; title: string; value: string }) {
  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">{props.eyebrow}</p>
        <h2>{props.title}</h2>
      </div>
      <span className="panel-value">{props.value}</span>
    </div>
  )
}

function MarketStateBanner(props: {
  snapshot: MarketDataSnapshot | null
  errorMessage: string | null
  hasStaleQuotes: boolean
  isLoading: boolean
}) {
  if (props.isLoading) {
    return (
      <div className="state-banner loading">
        <strong>Loading quotes</strong>
        <span>Waiting for the first price update.</span>
      </div>
    )
  }

  if (props.errorMessage) {
    return (
      <div className="state-banner error">
        <strong>Market refresh error</strong>
        <span>{props.errorMessage}</span>
      </div>
    )
  }

  if (props.hasStaleQuotes) {
    return (
      <div className="state-banner stale">
        <strong>Old price in feed</strong>
        <span>One or more symbols are using cached price data.</span>
      </div>
    )
  }

  if (props.snapshot?.warning) {
    return (
      <div className="state-banner warning">
        <strong>Fallback prices</strong>
        <span>{props.snapshot.warning}</span>
      </div>
    )
  }

  return null
}

function StackLayerMap(props: {
  groups: readonly ResearchLayerGroup[]
  scoreBySymbol: Map<string, ResearchCandidateScore>
  selectedSymbol: string
  onSelectSymbol: (symbol: string) => void
}) {
  return (
    <div className="layer-stack">
      {props.groups.map((group) => (
        <div className="layer-row" key={group.id}>
          <div className="layer-row-heading">
            <strong>{group.label}</strong>
            <span>{group.items.length}</span>
          </div>
          <div className="layer-chip-list">
            {group.items.map((item) => {
              const score = props.scoreBySymbol.get(item.symbol)

              return (
                <button
                  className={
                    props.selectedSymbol === item.symbol ? 'is-selected' : ''
                  }
                  key={item.symbol}
                  type="button"
                  onClick={() => props.onSelectSymbol(item.symbol)}
                >
                  <span>{item.symbol}</span>
                  <small>{score ? `${score.scorePercent}` : '0'}</small>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function ResearchCardEditor(props: {
  card: SeedWatchlistItem | null
  codexQueue: CodexQueueRecord
  score: ResearchCandidateScore | null
  onQueueCodexRequest: (card: SeedWatchlistItem) => void
  onCheckCodexResult: (symbol: string) => void
  onImportCodexResult: (symbol: string, file: File) => Promise<void>
  runState: ResearchRunRecord
  onRunSymbol: (symbol: string) => void
  onRunLayer: (layer: AiStackLayerId) => void
  onMarkReviewed: (symbol: string) => void
  onUpdateResearch: (
    symbol: string,
    field: keyof ResearchFields,
    value: string,
  ) => void
  onUpdateTradeSetup: (
    symbol: string,
    field: keyof TradeSetupFields,
    value: string,
  ) => void
}) {
  if (!props.card) {
    return (
      <EmptyState
        detail="Add a watchlist symbol before editing notes."
        title="No research card selected"
      />
    )
  }

  const { card, score } = props

  return (
    <div className="research-card-editor">
      <div className="research-card-topline">
        <div>
          <strong>{card.name}</strong>
          <span>
            {getAiStackLayerLabel(card.stackLayer)} ·{' '}
            {card.seedType === 'current_holding'
              ? 'Holding'
              : 'Watchlist idea'}
          </span>
        </div>
        <ScoreMeter score={score} />
      </div>

      <p className="state-note">
        Notes and setup fields are for your own checklist. Source targets and
        levels are context, not trade instructions.
      </p>

      <ResearchRunDesk
        card={card}
        runState={props.runState}
        onMarkReviewed={props.onMarkReviewed}
        onRunLayer={props.onRunLayer}
        onRunSymbol={props.onRunSymbol}
      />

      <CodexResearchQueueDesk
        card={card}
        queueState={props.codexQueue}
        onCheckResult={props.onCheckCodexResult}
        onImportResult={props.onImportCodexResult}
        onQueueRequest={props.onQueueCodexRequest}
      />

      <div className="research-fields">
        <TextAreaField
          label="Stock brief"
          value={card.research.thesis}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'thesis', value)
          }
        />
        <TextAreaField
          label="What to watch"
          value={card.research.catalyst}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'catalyst', value)
          }
        />
        <TextAreaField
          label="What changes my mind"
          value={card.research.invalidation}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'invalidation', value)
          }
        />
        <TextAreaField
          label="Risk notes"
          value={card.research.riskNotes}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'riskNotes', value)
          }
        />
        <TextAreaField
          label="Source notes"
          value={card.research.sourceNotes}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'sourceNotes', value)
          }
        />
      </div>

      <div className="compact-field-grid">
        <TextField
          label="Entry idea"
          value={card.research.plannedEntry}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'plannedEntry', value)
          }
        />
        <TextField
          label="Stop / risk level"
          value={card.research.stop}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'stop', value)
          }
        />
        <TextField
          label="Source targets"
          value={card.research.target}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'target', value)
          }
        />
        <TextField
          label="Review date"
          type="date"
          value={card.research.reviewDate}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'reviewDate', value)
          }
        />
      </div>

      <div className="setup-block">
        <div className="setup-heading">
          <strong>Trade setup</strong>
          <span>Your plan fields</span>
        </div>
        <div className="setup-grid">
          <TextField
            label="Entry trigger"
            value={card.tradeSetup.entryTrigger}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'entryTrigger', value)
            }
          />
          <TextField
            label="Stop level"
            value={card.tradeSetup.stopLevel}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'stopLevel', value)
            }
          />
          <TextField
            label="Target"
            value={card.tradeSetup.target}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'target', value)
            }
          />
          <TextField
            label="Max loss"
            value={card.tradeSetup.maxLoss}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'maxLoss', value)
            }
          />
          <TextField
            label="Take-profit plan"
            value={card.tradeSetup.plannedScaleOut}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'plannedScaleOut', value)
            }
          />
          <TextField
            label="What cancels this trade"
            value={card.tradeSetup.invalidation}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'invalidation', value)
            }
          />
          <TextField
            label="Time horizon"
            value={card.tradeSetup.timeHorizon}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'timeHorizon', value)
            }
          />
        </div>
      </div>
    </div>
  )
}

function CodexResearchQueueDesk(props: {
  card: SeedWatchlistItem
  queueState: CodexQueueRecord
  onQueueRequest: (card: SeedWatchlistItem) => void
  onCheckResult: (symbol: string) => void
  onImportResult: (symbol: string, file: File) => Promise<void>
}) {
  const { card, queueState } = props

  function importSelectedFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    void props.onImportResult(card.symbol, file)
  }

  return (
    <div className={`codex-queue-desk ${queueState.status}`}>
      <div className="research-run-actions">
        <button type="button" onClick={() => props.onQueueRequest(card)}>
          Create research file
        </button>
        <button type="button" onClick={() => props.onCheckResult(card.symbol)}>
          Look for result
        </button>
        <label className="file-button">
          <span>Import result JSON</span>
          <input
            accept="application/json,.json"
            type="file"
            onChange={importSelectedFile}
          />
        </label>
      </div>

      <div className={`codex-queue-state ${queueState.status}`}>
        <strong>{getCodexQueueStatusLabel(queueState.status)}</strong>
        <span>{queueState.message}</span>
        {queueState.updatedAt && (
          <time>{formatDateTime(queueState.updatedAt)}</time>
        )}
      </div>

      {(queueState.requestPath || queueState.resultPath) && (
        <div className="queue-path-list" aria-label="Local queue paths">
          {queueState.requestPath && (
            <span>Request: {queueState.requestPath}</span>
          )}
          {queueState.resultPath && <span>Result: {queueState.resultPath}</span>}
        </div>
      )}

      {queueState.errors.length > 0 && (
        <ul className="queue-error-list">
          {queueState.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResearchRunDesk(props: {
  card: SeedWatchlistItem
  runState: ResearchRunRecord
  onRunSymbol: (symbol: string) => void
  onRunLayer: (layer: AiStackLayerId) => void
  onMarkReviewed: (symbol: string) => void
}) {
  const { card, runState } = props
  const isLoading = runState.status === 'loading'
  const canMarkReviewed =
    runState.status === 'needs_review' || runState.status === 'stale_source'

  return (
    <div className={`research-run-desk ${runState.status}`}>
      <div className="research-run-actions">
        <button
          disabled={isLoading}
          type="button"
          onClick={() => props.onRunSymbol(card.symbol)}
        >
          {isLoading ? 'Running' : 'Draft notes'}
        </button>
        <button
          disabled={isLoading}
          type="button"
          onClick={() => props.onRunLayer(card.stackLayer)}
        >
          Draft group
        </button>
        {canMarkReviewed && (
          <button
            type="button"
            onClick={() => props.onMarkReviewed(card.symbol)}
          >
            I reviewed this
          </button>
        )}
      </div>

      <div className={`research-run-state ${runState.status}`}>
        <strong>{getResearchRunStatusLabel(runState.status)}</strong>
        <span>{runState.message}</span>
        {runState.updatedAt && (
          <time>{formatDateTime(runState.updatedAt)}</time>
        )}
      </div>

      <p className="state-note">{RESEARCH_DRAFT_DISCLOSURE}</p>

      {runState.sources.length > 0 ? (
        <ResearchSourceList sources={runState.sources} />
      ) : (
        runState.status === 'empty_source' && (
          <EmptyState
            detail="No source list is configured for this symbol yet."
            title="No sources found"
          />
        )
      )}
    </div>
  )
}

function ResearchSourceList(props: { sources: readonly ResearchSource[] }) {
  return (
    <div className="research-source-list">
      {props.sources.map((source) => (
        <article
          className={`research-source-row ${source.freshness}`}
          key={source.id}
        >
          <div>
            <strong>{describeResearchSourceType(source.type)}</strong>
            <span>{source.title}</span>
          </div>
          <a href={source.url} rel="noreferrer" target="_blank">
            {source.url}
          </a>
          <div>
            <time dateTime={source.retrievedAt}>
              Retrieved {formatDateTime(source.retrievedAt)}
            </time>
            <span>{source.freshness === 'stale' ? 'Old' : 'Fresh'}</span>
          </div>
          <p>{source.summary}</p>
        </article>
      ))}
    </div>
  )
}

function CandidateFilterDesk(props: {
  filters: ResearchFiltersForm
  scores: readonly ResearchCandidateScore[]
  selectedSymbol: string
  onSelectSymbol: (symbol: string) => void
  onUpdateFilter: (
    field: keyof ResearchFiltersForm,
    value: string | boolean,
  ) => void
}) {
  return (
    <div className="candidate-filter-desk">
      <div className="filter-grid">
        <label className="setting-control">
          <span>Group</span>
          <select
            value={props.filters.layer}
            onChange={(event) =>
              props.onUpdateFilter(
                'layer',
                event.target.value as ResearchFiltersForm['layer'],
              )
            }
          >
            <option value="all">All groups</option>
            {AI_STACK_LAYERS.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.label}
              </option>
            ))}
          </select>
        </label>
        <NumberSetting
          label="Minimum filled in"
          max="100"
          min="0"
          suffix="/100"
          value={props.filters.minimumScore}
          onChange={(value) => props.onUpdateFilter('minimumScore', value)}
        />
        <label className="setting-control toggle-control">
          <span>Holdings only</span>
          <input
            checked={props.filters.holdingsOnly}
            type="checkbox"
            onChange={(event) =>
              props.onUpdateFilter('holdingsOnly', event.target.checked)
            }
          />
        </label>
        <label className="setting-control toggle-control">
          <span>Needs details</span>
          <input
            checked={props.filters.needsInputOnly}
            type="checkbox"
            onChange={(event) =>
              props.onUpdateFilter('needsInputOnly', event.target.checked)
            }
          />
        </label>
      </div>
      <p className="state-note">
        Score only means more fields are filled in. It does not mean the trade
        is good.
      </p>
      <CandidateScoreList
        scores={props.scores}
        selectedSymbol={props.selectedSymbol}
        onSelectSymbol={props.onSelectSymbol}
      />
    </div>
  )
}

function CandidateScoreList(props: {
  scores: readonly ResearchCandidateScore[]
  selectedSymbol: string
  onSelectSymbol: (symbol: string) => void
}) {
  if (props.scores.length === 0) {
    return (
      <EmptyState
        detail="Clear a group, score, or details filter to show more ideas."
        title="No ideas match"
      />
    )
  }

  return (
    <div className="candidate-score-list">
      {props.scores.map((score) => (
        <button
          className={props.selectedSymbol === score.symbol ? 'is-selected' : ''}
          key={score.symbol}
          type="button"
          onClick={() => props.onSelectSymbol(score.symbol)}
        >
          <span className="candidate-score">{score.scorePercent}</span>
          <span>
            <strong>{score.symbol}</strong>
            <small>
              {getAiStackLayerLabel(score.stackLayer)} · {score.statusLabel}
            </small>
          </span>
          <small>{score.missingFields.length} open</small>
        </button>
      ))}
    </div>
  )
}

function ScoreMeter(props: { score: ResearchCandidateScore | null }) {
  const scorePercent = props.score?.scorePercent ?? 0

  return (
    <div className="score-meter">
      <span>{scorePercent}/100</span>
      <div
        aria-hidden="true"
        style={{ '--score-width': `${scorePercent}%` } as CSSProperties}
      >
        <span />
      </div>
      <small>{props.score?.missingFields.length ?? 0} open fields</small>
    </div>
  )
}

function TextField(props: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date'
}) {
  return (
    <label className="field-control">
      <span>{props.label}</span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  )
}

function TextAreaField(props: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field-control">
      <span>{props.label}</span>
      <textarea
        rows={3}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  )
}

function TopScenarioList(props: {
  scenarios: readonly ScenarioCandidate[]
  manualLotsNeeded: number
  selectedSymbol: string
  onSelectSymbol: (symbol: string) => void
}) {
  if (props.scenarios.length === 0) {
    return (
      <EmptyState
        detail={
          props.manualLotsNeeded > 0
            ? `${props.manualLotsNeeded} positions still need shares and cost.`
            : 'No cash idea is ready at the current prices.'
        }
        title="No cash ideas yet"
      />
    )
  }

  return (
    <ol className="scenario-list">
      {props.scenarios.map((scenario, index) => (
        <li key={`${scenario.symbol}-${scenario.id}`}>
          <button
            className={
              props.selectedSymbol === scenario.symbol ? 'is-selected' : ''
            }
            type="button"
            onClick={() => props.onSelectSymbol(scenario.symbol)}
          >
            <span className="rank">{String(index + 1).padStart(2, '0')}</span>
            <span>
              <strong>
                {scenario.symbol} · {scenario.title}
              </strong>
              <small>{scenario.positionName}</small>
            </span>
            <span className="scenario-cash">
              {formatCurrency(scenario.estimatedNetCash)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function AllocationChart(props: {
  rows: readonly AllocationRow[]
  isLoading: boolean
}) {
  if (props.isLoading) {
    return <SkeletonRows count={4} />
  }

  if (props.rows.length === 0) {
    return (
      <EmptyState
        detail="Enter shares and average cost before allocation is calculated."
        title="No allocation yet"
      />
    )
  }

  return (
    <div className="allocation-chart">
      <div className="allocation-stack" aria-hidden="true">
        {props.rows.map((row) => (
          <span
            key={row.symbol}
            style={
              {
                '--segment-color': row.color,
                '--segment-width': `${row.weightPercent}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="chart-list">
        {props.rows.map((row) => (
          <div className="chart-row" key={row.symbol}>
            <span className="legend-dot" style={{ background: row.color }} />
            <span>
              <strong>{row.symbol}</strong>
              <small>{row.name}</small>
            </span>
            <span className="mono">{formatPercent(row.weightPercent)}</span>
            <span className="mono">{formatCurrency(row.marketValue)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GainChart(props: { rows: readonly GainRow[]; isLoading: boolean }) {
  if (props.isLoading) {
    return <SkeletonRows count={4} />
  }

  if (props.rows.length === 0) {
    return (
      <EmptyState
        detail="Enter shares and average cost for at least one holding."
        title="No open P/L yet"
      />
    )
  }

  const maxGain = Math.max(
    1,
    ...props.rows.map((row) => Math.abs(row.unrealizedGain)),
  )

  return (
    <div className="bar-chart">
      {props.rows.map((row) => {
        const width = (Math.abs(row.unrealizedGain) / maxGain) * 100
        const tone = row.unrealizedGain >= 0 ? 'positive' : 'negative'

        return (
          <div className="gain-row" key={row.symbol}>
            <div className="chart-row-label">
              <strong>{row.symbol}</strong>
              <span>{formatSignedPercent(row.unrealizedGainPercent)}</span>
            </div>
            <div className="gain-track">
              <span
                className={`gain-fill ${tone}`}
                style={
                  {
                    '--bar-color': row.color,
                    '--bar-width': `${width}%`,
                  } as CSSProperties
                }
              />
            </div>
            <span className={`mono ${tone}`}>
              {formatSignedCurrency(row.unrealizedGain)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ConcentrationChart(props: {
  rows: readonly ConcentrationRow[]
  alertPercent: number
  capPercent: number
}) {
  return (
    <div className="concentration-chart">
      <div className="threshold-key">
        <span>Warn {formatPercent(props.alertPercent)}</span>
        <span>Cap {formatPercent(props.capPercent)}</span>
      </div>
      {props.rows.map((row) => {
        const weight = row.weightPercent ?? 0

        return (
          <div className="concentration-row" key={row.symbol}>
            <div className="chart-row-label">
              <strong>{row.symbol}</strong>
              <span>{row.label}</span>
            </div>
            <div
              className={`risk-track ${row.concentrationLevel}`}
              style={
                {
                  '--bar-color': row.color,
                  '--bar-width': `${Math.min(weight, 100)}%`,
                  '--alert-left': `${Math.min(props.alertPercent, 100)}%`,
                  '--cap-left': `${Math.min(props.capPercent, 100)}%`,
                } as CSSProperties
              }
            >
              <span className="threshold alert" />
              <span className="threshold cap" />
              <span className="risk-fill" />
            </div>
            <span className="mono">{formatPercent(row.weightPercent)}</span>
          </div>
        )
      })}
    </div>
  )
}

function MovementChart(props: {
  rows: readonly PriceMovementRow[]
  isLoading: boolean
}) {
  if (props.isLoading) {
    return <SkeletonRows count={6} />
  }

  if (props.rows.length === 0) {
    return (
      <EmptyState
        detail="No symbols are set up for the price feed."
        title="No watchlist symbols"
      />
    )
  }

  const maxMove = Math.max(
    0.01,
    ...props.rows.map((row) => Math.abs(row.changePercent ?? 0)),
  )

  return (
    <div className="movement-chart">
      {props.rows.map((row) => {
        const changePercent = row.changePercent ?? 0
        const width = Math.max(1, (Math.abs(changePercent) / maxMove) * 50)
        const tone = changePercent >= 0 ? 'positive' : 'negative'

        return (
          <div className="movement-row" key={row.symbol}>
            <div className="chart-row-label">
              <strong>{row.symbol}</strong>
              <span>{row.layer}</span>
            </div>
            <div className="movement-track">
              <span className="movement-zero" />
              <span
                className={`movement-fill ${tone}`}
                style={
                  {
                    '--movement-color': row.color,
                    '--movement-width': `${width}%`,
                  } as CSSProperties
                }
              />
            </div>
            <div className="movement-value">
              <span className="mono">{formatMarketPrice(row.price)}</span>
              <small className={tone}>
                {formatSignedCurrency(row.change)} /{' '}
                {formatSignedPercent(row.changePercent)}
              </small>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ManualLotTable(props: {
  holdingForm: HoldingForm
  positions: ReturnType<typeof buildPortfolioModel>['positions']
  manualLots: ManualLotInputs
  onAddHolding: (event: FormEvent<HTMLFormElement>) => void
  onRemoveHolding: (symbol: string) => void
  onUpdate: (
    symbol: string,
    field: keyof ManualLotInputs[string],
    value: string,
  ) => void
  onUpdateHoldingForm: (field: keyof HoldingForm, value: string) => void
}) {
  return (
    <div className="holding-input-desk">
      <form className="holding-add-form" onSubmit={props.onAddHolding}>
        <label className="field-control">
          <span>Symbol</span>
          <input
            required
            placeholder="TSLA"
            value={props.holdingForm.symbol}
            onChange={(event) =>
              props.onUpdateHoldingForm('symbol', event.target.value)
            }
          />
        </label>
        <label className="field-control">
          <span>Name</span>
          <input
            placeholder="Company name"
            value={props.holdingForm.name}
            onChange={(event) =>
              props.onUpdateHoldingForm('name', event.target.value)
            }
          />
        </label>
        <label className="field-control">
          <span>Group</span>
          <select
            value={props.holdingForm.stackLayer}
            onChange={(event) =>
              props.onUpdateHoldingForm(
                'stackLayer',
                event.target.value as AiStackLayerId,
              )
            }
          >
            {AI_STACK_LAYERS.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-control">
          <span>Shares</span>
          <input
            min="0"
            step="0.0001"
            type="number"
            value={props.holdingForm.shares}
            onChange={(event) =>
              props.onUpdateHoldingForm('shares', event.target.value)
            }
          />
        </label>
        <label className="field-control">
          <span>Avg cost</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={props.holdingForm.averageCost}
            onChange={(event) =>
              props.onUpdateHoldingForm('averageCost', event.target.value)
            }
          />
        </label>
        <button className="form-action-button" type="submit">
          Add / update
        </button>
      </form>

      {props.positions.length === 0 ? (
        <EmptyState
          detail="Add a symbol, shares, and average cost to start the portfolio view."
          title="No holdings added"
        />
      ) : (
        <div className="lot-table">
          {props.positions.map((position) => (
            <div className="lot-row" key={position.symbol}>
              <div>
                <strong>{position.symbol}</strong>
                <span>{position.name}</span>
              </div>
              <label>
                <span>Shares</span>
                <input
                  min="0"
                  step="0.0001"
                  type="number"
                  value={props.manualLots[position.symbol]?.shares ?? ''}
                  onChange={(event) =>
                    props.onUpdate(
                      position.symbol,
                      'shares',
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                <span>Avg cost</span>
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={props.manualLots[position.symbol]?.averageCost ?? ''}
                  onChange={(event) =>
                    props.onUpdate(
                      position.symbol,
                      'averageCost',
                      event.target.value,
                    )
                  }
                />
              </label>
              <span className={`risk-chip ${position.concentrationLevel}`}>
                {position.concentrationLabel}
              </span>
              <span className="mono">{formatCurrency(position.marketValue)}</span>
              <button
                className="inline-action-button"
                type="button"
                onClick={() => props.onRemoveHolding(position.symbol)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NumberSetting(props: {
  label: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  min?: string
  max?: string
  disabled?: boolean
}) {
  return (
    <label className="setting-control">
      <span>{props.label}</span>
      <div className="affixed-input">
        {props.prefix && <span>{props.prefix}</span>}
        <input
          disabled={props.disabled}
          max={props.max}
          min={props.min}
          step="0.01"
          type="number"
          value={props.value}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            props.onChange(event.target.value)
          }
        />
        {props.suffix && <span>{props.suffix}</span>}
      </div>
    </label>
  )
}

function ScenarioPlannerDesk(props: {
  cards: readonly SeedWatchlistItem[]
  cashTargetInput: string
  fields: ScenarioPlannerForm
  profitLockTickets: readonly ProfitLockTicket[]
  scenario: TargetStopScenario
  selectedSymbol: string
  taxReserveLabel: string
  onSelectSymbol: (symbol: string) => void
  onUpdateCashTarget: (value: string) => void
  onUpdateField: (field: keyof ScenarioPlannerForm, value: string) => void
}) {
  return (
    <div className="target-planner">
      <div className="planner-controls">
        <label className="setting-control">
          <span>Symbol</span>
          <select
            value={props.selectedSymbol}
            onChange={(event) => props.onSelectSymbol(event.target.value)}
          >
            {props.cards.map((card) => (
              <option key={card.symbol} value={card.symbol}>
                {card.symbol} · {card.name}
              </option>
            ))}
          </select>
        </label>
        <NumberSetting
          label="Cash goal"
          min="0"
          prefix="$"
          value={props.cashTargetInput}
          onChange={props.onUpdateCashTarget}
        />
        <div className={`planner-status ${props.scenario.status}`}>
          <span>Plan status</span>
          <strong>{getScenarioPlannerStatusLabel(props.scenario.status)}</strong>
          <small>
            {props.scenario.sourceLabel} · {props.scenario.timeHorizon}
          </small>
        </div>
        <div className="planner-status">
          <span>Tax reserve</span>
          <strong>{props.taxReserveLabel}</strong>
          <small>Estimate only</small>
        </div>
      </div>

      <div className="planner-input-grid">
        <NumberSetting
          label="Current price"
          min="0"
          prefix="$"
          value={props.fields.currentPrice}
          onChange={(value) => props.onUpdateField('currentPrice', value)}
        />
        <NumberSetting
          label="Average cost"
          min="0"
          prefix="$"
          value={props.fields.averageCost}
          onChange={(value) => props.onUpdateField('averageCost', value)}
        />
        <NumberSetting
          label="Shares"
          min="0"
          value={props.fields.shares}
          onChange={(value) => props.onUpdateField('shares', value)}
        />
        <NumberSetting
          label="Max loss"
          min="0"
          prefix="$"
          value={props.fields.maxLossDollars}
          onChange={(value) => props.onUpdateField('maxLossDollars', value)}
        />
        <NumberSetting
          label="Reward target"
          min="0"
          suffix="R"
          value={props.fields.desiredRiskReward}
          onChange={(value) => props.onUpdateField('desiredRiskReward', value)}
        />
        <NumberSetting
          label="Target gain"
          min="0"
          suffix="%"
          value={props.fields.targetGainPercent}
          onChange={(value) => props.onUpdateField('targetGainPercent', value)}
        />
        <NumberSetting
          label="Trim size"
          max="100"
          min="0"
          suffix="%"
          value={props.fields.trimPercent}
          onChange={(value) => props.onUpdateField('trimPercent', value)}
        />
        <NumberSetting
          label="Support price"
          min="0"
          prefix="$"
          value={props.fields.supportPrice}
          onChange={(value) => props.onUpdateField('supportPrice', value)}
        />
        <NumberSetting
          label="Stop-limit buffer"
          min="0"
          suffix="%"
          value={props.fields.stopLimitBufferPercent}
          onChange={(value) =>
            props.onUpdateField('stopLimitBufferPercent', value)
          }
        />
        <TextField
          label="Time horizon"
          value={props.fields.timeHorizon}
          onChange={(value) => props.onUpdateField('timeHorizon', value)}
        />
      </div>

      <p className="state-note">{SCENARIO_PLANNER_DISCLOSURE}</p>
      <ScenarioPlannerOutput scenario={props.scenario} />

      <div className="profit-ticket-section">
        <div className="setup-heading">
          <strong>Gain-lock tickets</strong>
          <span>For this symbol</span>
        </div>
        {props.profitLockTickets.length === 0 ? (
          <EmptyState
            detail={`Enter shares and cost for ${props.selectedSymbol}, or select a holding with those details filled in.`}
            title="No tickets for this holding"
          />
        ) : (
          <div className="ticket-grid">
            {props.profitLockTickets.map((ticket) => (
              <ProfitLockTicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ScenarioPlannerOutput(props: { scenario: TargetStopScenario }) {
  const { scenario } = props

  return (
    <div className={`scenario-plan-output ${scenario.status}`}>
      <div className="scenario-plan-topline">
        <div>
          <strong>{scenario.symbol} price plan</strong>
          <span>{scenario.name}</span>
        </div>
        <span className={`ticket-state ${scenario.status}`}>
          {getScenarioPlannerStatusLabel(scenario.status)}
        </span>
      </div>

      {scenario.issues.length > 0 && (
        <ul className="planner-issue-list">
          {scenario.issues.map((issue) => (
            <li className={issue.severity} key={`${issue.code}-${issue.message}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <div className="level-output-grid">
        <ScenarioLevel
          label="Planned entry"
          reason={scenario.plannedEntry.reason}
          value={formatCurrency(scenario.plannedEntry.value)}
        />
        <ScenarioLevel
          label="Stop level"
          reason={scenario.stopLevel.reason}
          value={formatCurrency(scenario.stopLevel.value)}
        />
        <ScenarioLevel
          label="Stop-limit note"
          reason={scenario.stopLimit.note}
          value={formatCurrency(scenario.stopLimit.limit)}
        />
        <ScenarioLevel
          label="First sell target"
          reason={scenario.firstTarget.reason}
          value={formatCurrency(scenario.firstTarget.value)}
        />
        <ScenarioLevel
          label="Higher target"
          reason={scenario.stretchTarget.reason}
          value={formatCurrency(scenario.stretchTarget.value)}
        />
        <ScenarioLevel
          label="Shares to trim"
          reason={scenario.trimShares.reason}
          value={formatShares(scenario.trimShares.value)}
        />
        <ScenarioLevel
          label="Cash raised"
          reason={scenario.estimatedProceeds.reason}
          value={formatCurrency(scenario.estimatedProceeds.value)}
        />
        <ScenarioLevel
          label="Estimated P/L"
          reason={scenario.estimatedGainLoss.reason}
          tone={getSignedTone(scenario.estimatedGainLoss.value ?? 0)}
          value={formatSignedCurrency(scenario.estimatedGainLoss.value)}
        />
        <ScenarioLevel
          label="Remaining position"
          reason={scenario.remainingShares.reason}
          value={`${formatShares(scenario.remainingShares.value)} sh`}
        />
        <ScenarioLevel
          label="Remaining value"
          reason={scenario.remainingPositionValue.reason}
          value={formatCurrency(scenario.remainingPositionValue.value)}
        />
      </div>
    </div>
  )
}

function ScenarioLevel(props: {
  label: string
  value: string
  reason: string
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'danger'
}) {
  return (
    <article className="scenario-level">
      <span>{props.label}</span>
      <strong className={props.tone ?? 'neutral'}>{props.value}</strong>
      <small>{props.reason}</small>
    </article>
  )
}

function ProfitLockTicketCard(props: { ticket: ProfitLockTicket }) {
  const { ticket } = props

  return (
    <article className={`ticket-row ${ticket.status}`}>
      <div className="ticket-topline">
        <span className={`ticket-state ${ticket.status}`}>
          {ticket.status === 'ready' ? 'Planning idea' : 'Needs details'}
        </span>
        <strong>{ticket.title}</strong>
      </div>
      <p>{ticket.description}</p>
      <dl>
        <div>
          <dt>Shares</dt>
          <dd>{formatShares(ticket.sharesToSell)}</dd>
        </div>
        <div>
          <dt>Proceeds</dt>
          <dd>{formatCurrency(ticket.estimatedProceeds)}</dd>
        </div>
        <div>
          <dt>Gain</dt>
          <dd>{formatSignedCurrency(ticket.estimatedRealizedGain)}</dd>
        </div>
        <div>
          <dt>Reserve</dt>
          <dd>{formatCurrency(ticket.estimatedTaxReserve)}</dd>
        </div>
        <div>
          <dt>Net cash</dt>
          <dd>{formatCurrency(ticket.estimatedNetCash)}</dd>
        </div>
        <div>
          <dt>Weight left</dt>
          <dd>{formatPercent(ticket.remainingWeightPercent)}</dd>
        </div>
      </dl>
      <p className="state-note">{ticket.note}</p>
    </article>
  )
}

function TradeJournalDesk(props: {
  tickets: readonly ManualTradeTicket[]
  entries: readonly TradeJournalEntry[]
  summary: RealizedProfitSummary
  profitCashPlan: ProfitCashPlan
  payYourselfForm: PayYourselfForm
  onAddEntry: (
    ticket: ManualTradeTicket,
    status: TradeJournalEntryStatus,
  ) => void
  onAddMistake: () => void
  onExport: () => void
  onSelectSymbol: (symbol: string) => void
  onUpdateEntry: (
    id: string,
    field: JournalEntryEditableField,
    value: string,
  ) => void
  onUpdatePayYourself: (
    field: keyof PayYourselfForm,
    value: string | boolean,
  ) => void
}) {
  return (
    <div className="trade-journal-desk">
      <p className="state-note">{TRADE_JOURNAL_DISCLOSURE}</p>

      <div className="journal-rule-grid">
        <label className="setting-control toggle-control">
          <span>Pay yourself</span>
          <input
            checked={props.payYourselfForm.enabled}
            type="checkbox"
            onChange={(event) =>
              props.onUpdatePayYourself('enabled', event.target.checked)
            }
          />
        </label>
        <NumberSetting
          disabled={!props.payYourselfForm.enabled}
          label="Percent after reserve"
          max="100"
          min="0"
          suffix="%"
          value={props.payYourselfForm.percentOfNetAfterReserve}
          onChange={(value) =>
            props.onUpdatePayYourself('percentOfNetAfterReserve', value)
          }
        />
        <div className="journal-actions">
          <button type="button" onClick={props.onAddMistake}>
            Log mistake
          </button>
          <button
            disabled={props.entries.length === 0}
            type="button"
            onClick={props.onExport}
          >
            Export tax review JSON
          </button>
        </div>
      </div>

      <JournalSummaryGrid summary={props.summary} />

      <ProfitCashPlanPanel
        plan={props.profitCashPlan}
        onSelectSymbol={props.onSelectSymbol}
      />

      <div className="setup-heading">
        <strong>Trade checklists</strong>
        <span>{props.tickets.length} generated</span>
      </div>
      {props.tickets.length === 0 ? (
        <EmptyState
          detail="Fill in a gain-lock idea or trade setup before checklists show up."
          title="No trade checklists"
        />
      ) : (
        <div className="manual-ticket-grid">
          {props.tickets.map((ticket) => (
            <ManualTradeTicketCard
              key={ticket.id}
              ticket={ticket}
              onAddEntry={props.onAddEntry}
            />
          ))}
        </div>
      )}

      <div className="setup-heading">
        <strong>Trade journal</strong>
        <span>{props.entries.length} local</span>
      </div>
      {props.entries.length === 0 ? (
        <EmptyState
          detail="Plan a trade, log a fill, capture a mistake, or record the result."
          title="No journal rows yet"
        />
      ) : (
        <div className="journal-entry-list">
          {props.entries.map((entry) => (
            <JournalEntryCard
              entry={entry}
              key={entry.id}
              onUpdate={props.onUpdateEntry}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function JournalSummaryGrid(props: { summary: RealizedProfitSummary }) {
  const { summary } = props

  return (
    <div className="journal-summary-grid" aria-label="Realized profit summary">
      <ScenarioLevel
        label="Net realized P/L"
        reason={`${summary.realizedEntryCount} realized rows; planned rows are not counted.`}
        tone={getSignedTone(summary.netRealizedTradingProfit)}
        value={formatSignedCurrency(summary.netRealizedTradingProfit)}
      />
      <ScenarioLevel
        label="Reserve estimate"
        reason="Reserve estimates from fills, mistakes, and result rows."
        value={formatCurrency(summary.taxReserveEstimate)}
      />
      <ScenarioLevel
        label="After reserve"
        reason="Net realized trading profit minus the reserve estimate."
        tone={getSignedTone(summary.profitAfterReserve)}
        value={formatCurrency(summary.profitAfterReserve)}
      />
      <ScenarioLevel
        label="Pay yourself"
        reason={`${formatCurrency(
          summary.loggedPayYourselfAmount,
        )} already logged; ${formatCurrency(summary.remainingPayYourselfAmount)} left by the rule.`}
        value={formatCurrency(summary.recommendedPayYourselfAmount)}
      />
      <ScenarioLevel
        label="Tax notes"
        reason={`${summary.taxPrepEntryCount} rows include notes for tax review.`}
        value={`${summary.taxPrepEntryCount}/${summary.entryCount}`}
      />
    </div>
  )
}

function ProfitCashPlanPanel(props: {
  plan: ProfitCashPlan
  onSelectSymbol: (symbol: string) => void
}) {
  const { plan } = props

  return (
    <section className="profit-cash-plan" aria-label="Profit cash plan">
      <div className="setup-heading">
        <strong>Profit cash plan</strong>
        <span>{formatCurrency(plan.cashToPlan)} after pay-yourself</span>
      </div>
      <p className="state-note">{PROFIT_CASH_PLAN_DISCLOSURE}</p>

      <div className="profit-cash-summary">
        <ScenarioLevel
          label="After reserve"
          reason="Net realized profit minus the tax reserve estimate."
          value={formatCurrency(plan.profitAfterReserve)}
        />
        <ScenarioLevel
          label="Pay-yourself set aside"
          reason="Uses the rule above before planning what is left."
          value={formatCurrency(plan.payYourselfAmount)}
        />
        <ScenarioLevel
          label="Cash to place"
          reason="The amount left to review for reinvesting, buying back, or staying in cash."
          value={formatCurrency(plan.cashToPlan)}
        />
      </div>

      {plan.cashToPlan <= 0 ? (
        <EmptyState
          detail="Log an executed trade, mistake, or result row with realized profit to see cash left after reserve and pay-yourself."
          title="No profit cash to plan yet"
        />
      ) : (
        <div className="profit-cash-grid">
          {plan.candidates.map((candidate) => (
            <ProfitCashCandidateCard
              candidate={candidate}
              key={candidate.id}
              onSelectSymbol={props.onSelectSymbol}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ProfitCashCandidateCard(props: {
  candidate: ProfitCashCandidate
  onSelectSymbol: (symbol: string) => void
}) {
  const { candidate } = props
  const canOpenSymbol = candidate.kind !== 'cash'

  return (
    <article className={`profit-cash-card ${candidate.kind}`}>
      <div className="ticket-topline">
        <span className="ticket-state ready">{candidate.label}</span>
        <strong>
          {candidate.symbol} · {candidate.name}
        </strong>
      </div>

      <dl>
        <div>
          <dt>Price</dt>
          <dd>{formatCurrency(candidate.currentPrice)}</dd>
        </div>
        <div>
          <dt>Est shares</dt>
          <dd>{formatShares(candidate.estimatedShares)}</dd>
        </div>
        <div>
          <dt>Research</dt>
          <dd>
            {candidate.researchScorePercent === null
              ? 'Not scored'
              : `${candidate.researchScorePercent}%`}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{candidate.statusLabel}</dd>
        </div>
      </dl>

      <div className="ticket-copy">
        <p>
          <strong>Why review it</strong>
          <span>{candidate.reason}</span>
        </p>
        <p>
          <strong>Next step</strong>
          <span>{candidate.nextStep}</span>
        </p>
      </div>

      {canOpenSymbol && (
        <div className="ticket-actions">
          <button
            type="button"
            onClick={() => props.onSelectSymbol(candidate.symbol)}
          >
            Open research
          </button>
        </div>
      )}
    </article>
  )
}

function ManualTradeTicketCard(props: {
  ticket: ManualTradeTicket
  onAddEntry: (
    ticket: ManualTradeTicket,
    status: TradeJournalEntryStatus,
  ) => void
}) {
  const { ticket } = props
  const canLogRealized = ticket.status === 'ready'

  return (
    <article className={`manual-ticket-card ${ticket.status}`}>
      <div className="ticket-topline">
        <span className={`ticket-state ${ticket.status}`}>
          {ticket.status === 'ready' ? 'Ready to use' : 'Needs details'}
        </span>
        <strong>
          {ticket.symbol} · {ticket.action}
        </strong>
      </div>

      <dl>
        <div>
          <dt>Action</dt>
          <dd>{ticket.action}</dd>
        </div>
        <div>
          <dt>Shares</dt>
          <dd>{formatShares(ticket.estimatedShares)}</dd>
        </div>
        <div>
          <dt>Raised</dt>
          <dd>{formatCurrency(ticket.estimatedCashRaised)}</dd>
        </div>
        <div>
          <dt>Spent</dt>
          <dd>{formatCurrency(ticket.estimatedCashSpent)}</dd>
        </div>
        <div>
          <dt>Realized</dt>
          <dd>{formatSignedCurrency(ticket.estimatedRealizedGain)}</dd>
        </div>
        <div>
          <dt>Reserve</dt>
          <dd>{formatCurrency(ticket.taxReserveEstimate)}</dd>
        </div>
      </dl>

      <div className="ticket-copy">
        <p>
          <strong>Reason</strong>
          <span>{ticket.reason}</span>
        </p>
        <p>
          <strong>Cancel if</strong>
          <span>{ticket.invalidation}</span>
        </p>
      </div>

      <ul className="ticket-checklist">
        {ticket.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className="ticket-actions">
        <button
          type="button"
          onClick={() => props.onAddEntry(ticket, 'planned')}
        >
          Plan
        </button>
        <button
          disabled={!canLogRealized}
          type="button"
          onClick={() => props.onAddEntry(ticket, 'executed')}
        >
          Executed
        </button>
        <button
          type="button"
          onClick={() => props.onAddEntry(ticket, 'mistake')}
        >
          Mistake
        </button>
        <button
          disabled={!canLogRealized}
          type="button"
          onClick={() => props.onAddEntry(ticket, 'result')}
        >
          Result
        </button>
      </div>
    </article>
  )
}

function JournalEntryCard(props: {
  entry: TradeJournalEntry
  onUpdate: (
    id: string,
    field: JournalEntryEditableField,
    value: string,
  ) => void
}) {
  const { entry } = props

  return (
    <article className={`journal-entry-card ${entry.status}`}>
      <div className="journal-entry-topline">
        <div>
          <span className={`ticket-state ${entry.status}`}>
            {getJournalStatusLabel(entry.status)}
          </span>
          <strong>
            {entry.symbol} · {entry.action}
          </strong>
          <time>{formatDateTime(entry.createdAt)}</time>
        </div>
        <span className="mono">
          {formatSignedCurrency(entry.realizedProfitLoss)}
        </span>
      </div>

      <div className="journal-entry-metrics">
        <ScenarioLevel
          label="Shares"
          reason={entry.ticketId ?? 'Manual entry'}
          value={formatShares(entry.shares)}
        />
        <ScenarioLevel
          label="Cash raised"
          reason="Cash raised from this journal row."
          value={formatCurrency(entry.cashRaised)}
        />
        <ScenarioLevel
          label="Cash spent"
          reason="Cash spent from this journal row."
          value={formatCurrency(entry.cashSpent)}
        />
      </div>

      <div className="journal-edit-grid">
        <NumberEntryField
          label="Realized P/L"
          value={formatEditableNumber(entry.realizedProfitLoss)}
          onChange={(value) =>
            props.onUpdate(entry.id, 'realizedProfitLoss', value)
          }
        />
        <NumberEntryField
          label="Reserve"
          min="0"
          value={formatEditableNumber(entry.taxReserveEstimate)}
          onChange={(value) =>
            props.onUpdate(entry.id, 'taxReserveEstimate', value)
          }
        />
        <NumberEntryField
          label="Pay yourself"
          min="0"
          value={formatEditableNumber(entry.payYourselfAmount)}
          onChange={(value) =>
            props.onUpdate(entry.id, 'payYourselfAmount', value)
          }
        />
      </div>

      <div className="research-fields">
        <TextAreaField
          label="Journal notes"
          value={entry.notes}
          onChange={(value) => props.onUpdate(entry.id, 'notes', value)}
        />
        <TextAreaField
          label="Tax notes"
          value={entry.taxPrepNotes}
          onChange={(value) => props.onUpdate(entry.id, 'taxPrepNotes', value)}
        />
      </div>
    </article>
  )
}

function NumberEntryField(props: {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
}) {
  return (
    <label className="field-control">
      <span>{props.label}</span>
      <input
        min={props.min}
        step="0.01"
        type="number"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  )
}

function QuoteTable(props: {
  symbols: readonly string[]
  labels: ReadonlyMap<string, SymbolLabel>
  quotesBySymbol: Map<string, MarketQuote>
  isLoading: boolean
}) {
  if (props.isLoading) {
    return <SkeletonRows count={8} />
  }

  return (
    <div className="quote-table">
      {props.symbols.map((symbol) => {
        const quote = props.quotesBySymbol.get(symbol)
        const label = getSymbolLabel(symbol, props.labels)

        return (
          <div className="quote-row" key={symbol}>
            <div>
              <strong>{symbol}</strong>
              <span>{label.name}</span>
            </div>
            <span className="mono">{formatMarketPrice(quote?.price)}</span>
            <span className="mono">{formatBidAsk(quote)}</span>
            <span>{formatQuoteSource(quote)}</span>
            <span>{quote ? formatTimestamp(quote.observedAt) : 'Loading'}</span>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState(props: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{props.title}</strong>
      <span>{props.detail}</span>
    </div>
  )
}

function SkeletonRows(props: { count: number }) {
  return (
    <div className="skeleton-stack" aria-label="Loading">
      {Array.from({ length: props.count }).map((_, index) => (
        <span
          key={index}
          style={{ '--skeleton-index': index } as CSSProperties}
        />
      ))}
    </div>
  )
}

function cloneSeedWatchlist(
  cards: readonly SeedWatchlistItem[],
): SeedWatchlistItem[] {
  return cards.map((card) => ({
    ...card,
    research: { ...card.research },
    tradeSetup: { ...card.tradeSetup },
  }))
}

function buildResearchRunRecord(
  bundle: ResearchContextBundle,
  draft: ResearchDraft | null,
): ResearchRunRecord {
  if (!draft || bundle.status === 'empty_source') {
    return {
      status: 'empty_source',
      updatedAt: bundle.generatedAt,
      message:
        bundle.warning ?? 'No sources were returned for this symbol.',
      sources: bundle.sources,
      draft: null,
    }
  }

  if (bundle.status === 'stale_source') {
    return {
      status: 'stale_source',
      updatedAt: bundle.generatedAt,
      message:
        'Draft notes were added, but the sources look old. Check the links before using them.',
      sources: bundle.sources,
      draft,
    }
  }

  return {
    status: 'needs_review',
    updatedAt: bundle.generatedAt,
    message:
      'Draft notes were added. Check the sources before using the card.',
    sources: bundle.sources,
    draft,
  }
}

function getResearchRunStatusLabel(status: ResearchRunStatus): string {
  switch (status) {
    case 'idle':
      return 'Needs research'
    case 'loading':
      return 'Loading sources'
    case 'needs_review':
      return 'Draft notes · Review'
    case 'reviewed':
      return 'Reviewed'
    case 'empty_source':
      return 'No sources'
    case 'stale_source':
      return 'Old sources · Review'
    case 'error':
      return 'Research error'
  }
}

function getCodexQueueStatusLabel(status: CodexQueueStatus): string {
  switch (status) {
    case 'idle':
      return 'Research file ready'
    case 'pending':
      return 'Pending result'
    case 'missing_result':
      return 'Missing result'
    case 'invalid_result':
      return 'Invalid result'
    case 'imported':
      return 'Imported · Review'
    case 'error':
      return 'Queue error'
  }
}

function downloadJsonFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function useMarketDataSnapshot(symbols: readonly string[]): {
  snapshot: MarketDataSnapshot | null
  errorMessage: string | null
  baselinePrices: Record<string, number>
} {
  const [snapshot, setSnapshot] = useState<MarketDataSnapshot | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [baselinePrices, setBaselinePrices] = useState<Record<string, number>>(
    {},
  )
  const provider = useMemo(
    () =>
      createMarketDataProviderFromEnv({
        VITE_ALPACA_MARKET_DATA_FEED:
          import.meta.env.VITE_ALPACA_MARKET_DATA_FEED,
        VITE_ALPACA_MARKET_DATA_PROXY_READY:
          import.meta.env.VITE_ALPACA_MARKET_DATA_PROXY_READY,
        VITE_ALPACA_MARKET_DATA_PROXY_URL:
          import.meta.env.VITE_ALPACA_MARKET_DATA_PROXY_URL,
        VITE_MARKET_DATA_MODE: import.meta.env.VITE_MARKET_DATA_MODE,
      }),
    [],
  )
  const symbolKey = symbols.join(',')

  useEffect(() => {
    let cancelled = false

    async function refreshQuotes() {
      try {
        const nextSnapshot = await provider.loadLatestQuotes(symbols)

        if (!cancelled) {
          setSnapshot(nextSnapshot)
          setBaselinePrices((current) =>
            addMissingBaselinePrices(current, nextSnapshot),
          )
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

  return { snapshot, errorMessage, baselinePrices }
}

function buildPriceMovementRows(
  snapshot: MarketDataSnapshot | null,
  symbols: readonly string[],
  baselineBySymbol: Record<string, number>,
  labels: ReadonlyMap<string, SymbolLabel>,
): PriceMovementRow[] {
  return symbols.map((symbol) => {
    const quote = snapshot?.quotes.find((item) => item.symbol === symbol)
    const baselinePrice = baselineBySymbol[symbol] ?? null
    const change =
      quote?.price !== null &&
      quote?.price !== undefined &&
      baselinePrice !== null
        ? quote.price - baselinePrice
        : null
    const changePercent =
      change !== null && baselinePrice > 0
        ? (change / baselinePrice) * 100
        : null
    const label = getSymbolLabel(symbol, labels)

    return {
      symbol,
      name: label.name,
      layer: label.layer,
      price: quote?.price ?? null,
      baselinePrice,
      change,
      changePercent,
      freshness: quote ? describeQuoteFreshness(quote.freshness) : 'Loading',
      color: getSymbolColor(symbol),
    }
  })
}

function addMissingBaselinePrices(
  current: Record<string, number>,
  snapshot: MarketDataSnapshot,
): Record<string, number> {
  let next = current

  for (const quote of snapshot.quotes) {
    if (quote.price === null || current[quote.symbol] !== undefined) {
      continue
    }

    if (next === current) {
      next = { ...current }
    }

    next[quote.symbol] = quote.price
  }

  return next
}

function buildSymbolLabels(
  holdings: readonly SeedHolding[],
  cards: readonly SeedWatchlistItem[],
): Map<string, SymbolLabel> {
  const labels = new Map<string, SymbolLabel>()

  for (const card of cards) {
    labels.set(card.symbol, {
      name: card.name,
      layer: getAiStackLayerLabel(card.stackLayer),
    })
  }

  for (const holding of holdings) {
    const card = cards.find((item) => item.symbol === holding.symbol)

    labels.set(holding.symbol, {
      name: holding.name,
      layer: card ? getAiStackLayerLabel(card.stackLayer) : holding.stackLayer,
    })
  }

  return labels
}

function getSymbolLabel(
  symbol: string,
  labels: ReadonlyMap<string, SymbolLabel>,
): SymbolLabel {
  return (
    labels.get(symbol) ?? {
      name: symbol,
      layer: 'Manual symbol',
    }
  )
}

function normalizeSymbolInput(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function buildScenarioPlannerFieldValues(input: {
  card: SeedWatchlistItem | null
  form: Partial<ScenarioPlannerForm>
  position: ReturnType<typeof buildPortfolioModel>['positions'][number] | null
  quote: MarketQuote | undefined
}): ScenarioPlannerForm {
  const maxLossFallback = extractFirstNumberInput(input.card?.tradeSetup.maxLoss)
  const supportFallback =
    extractFirstNumberInput(input.card?.tradeSetup.stopLevel) ||
    extractFirstNumberInput(input.card?.research.stop)
  const timeHorizonFallback =
    input.card?.tradeSetup.timeHorizon ||
    DEFAULT_SCENARIO_PLANNER_FORM.timeHorizon

  return {
    currentPrice: getScenarioFormValue(
      input.form,
      'currentPrice',
      formatEditableNumber(input.quote?.price),
    ),
    averageCost: getScenarioFormValue(
      input.form,
      'averageCost',
      formatEditableNumber(input.position?.averageCost),
    ),
    shares: getScenarioFormValue(
      input.form,
      'shares',
      formatEditableNumber(input.position?.shares),
    ),
    maxLossDollars: getScenarioFormValue(
      input.form,
      'maxLossDollars',
      maxLossFallback || DEFAULT_SCENARIO_PLANNER_FORM.maxLossDollars,
    ),
    desiredRiskReward: getScenarioFormValue(
      input.form,
      'desiredRiskReward',
      DEFAULT_SCENARIO_PLANNER_FORM.desiredRiskReward,
    ),
    targetGainPercent: getScenarioFormValue(
      input.form,
      'targetGainPercent',
      DEFAULT_SCENARIO_PLANNER_FORM.targetGainPercent,
    ),
    trimPercent: getScenarioFormValue(
      input.form,
      'trimPercent',
      DEFAULT_SCENARIO_PLANNER_FORM.trimPercent,
    ),
    supportPrice: getScenarioFormValue(
      input.form,
      'supportPrice',
      supportFallback,
    ),
    stopLimitBufferPercent: getScenarioFormValue(
      input.form,
      'stopLimitBufferPercent',
      DEFAULT_SCENARIO_PLANNER_FORM.stopLimitBufferPercent,
    ),
    timeHorizon: getScenarioFormValue(
      input.form,
      'timeHorizon',
      timeHorizonFallback,
    ),
  }
}

function buildScenarioPlannerInput(input: {
  card: SeedWatchlistItem | null
  fields: ScenarioPlannerForm
  hasManualCurrentPrice: boolean
  labels: ReadonlyMap<string, SymbolLabel>
  quote: MarketQuote | undefined
  symbol: string
}): ScenarioPlannerInput {
  const label = getSymbolLabel(input.symbol, input.labels)

  return {
    symbol: input.symbol,
    name: input.card?.name ?? label.name,
    sourceLabel: input.card
      ? `${getAiStackLayerLabel(input.card.stackLayer)} · ${
          input.card.seedType === 'current_holding'
            ? 'Current holding'
            : 'Research card'
        }`
      : label.layer,
    currentPrice: parseNumericInput(input.fields.currentPrice),
    averageCost: parseNumericInput(input.fields.averageCost),
    shares: parseNumericInput(input.fields.shares),
    maxLossDollars: parseNumericInput(input.fields.maxLossDollars),
    desiredRiskReward: parseNumericInput(input.fields.desiredRiskReward),
    targetGainPercent: parseNumericInput(input.fields.targetGainPercent),
    trimPercent: parseNumericInput(input.fields.trimPercent),
    supportPrice: parseNumericInput(input.fields.supportPrice),
    stopLimitBufferPercent: parseNumericInput(
      input.fields.stopLimitBufferPercent,
    ),
    timeHorizon: input.fields.timeHorizon,
    quoteState: getScenarioPlannerQuoteState(
      input.quote,
      input.hasManualCurrentPrice,
    ),
  }
}

function getScenarioFormValue(
  form: Partial<ScenarioPlannerForm>,
  field: keyof ScenarioPlannerForm,
  fallback: string,
): string {
  return hasScenarioFormField(form, field) ? form[field] ?? '' : fallback
}

function hasScenarioFormField(
  form: Partial<ScenarioPlannerForm>,
  field: keyof ScenarioPlannerForm,
): boolean {
  return Object.prototype.hasOwnProperty.call(form, field)
}

function getScenarioPlannerQuoteState(
  quote: MarketQuote | undefined,
  hasManualCurrentPrice: boolean,
): ScenarioPlannerQuoteState {
  if (hasManualCurrentPrice) {
    return 'manual'
  }

  if (!quote || quote.price === null) {
    return 'missing'
  }

  switch (quote.freshness) {
    case 'cached':
    case 'delayed':
      return 'stale'
    case 'mock':
      return 'mock'
    case 'live_iex':
    case 'live_sip':
      return 'fresh'
  }
}

function extractFirstNumberInput(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const match = value.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/)

  return match ? match[0] : ''
}

function formatEditableNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }

  return String(Number(value.toFixed(4)))
}

function getScenarioPlannerStatusLabel(
  status: TargetStopScenario['status'],
): string {
  switch (status) {
    case 'ready':
      return 'Ready to check'
    case 'missing_input':
      return 'Needs details'
    case 'invalid':
      return 'Fix levels'
  }
}

function getJournalStatusLabel(status: TradeJournalEntryStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned'
    case 'executed':
      return 'Executed'
    case 'mistake':
      return 'Mistake'
    case 'result':
      return 'Result'
  }
}

function parseSettingsForm(form: SettingsForm): Partial<PortfolioSettings> {
  return {
    maxPositionWeightPercent:
      parseNumericInput(form.maxPositionWeightPercent) ??
      DEFAULT_PORTFOLIO_SETTINGS.maxPositionWeightPercent,
    alertPositionWeightPercent:
      parseNumericInput(form.alertPositionWeightPercent) ??
      DEFAULT_PORTFOLIO_SETTINGS.alertPositionWeightPercent,
    taxReserveRatePercent:
      parseNumericInput(form.taxReserveRatePercent) ??
      DEFAULT_PORTFOLIO_SETTINGS.taxReserveRatePercent,
    taxReserveEnabled: form.taxReserveEnabled,
    cashRunwayDollars:
      parseNumericInput(form.cashRunwayDollars) ??
      DEFAULT_PORTFOLIO_SETTINGS.cashRunwayDollars,
    activeTradingSleeveDollars:
      parseNumericInput(form.activeTradingSleeveDollars) ??
      DEFAULT_PORTFOLIO_SETTINGS.activeTradingSleeveDollars,
  }
}

function parsePayYourselfForm(form: PayYourselfForm): PayYourselfRule {
  return normalizePayYourselfRule({
    enabled: form.enabled,
    percentOfNetAfterReserve:
      parseNumericInput(form.percentOfNetAfterReserve) ??
      DEFAULT_PAY_YOURSELF_RULE.percentOfNetAfterReserve,
  })
}

function parseNumericInput(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

function getGainMetricDetail(costBasis: number): string {
  if (costBasis <= 0) {
    return 'Waiting for manual cost basis.'
  }

  return `${formatCurrency(costBasis)} modeled cost basis`
}

function getSignedTone(
  value: number,
): 'neutral' | 'positive' | 'negative' | 'warning' | 'danger' {
  if (value > 0) {
    return 'positive'
  }

  if (value < 0) {
    return 'negative'
  }

  return 'neutral'
}

function getConcentrationTone(
  state: 'needs_input' | 'within_rules' | 'alert' | 'over_cap',
): 'neutral' | 'positive' | 'negative' | 'warning' | 'danger' {
  switch (state) {
    case 'within_rules':
      return 'positive'
    case 'alert':
      return 'warning'
    case 'over_cap':
      return 'danger'
    case 'needs_input':
      return 'neutral'
  }
}

function formatMarketPrice(price: number | null | undefined): string {
  return formatCurrency(price)
}

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatSignedCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: 'percent',
  }).format(value / 100)
}

function formatSignedPercent(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: 'exceptZero',
    style: 'percent',
  }).format(value / 100)
}

function formatShares(value: number | null | undefined): string {
  if (typeof value !== 'number') {
    return 'Unavailable'
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(value)
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

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}
