import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { seedHoldings } from '../data/seedHoldings'
import type { SeedHolding } from '../data/seedHoldings'
import {
  buildManualWatchlistCard,
  getAiStackLayerLabel,
  seedWatchlist,
} from '../data/seedWatchlist'
import type {
  AiStackLayerId,
  ResearchFields,
  SeedWatchlistItem,
  TradeSetupFields,
} from '../data/seedWatchlist'
import {
  buildAllocationRows,
  buildConcentrationRows,
  buildGainRows,
  buildTopProfitLockScenarios,
  getSymbolColor,
  summarizeCashRunway,
  summarizeConcentrationRisk,
} from '../lib/cockpit'
import {
  createMarketDataProviderFromEnv,
  describeQuoteFreshness,
  getMarketDataSymbols,
  MARKET_DATA_POLL_INTERVAL_MS,
} from '../lib/marketData'
import type { MarketDataSnapshot, MarketQuote } from '../lib/marketData'
import {
  clearSwingLocalState,
  loadSwingLocalState,
  saveSwingLocalState,
  type BuyingPowerForm,
  type ManualLotInputs,
  type PayYourselfForm,
  type ResearchFiltersForm,
  type ScenarioPlannerForm,
  type ScenarioPlannerFormMap,
  type SettingsForm,
  type SwingLocalState,
  type SwingLocalStateClearResult,
  type SwingLocalStateLoadResult,
  type SwingLocalStateSaveResult,
} from '../lib/localPersistence'
import {
  buildPortfolioModel,
  buildPortfolioSeedSummary,
  DEFAULT_PORTFOLIO_SETTINGS,
} from '../lib/portfolio'
import type { PortfolioSettings } from '../lib/portfolio'
import { buildProfitCashPlan } from '../lib/profitCashPlan'
import { buildProfitLockTickets } from '../lib/profitLock'
import { buildTargetStopScenario } from '../lib/scenarioPlanner'
import type {
  ScenarioPlannerInput,
  ScenarioPlannerQuoteState,
  TargetStopScenario,
} from '../lib/scenarioPlanner'
import {
  buildBuyingPowerSummary,
  buildSellFillRows,
  parseSellFillImportText,
} from '../lib/sellFills'
import type {
  SellFillRecord,
  SellFillStatus,
} from '../lib/sellFills'
import {
  buildRobinhoodPlanningExport,
  buildRobinhoodTaxPlanningBuckets,
  buildSellFillsFromAcceptedRobinhoodRows,
  parseRobinhoodCsvFile,
  updateRobinhoodRowReviewState,
} from '../lib/robinhoodCsv'
import type {
  RobinhoodCsvReportKind,
  RobinhoodImportBatch,
  RobinhoodNormalizedRow,
  RobinhoodReviewState,
} from '../lib/robinhoodCsv'
import {
  buildJournalEntryFromTicket,
  buildManualJournalEntry,
  buildManualTradeTicketFromProfitLock,
  buildManualTradeTicketFromTradeSetup,
  buildRealizedProfitSummary,
  DEFAULT_PAY_YOURSELF_RULE,
  normalizePayYourselfRule,
} from '../lib/tradeJournal'
import type {
  ManualTradeTicket,
  PayYourselfRule,
  TradeJournalEntry,
  TradeJournalEntryStatus,
} from '../lib/tradeJournal'
import {
  buildResearchCandidateScores,
  filterResearchCandidateScores,
  groupResearchCardsByLayer,
} from '../lib/researchWatchlist'
import {
  buildCodexResearchDownloadName,
  buildCodexResearchRequest,
  buildCodexResearchRequestPath,
  parseCodexResearchResultJson,
  serializeCodexResearchRequest,
  type CodexResearchRequest,
} from '../lib/codexResearchQueue'
import {
  buildResearchDraftFromBundle,
  createCuratedResearchProvider,
} from '../lib/researchProvider'
import type {
  ResearchContextBundle,
  ResearchDraft,
  ResearchSource,
} from '../lib/researchProvider'

type HoldingForm = {
  symbol: string
  name: string
  stackLayer: AiStackLayerId
  shares: string
  averageCost: string
}

type SellFillForm = {
  status: SellFillStatus
  symbol: string
  sharesSold: string
  fillPrice: string
  averageCost: string
  costBasis: string
  filledDate: string
  fees: string
  source: string
  reference: string
  notes: string
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

type SellFillFormField = keyof SellFillForm
type BuyingPowerFormField = keyof BuyingPowerForm

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

type PersistenceMessageTone = 'ok' | 'warning' | 'error'

type PersistenceMessage = {
  tone: PersistenceMessageTone
  title: string
  detail: string
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

const DEFAULT_SELL_FILL_FORM: SellFillForm = {
  status: 'filled',
  symbol: seedWatchlist[0]?.symbol ?? '',
  sharesSold: '',
  fillPrice: '',
  averageCost: '',
  costBasis: '',
  filledDate: new Date().toISOString().slice(0, 10),
  fees: '',
  source: 'manual entry',
  reference: '',
  notes: '',
}

const DEFAULT_BUYING_POWER_FORM: BuyingPowerForm = {
  startingCash: '',
  manuallyReinvestedCash: '',
}

const VISUAL_CONTRACT_DEFAULT_LOTS: ManualLotInputs = {
  AAPL: {
    shares: '10',
    averageCost: '150',
  },
  NVDA: {
    shares: '6',
    averageCost: '120',
  },
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

export function useCommandCenterState() {
  const defaultLocalState = useMemo(() => buildDefaultSwingLocalState(), [])
  const initialPersistence = useMemo(
    () => loadSwingLocalState(getBrowserLocalStorage(), defaultLocalState),
    [defaultLocalState],
  )
  const initialLocalState = initialPersistence.ok
    ? initialPersistence.snapshot.state
    : defaultLocalState
  const [isPersistenceWriteEnabled, setIsPersistenceWriteEnabled] = useState(
    () =>
      initialPersistence.ok ||
      initialPersistence.status === 'empty' ||
      initialPersistence.status === 'unavailable',
  )
  const [persistenceMessage, setPersistenceMessage] =
    useState<PersistenceMessage>(() =>
      formatPersistenceLoadMessage(initialPersistence),
    )
  const [holdings, setHoldings] = useState<SeedHolding[]>(() =>
    cloneHoldings(initialLocalState.holdings),
  )
  const [manualLots, setManualLots] = useState<ManualLotInputs>(() =>
    cloneManualLots(initialLocalState.manualLots),
  )
  const [holdingForm, setHoldingForm] =
    useState<HoldingForm>(DEFAULT_HOLDING_FORM)
  const [settingsForm, setSettingsForm] =
    useState<SettingsForm>(() => ({ ...initialLocalState.settingsForm }))
  const [selectedPlannerSymbol, setSelectedPlannerSymbol] = useState<string>(
    initialLocalState.selectedPlannerSymbol,
  )
  const [cashTargetInput, setCashTargetInput] = useState(
    initialLocalState.cashTargetInput,
  )
  const [researchCards, setResearchCards] = useState<
    SeedWatchlistItem[]
  >(() => cloneSeedWatchlist(initialLocalState.researchCards))
  const [selectedResearchSymbol, setSelectedResearchSymbol] = useState(
    initialLocalState.selectedResearchSymbol,
  )
  const [researchFilters, setResearchFilters] = useState<ResearchFiltersForm>(
    () => ({ ...initialLocalState.researchFilters }),
  )
  const [scenarioPlannerForms, setScenarioPlannerForms] =
    useState<ScenarioPlannerFormMap>(() =>
      cloneScenarioPlannerForms(initialLocalState.scenarioPlannerForms),
    )
  const [researchRuns, setResearchRuns] = useState<ResearchRunMap>({})
  const [codexQueue, setCodexQueue] = useState<CodexQueueMap>({})
  const [payYourselfForm, setPayYourselfForm] =
    useState<PayYourselfForm>(() => ({ ...initialLocalState.payYourselfForm }))
  const [journalEntries, setJournalEntries] = useState<TradeJournalEntry[]>(
    () => clonePlain(initialLocalState.journalEntries),
  )
  const [sellFills, setSellFills] = useState<SellFillRecord[]>(() =>
    clonePlain(initialLocalState.sellFills),
  )
  const [sellFillForm, setSellFillForm] = useState<SellFillForm>(
    DEFAULT_SELL_FILL_FORM,
  )
  const [sellFillImportText, setSellFillImportText] = useState('')
  const [sellFillImportMessage, setSellFillImportMessage] = useState('')
  const [robinhoodImports, setRobinhoodImports] = useState<
    RobinhoodImportBatch[]
  >(() => clonePlain(initialLocalState.robinhoodImports))
  const [robinhoodRows, setRobinhoodRows] = useState<RobinhoodNormalizedRow[]>(
    () => clonePlain(initialLocalState.robinhoodRows),
  )
  const [robinhoodImportMessage, setRobinhoodImportMessage] = useState('')
  const [buyingPowerForm, setBuyingPowerForm] =
    useState<BuyingPowerForm>(() => ({ ...initialLocalState.buyingPowerForm }))
  const currentLocalState = useMemo<SwingLocalState>(
    () => ({
      holdings,
      manualLots,
      settingsForm,
      cashTargetInput,
      researchCards,
      selectedResearchSymbol,
      researchFilters,
      selectedPlannerSymbol,
      scenarioPlannerForms,
      payYourselfForm,
      journalEntries,
      sellFills,
      robinhoodImports,
      robinhoodRows,
      buyingPowerForm,
    }),
    [
      buyingPowerForm,
      cashTargetInput,
      holdings,
      journalEntries,
      manualLots,
      payYourselfForm,
      researchCards,
      researchFilters,
      robinhoodImports,
      robinhoodRows,
      scenarioPlannerForms,
      selectedPlannerSymbol,
      selectedResearchSymbol,
      sellFills,
      settingsForm,
    ],
  )

  useEffect(() => {
    if (!isPersistenceWriteEnabled) {
      return
    }

    const result = saveSwingLocalState(
      getBrowserLocalStorage(),
      currentLocalState,
    )
    setPersistenceMessage(formatPersistenceSaveMessage(result))
  }, [currentLocalState, isPersistenceWriteEnabled])

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
  const acceptedRobinhoodSellFills = useMemo(
    () => buildSellFillsFromAcceptedRobinhoodRows(robinhoodRows),
    [robinhoodRows],
  )
  const buyingPowerRecords = useMemo(
    () => [...acceptedRobinhoodSellFills, ...sellFills],
    [acceptedRobinhoodSellFills, sellFills],
  )
  const sellFillRows = useMemo(
    () =>
      buildSellFillRows(buyingPowerRecords, {
        settings: portfolioModel.settings,
        payYourselfRule,
      }),
    [buyingPowerRecords, portfolioModel.settings, payYourselfRule],
  )
  const buyingPowerSummary = useMemo(
    () =>
      buildBuyingPowerSummary({
        records: buyingPowerRecords,
        startingCash: parseNumericInput(buyingPowerForm.startingCash) ?? 0,
        manuallyReinvestedCash:
          parseNumericInput(buyingPowerForm.manuallyReinvestedCash) ?? 0,
        settings: portfolioModel.settings,
        payYourselfRule,
      }),
    [
      buyingPowerForm,
      buyingPowerRecords,
      portfolioModel.settings,
      payYourselfRule,
    ],
  )
  const robinhoodTaxPlanning = useMemo(
    () =>
      buildRobinhoodTaxPlanningBuckets({
        rows: robinhoodRows,
        buyingPower: buyingPowerSummary,
        settings: portfolioModel.settings,
        payYourselfRule,
      }),
    [buyingPowerSummary, payYourselfRule, portfolioModel.settings, robinhoodRows],
  )
  const profitCashPlan = useMemo(
    () =>
      buildProfitCashPlan({
        summary: realizedProfitSummary,
        buyingPower: buyingPowerSummary,
        positions: portfolioModel.positions,
        researchScores,
        quotesBySymbol,
      }),
    [
      portfolioModel.positions,
      quotesBySymbol,
      buyingPowerSummary,
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

  function updateSellFillForm(field: SellFillFormField, value: string) {
    setSellFillForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateBuyingPowerForm(
    field: BuyingPowerFormField,
    value: string,
  ) {
    setBuyingPowerForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function resetLocalCockpitState() {
    const nextState = buildDefaultSwingLocalState()
    const result = clearSwingLocalState(getBrowserLocalStorage())

    setHoldings(cloneHoldings(nextState.holdings))
    setManualLots(cloneManualLots(nextState.manualLots))
    setSettingsForm({ ...nextState.settingsForm })
    setSelectedPlannerSymbol(nextState.selectedPlannerSymbol)
    setCashTargetInput(nextState.cashTargetInput)
    setResearchCards(cloneSeedWatchlist(nextState.researchCards))
    setSelectedResearchSymbol(nextState.selectedResearchSymbol)
    setResearchFilters({ ...nextState.researchFilters })
    setScenarioPlannerForms(
      cloneScenarioPlannerForms(nextState.scenarioPlannerForms),
    )
    setResearchRuns({})
    setCodexQueue({})
    setPayYourselfForm({ ...nextState.payYourselfForm })
    setJournalEntries(clonePlain(nextState.journalEntries))
    setSellFills(clonePlain(nextState.sellFills))
    setSellFillForm(DEFAULT_SELL_FILL_FORM)
    setSellFillImportText('')
    setSellFillImportMessage('')
    setRobinhoodImports(clonePlain(nextState.robinhoodImports))
    setRobinhoodRows(clonePlain(nextState.robinhoodRows))
    setRobinhoodImportMessage('')
    setBuyingPowerForm({ ...nextState.buyingPowerForm })
    setHoldingForm(DEFAULT_HOLDING_FORM)
    setIsPersistenceWriteEnabled(result.ok || result.status === 'unavailable')
    setPersistenceMessage(formatPersistenceClearMessage(result))
  }

  function addSellFill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const symbol = normalizeSymbolInput(sellFillForm.symbol)

    if (!symbol) {
      setSellFillImportMessage('Enter a symbol before adding a sell fill.')
      return
    }

    const createdAt = new Date().toISOString()
    const nextRecord: SellFillRecord = {
      id: `${symbol.toLowerCase()}-sell-fill-${createdAt.replace(/\D/g, '')}`,
      status: sellFillForm.status,
      symbol,
      sharesSold: parseNumericInput(sellFillForm.sharesSold),
      fillPrice: parseNumericInput(sellFillForm.fillPrice),
      averageCost: parseNumericInput(sellFillForm.averageCost),
      costBasis: parseNumericInput(sellFillForm.costBasis),
      filledDate: sellFillForm.filledDate,
      fees: parseNumericInput(sellFillForm.fees) ?? 0,
      source: sellFillForm.source.trim() || 'manual entry',
      reference: sellFillForm.reference.trim(),
      notes: sellFillForm.notes.trim(),
    }

    setSellFills((current) => [nextRecord, ...current])
    setSelectedPlannerSymbol(symbol)
    setSellFillImportMessage(`${symbol} sell fill added locally.`)
    setSellFillForm({
      ...DEFAULT_SELL_FILL_FORM,
      status: sellFillForm.status,
      symbol,
      filledDate: sellFillForm.filledDate || DEFAULT_SELL_FILL_FORM.filledDate,
    })
  }

  function updateSellFillStatus(id: string, status: SellFillStatus) {
    setSellFills((current) =>
      current.map((record) =>
        record.id === id ? { ...record, status } : record,
      ),
    )
  }

  function removeSellFill(id: string) {
    setSellFills((current) => current.filter((record) => record.id !== id))
  }

  function importSellFillsFromText() {
    const importedAt = new Date().toISOString()
    const result = parseSellFillImportText(sellFillImportText, importedAt)

    if (result.records.length > 0) {
      setSellFills((current) => [...result.records, ...current])
    }

    setSellFillImportMessage(formatSellFillImportMessage(result))
  }

  async function importSellFillsFromFile(file: File) {
    try {
      const text = await file.text()
      const importedAt = new Date().toISOString()
      const result = parseSellFillImportText(text, importedAt)

      setSellFillImportText(text)

      if (result.records.length > 0) {
        setSellFills((current) => [...result.records, ...current])
      }

      setSellFillImportMessage(formatSellFillImportMessage(result))
    } catch (error) {
      setSellFillImportMessage(
        getErrorMessage(error, 'Local sell-fill file could not be read.'),
      )
    }
  }

  async function importRobinhoodCsvFile(
    file: File,
    reportKind: RobinhoodCsvReportKind,
  ) {
    try {
      const text = await file.text()
      const result = parseRobinhoodCsvFile({
        text,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        reportKind,
      })
      const batch = result.batch

      if (batch) {
        setRobinhoodImports((current) => [batch, ...current])
      }

      if (result.rows.length > 0) {
        setRobinhoodRows((current) => [...result.rows, ...current])
      }

      setRobinhoodImportMessage(formatRobinhoodImportMessage(result))
    } catch (error) {
      setRobinhoodImportMessage(
        getErrorMessage(error, 'Robinhood CSV file could not be read.'),
      )
    }
  }

  function updateRobinhoodReviewState(
    rowId: string,
    reviewState: RobinhoodReviewState,
  ) {
    setRobinhoodRows((current) =>
      updateRobinhoodRowReviewState(current, rowId, reviewState),
    )
  }

  function clearRobinhoodImportRows() {
    setRobinhoodImports([])
    setRobinhoodRows([])
    setRobinhoodImportMessage(
      'Cleared Robinhood CSV rows. Upload a fresh Robinhood export to rebuild the preview.',
    )
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
    const payload = buildRobinhoodPlanningExport({
      imports: robinhoodImports,
      rows: robinhoodRows,
      buyingPower: buyingPowerSummary,
      taxPlanning: robinhoodTaxPlanning,
      generatedAt,
    })

    downloadJsonFile(
      `swing-command-center-robinhood-plan-${generatedAt.slice(0, 10)}.json`,
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

  function applyAcceptedRobinhoodRows() {
    const acceptedSellRows = buildSellFillsFromAcceptedRobinhoodRows(robinhoodRows)
    setRobinhoodImportMessage(
      acceptedSellRows.length === 1
        ? 'Applied 1 accepted Robinhood sell row to buying-power planning.'
        : `Applied ${acceptedSellRows.length} accepted Robinhood sell rows to buying-power planning.`,
    )
  }

  return {
    acceptedRobinhoodSellFills,
    allocationRows,
    buyingPowerForm,
    buyingPowerRecords,
    buyingPowerSummary,
    cashRunwaySummary,
    cashTargetAmount,
    cashTargetInput,
    codexQueue,
    concentrationRows,
    concentrationSummary,
    currentLocalState,
    errorMessage,
    filteredResearchScores,
    gainRows,
    hasStaleQuotes,
    holdingForm,
    holdings,
    isMarketLoading,
    isPersistenceWriteEnabled,
    journalEntries,
    manualLots,
    manualTradeTickets,
    marketStatus,
    marketSymbols,
    marketTimestamp,
    movementRows,
    payYourselfForm,
    payYourselfRule,
    persistenceMessage,
    portfolioModel,
    portfolioSettings,
    profitCashPlan,
    profitLockTickets,
    quotesBySymbol,
    realizedProfitSummary,
    researchCards,
    researchFilters,
    researchLayerGroups,
    researchRuns,
    researchScoreBySymbol,
    researchScores,
    robinhoodImportMessage,
    robinhoodImports,
    robinhoodRows,
    robinhoodTaxPlanning,
    scenarioPlannerFields,
    scenarioPlannerForms,
    selectedCodexQueueRecord,
    selectedPlannerCard,
    selectedPlannerForm,
    selectedPlannerPosition,
    selectedPlannerQuote,
    selectedPlannerSymbol,
    selectedResearchCard,
    selectedResearchRun,
    selectedResearchScore,
    selectedResearchSymbol,
    sellFillForm,
    sellFillImportMessage,
    sellFillImportText,
    sellFillRows,
    sellFills,
    settingsForm,
    snapshot,
    summary,
    symbolLabels,
    targetStopScenario,
    topProfitLockScenarios,
    actions: {
      addHolding,
      addJournalEntryFromTicket,
      addManualMistakeEntry,
      addSellFill,
      applyAcceptedRobinhoodRows,
      clearRobinhoodImportRows,
      exportTradeJournal,
      importCodexResearchResult,
      importRobinhoodCsvFile,
      importSellFillsFromFile,
      importSellFillsFromText,
      markCodexResultMissing,
      markResearchReviewed,
      queueCodexResearchRequest,
      removeHolding,
      removeSellFill,
      resetLocalCockpitState,
      runResearchForLayer,
      runResearchForSymbols,
      selectPlannerSymbol,
      setCashTargetInput,
      setSelectedResearchSymbol,
      setSellFillImportText,
      updateBuyingPowerForm,
      updateHoldingForm,
      updateJournalEntry,
      updateManualLot,
      updatePayYourselfRule,
      updateResearchField,
      updateResearchFilter,
      updateRobinhoodReviewState,
      updateScenarioPlannerField,
      updateSellFillForm,
      updateSellFillStatus,
      updateSetting,
      updateTradeSetupField,
    },
  }
}

export type CommandCenterState = ReturnType<typeof useCommandCenterState>
export type {
  BuyingPowerForm,
  CodexQueueRecord,
  HoldingForm,
  JournalEntryEditableField,
  PersistenceMessage,
  PriceMovementRow,
  ResearchRunRecord,
  SellFillForm,
  SymbolLabel,
}

function buildDefaultSwingLocalState(): SwingLocalState {
  return {
    holdings: cloneHoldings(seedHoldings),
    manualLots: Object.fromEntries(
      seedHoldings.map((holding) => [
        holding.symbol,
        VISUAL_CONTRACT_DEFAULT_LOTS[holding.symbol] ?? {
          shares: '',
          averageCost: '',
        },
      ]),
    ),
    settingsForm: { ...DEFAULT_SETTINGS_FORM },
    cashTargetInput: String(DEFAULT_CASH_TARGET_AMOUNT),
    researchCards: cloneSeedWatchlist(seedWatchlist),
    selectedResearchSymbol: seedWatchlist[0].symbol,
    researchFilters: { ...DEFAULT_RESEARCH_FILTERS },
    selectedPlannerSymbol: seedWatchlist[0].symbol,
    scenarioPlannerForms: {},
    payYourselfForm: { ...DEFAULT_PAY_YOURSELF_FORM },
    journalEntries: [],
    sellFills: [],
    robinhoodImports: [],
    robinhoodRows: [],
    buyingPowerForm: { ...DEFAULT_BUYING_POWER_FORM },
  }
}

function cloneHoldings(holdings: readonly SeedHolding[]): SeedHolding[] {
  return holdings.map((holding) => ({ ...holding }))
}

function cloneManualLots(manualLots: ManualLotInputs): ManualLotInputs {
  return Object.fromEntries(
    Object.entries(manualLots).map(([symbol, lot]) => [
      symbol,
      { ...lot },
    ]),
  )
}

function cloneScenarioPlannerForms(
  forms: ScenarioPlannerFormMap,
): ScenarioPlannerFormMap {
  return Object.fromEntries(
    Object.entries(forms).map(([symbol, form]) => [symbol, { ...form }]),
  )
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getBrowserLocalStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function formatPersistenceLoadMessage(
  result: SwingLocalStateLoadResult,
): PersistenceMessage {
  if (result.ok) {
    return {
      tone: result.warnings.length > 0 ? 'warning' : 'ok',
      title: result.warnings.length > 0 ? 'Local state repaired' : 'Local state loaded',
      detail:
        result.warnings.length > 0
          ? `${result.warnings.length} missing field fallback was applied.`
          : `Restored saved browser state from ${formatDateTime(
              result.snapshot.savedAt,
            )}.`,
    }
  }

  if (result.status === 'empty') {
    return {
      tone: 'ok',
      title: 'Local state ready',
      detail: 'Changes in this browser will save locally.',
    }
  }

  if (result.status === 'invalid' || result.status === 'unsupported') {
    return {
      tone: 'error',
      title: 'Saved state blocked',
      detail: `${result.message} Current seed data is shown until reset.`,
    }
  }

  return {
    tone: 'warning',
    title: 'Local state unavailable',
    detail: result.message,
  }
}

function formatPersistenceSaveMessage(
  result: SwingLocalStateSaveResult,
): PersistenceMessage {
  if (result.ok) {
    return {
      tone: 'ok',
      title: 'Local state saved',
      detail: `Last save ${formatDateTime(result.snapshot.savedAt)}.`,
    }
  }

  return {
    tone: 'warning',
    title: 'Local state not saved',
    detail: result.message,
  }
}

function formatPersistenceClearMessage(
  result: SwingLocalStateClearResult,
): PersistenceMessage {
  if (result.ok) {
    return {
      tone: 'warning',
      title: 'Local state reset',
      detail: 'Saved browser data was cleared and the seed cockpit reloaded.',
    }
  }

  return {
    tone: 'error',
    title: 'Local state not cleared',
    detail: result.message,
  }
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

function getSellFillStatusLabel(status: SellFillStatus): string {
  switch (status) {
    case 'planned':
      return 'Planned'
    case 'ordered':
      return 'Ordered'
    case 'filled':
      return 'Filled'
    case 'canceled':
      return 'Canceled'
    case 'reviewed':
      return 'Reviewed'
  }
}

function getRobinhoodReportKindLabel(kind: RobinhoodCsvReportKind): string {
  switch (kind) {
    case 'account_activity':
      return 'Account activity CSV'
    case 'realized_gain_loss':
      return 'Realized gain/loss CSV'
  }
}

function getRobinhoodKindLabel(kind: RobinhoodNormalizedRow['kind']): string {
  switch (kind) {
    case 'buy':
      return 'Buy'
    case 'sell':
      return 'Sell'
    case 'dividend':
      return 'Dividend'
    case 'interest':
      return 'Interest'
    case 'transfer':
      return 'Transfer'
    case 'fee':
      return 'Fee'
    case 'unknown':
      return 'Unknown'
  }
}

function getRobinhoodReviewStateLabel(
  reviewState: RobinhoodReviewState,
): string {
  switch (reviewState) {
    case 'needs_review':
      return 'Needs review'
    case 'accepted':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
  }
}

function getRobinhoodReconciliationLabel(
  status: RobinhoodNormalizedRow['reconciliationStatus'],
): string {
  switch (status) {
    case 'matched':
      return 'Matched'
    case 'needs_review':
      return 'Needs review'
    case 'missing_basis':
      return 'Missing basis'
    case 'missing_proceeds':
      return 'Missing proceeds'
    case 'possible_wash_sale':
      return 'Possible wash sale'
    case 'unsupported_row':
      return 'Unsupported row'
  }
}

function getRobinhoodHoldingPeriodLabel(
  holdingPeriod: RobinhoodNormalizedRow['holdingPeriod'],
): string {
  switch (holdingPeriod) {
    case 'short_term':
      return 'Short-term holding period'
    case 'long_term':
      return 'Long-term holding period'
    case 'unknown':
      return 'Holding period not imported'
  }
}

function importRobinhoodSelectedFile(
  event: ChangeEvent<HTMLInputElement>,
  reportKind: RobinhoodCsvReportKind,
  onImportFile: (file: File, reportKind: RobinhoodCsvReportKind) => void,
) {
  const file = event.target.files?.[0]

  if (file) {
    onImportFile(file, reportKind)
  }

  event.target.value = ''
}

function formatSellFillImportMessage(result: {
  records: readonly SellFillRecord[]
  errors: readonly string[]
}): string {
  const importedCopy =
    result.records.length === 1
      ? 'Imported 1 sell record.'
      : `Imported ${result.records.length} sell records.`
  const errorCopy =
    result.errors.length > 0 ? ` ${result.errors.join(' ')}` : ''

  return `${importedCopy}${errorCopy}`
}

function formatRobinhoodImportMessage(result: {
  batch: RobinhoodImportBatch | null
  rows: readonly RobinhoodNormalizedRow[]
  errors: readonly string[]
}): string {
  const importedCopy =
    result.batch && result.rows.length > 0
      ? `Imported ${result.rows.length} ${getRobinhoodReportKindLabel(
          result.batch.reportKind,
        ).toLowerCase()} rows from ${result.batch.fileName}. Review rows before accepting.`
      : 'No Robinhood rows imported.'
  const errorCopy =
    result.errors.length > 0 ? ` ${result.errors.join(' ')}` : ''

  return `${importedCopy}${errorCopy}`
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

export {
  buildDefaultSwingLocalState,
  buildPriceMovementRows,
  formatBidAsk,
  formatCurrency,
  formatDateTime,
  formatEditableNumber,
  formatMarketPrice,
  formatPercent,
  formatQuoteSource,
  formatRobinhoodImportMessage,
  formatShares,
  formatSignedCurrency,
  formatSignedPercent,
  formatTimestamp,
  getCodexQueueStatusLabel,
  getConcentrationTone,
  getErrorMessage,
  getGainMetricDetail,
  getJournalStatusLabel,
  getResearchRunStatusLabel,
  getRobinhoodHoldingPeriodLabel,
  getRobinhoodKindLabel,
  getRobinhoodReconciliationLabel,
  getRobinhoodReportKindLabel,
  getRobinhoodReviewStateLabel,
  getScenarioPlannerStatusLabel,
  getSellFillStatusLabel,
  getSignedTone,
  getSymbolLabel,
  importRobinhoodSelectedFile,
  parseNumericInput,
}
