import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import { seedHoldings } from './data/seedHoldings'
import {
  AI_STACK_LAYERS,
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
import { buildProfitLockTickets } from './lib/profitLock'
import type { ProfitLockTicket } from './lib/profitLock'
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

const IDLE_RESEARCH_RUN: ResearchRunRecord = {
  status: 'idle',
  updatedAt: null,
  message: 'Run source research to draft editable thesis fields.',
  sources: [],
  draft: null,
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
  const summary = buildPortfolioSeedSummary(seedHoldings)
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
  const [settingsForm, setSettingsForm] =
    useState<SettingsForm>(DEFAULT_SETTINGS_FORM)
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    seedHoldings[0].symbol,
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
  const [researchRuns, setResearchRuns] = useState<ResearchRunMap>({})
  const researchProvider = useMemo(
    () => createCuratedResearchProvider({ cards: seedWatchlist }),
    [],
  )
  const marketSymbols = useMemo(
    () =>
      getMarketDataSymbols(
        seedHoldings,
        seedWatchlist.map((item) => item.symbol),
      ),
    [],
  )
  const { baselinePrices, snapshot, errorMessage } =
    useMarketDataSnapshot(marketSymbols)
  const quotesBySymbol = useMemo(() => {
    return new Map(snapshot?.quotes.map((quote) => [quote.symbol, quote]))
  }, [snapshot])
  const movementRows = useMemo(
    () => buildPriceMovementRows(snapshot, marketSymbols, baselinePrices),
    [baselinePrices, marketSymbols, snapshot],
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
  const portfolioSettings = useMemo(
    () => parseSettingsForm(settingsForm),
    [settingsForm],
  )
  const portfolioInputs = useMemo(() => {
    return seedHoldings.map((holding) => {
      const manualLot = manualLots[holding.symbol]
      const quote = quotesBySymbol.get(holding.symbol)

      return {
        ...holding,
        shares: parseNumericInput(manualLot?.shares),
        averageCost: parseNumericInput(manualLot?.averageCost),
        currentPrice: quote?.price ?? null,
      }
    })
  }, [manualLots, quotesBySymbol])
  const portfolioModel = useMemo(
    () => buildPortfolioModel(portfolioInputs, portfolioSettings),
    [portfolioInputs, portfolioSettings],
  )
  const selectedPosition =
    portfolioModel.positions.find(
      (position) => position.symbol === selectedSymbol,
    ) ?? null
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
        position: selectedPosition,
        portfolioMarketValue: portfolioModel.totalMarketValue,
        settings: portfolioModel.settings,
        targetWeightPercent: portfolioModel.settings.maxPositionWeightPercent,
        cashTargetAmount,
      }),
    [
      selectedPosition,
      portfolioModel.totalMarketValue,
      portfolioModel.settings,
      cashTargetAmount,
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
          message: 'Draft marked reviewed. Fields remain manually editable.',
        },
      }
    })
  }

  return (
    <main className="cockpit-shell">
      <section className="command-surface" aria-labelledby="page-title">
        <header className="command-header">
          <div className="identity-block">
            <p className="eyebrow">Manual swing cockpit</p>
            <h1 id="page-title">Swing Command Center</h1>
            <div className="scope-line">
              <span>{summary.symbols.join(' / ')}</span>
              <span>{portfolioModel.completePositionCount} modeled</span>
              <span>{portfolioModel.manualLotsNeeded} need lots</span>
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
            detail={`${portfolioModel.completePositionCount}/${summary.totalSymbols} holdings modeled`}
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
            label="Cash / runway"
            tone={cashRunwaySummary.label === 'Short' ? 'warning' : 'neutral'}
            value={formatCurrency(cashRunwaySummary.targetAmount)}
          />
          <MetricCell
            detail={concentrationSummary.detail}
            label="Concentration risk"
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
              eyebrow="Profit-lock"
              title="Top manual scenarios"
              value={
                topProfitLockScenarios.length > 0
                  ? `${topProfitLockScenarios.length} ready`
                  : 'No tickets'
              }
            />
            <TopScenarioList
              manualLotsNeeded={portfolioModel.manualLotsNeeded}
              scenarios={topProfitLockScenarios}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
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
        aria-label="AI stack research tracker"
      >
        <section className="cockpit-panel stack-map-panel">
          <PanelHeading
            eyebrow="AI stack"
            title="Layer watchlist"
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
            runState={selectedResearchRun}
            score={selectedResearchScore}
            onMarkReviewed={markResearchReviewed}
            onRunLayer={runResearchForLayer}
            onRunSymbol={(symbol) => void runResearchForSymbols([symbol])}
            onUpdateResearch={updateResearchField}
            onUpdateTradeSetup={updateTradeSetupField}
          />
        </section>

        <section className="cockpit-panel candidate-panel">
          <PanelHeading
            eyebrow="Checklist"
            title="Candidate filter"
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
            eyebrow="Open P/L"
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
            title="Concentration map"
            value={formatPercent(concentrationSummary.maxWeightPercent)}
          />
          <ConcentrationChart
            alertPercent={portfolioModel.settings.alertPositionWeightPercent}
            capPercent={portfolioModel.settings.maxPositionWeightPercent}
            rows={concentrationRows}
          />
        </section>
      </section>

      <section className="workbench-grid" aria-label="Inputs and scenario desk">
        <section className="cockpit-panel input-panel">
          <PanelHeading
            eyebrow="Inputs"
            title="Manual lots"
            value={`${portfolioModel.manualLotsNeeded} open`}
          />
          <ManualLotTable
            manualLots={manualLots}
            positions={portfolioModel.positions}
            onUpdate={updateManualLot}
          />
        </section>

        <section className="cockpit-panel settings-panel">
          <PanelHeading
            eyebrow="Rules"
            title="Risk settings"
            value={`${portfolioModel.settings.alertPositionWeightPercent}% / ${portfolioModel.settings.maxPositionWeightPercent}%`}
          />
          <div className="settings-grid">
            <NumberSetting
              label="Alert weight"
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
              label="Runway target"
              min="0"
              prefix="$"
              value={settingsForm.cashRunwayDollars}
              onChange={(value) => updateSetting('cashRunwayDollars', value)}
            />
            <NumberSetting
              label="Trading sleeve"
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
              label="Reserve rate"
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
            Tax reserve is an editable estimate bucket, not tax advice or a
            filing calculation.
          </p>
        </section>

        <section className="cockpit-panel planner-panel">
          <PanelHeading
            eyebrow="Scenario desk"
            title="Selected ticket set"
            value={selectedSymbol}
          />
          <div className="planner-controls">
            <label className="setting-control">
              <span>Position</span>
              <select
                value={selectedSymbol}
                onChange={(event) => setSelectedSymbol(event.target.value)}
              >
                {portfolioModel.positions.map((position) => (
                  <option key={position.symbol} value={position.symbol}>
                    {position.symbol}
                  </option>
                ))}
              </select>
            </label>
            <NumberSetting
              label="Cash target"
              min="0"
              prefix="$"
              value={cashTargetInput}
              onChange={setCashTargetInput}
            />
            <MetricCell
              detail="estimate bucket only"
              label="Tax reserve"
              tone="neutral"
              value={
                portfolioModel.settings.taxReserveEnabled
                  ? `${portfolioModel.settings.taxReserveRatePercent}%`
                  : 'Off'
              }
            />
          </div>

          {profitLockTickets.length === 0 ? (
            <EmptyState
              detail={`Add shares, average cost, and current price for ${selectedSymbol}.`}
              title="No selected tickets"
            />
          ) : (
            <div className="ticket-grid">
              {profitLockTickets.map((ticket) => (
                <ProfitLockTicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="cockpit-panel quote-panel" aria-label="Quote feed">
        <PanelHeading
          eyebrow="Market data"
          title="Holdings and watchlist feed"
          value={`Poll ${MARKET_DATA_POLL_INTERVAL_MS / 1000}s`}
        />
        <QuoteTable
          isLoading={isMarketLoading}
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
        <span>Waiting for the first market-data poll.</span>
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
        <strong>Stale quote in feed</strong>
        <span>One or more symbols are using cached market data.</span>
      </div>
    )
  }

  if (props.snapshot?.warning) {
    return (
      <div className="state-banner warning">
        <strong>Fallback feed</strong>
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
  score: ResearchCandidateScore | null
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
        detail="Add a watchlist symbol before editing research."
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
              ? 'Current holding'
              : 'Placeholder'}
          </span>
        </div>
        <ScoreMeter score={score} />
      </div>

      <p className="state-note">
        Manual checklist only. This does not rank expected returns or generate
        guaranteed trade recommendations.
      </p>

      <ResearchRunDesk
        card={card}
        runState={props.runState}
        onMarkReviewed={props.onMarkReviewed}
        onRunLayer={props.onRunLayer}
        onRunSymbol={props.onRunSymbol}
      />

      <div className="research-fields">
        <TextAreaField
          label="Thesis"
          value={card.research.thesis}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'thesis', value)
          }
        />
        <TextAreaField
          label="Catalyst"
          value={card.research.catalyst}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'catalyst', value)
          }
        />
        <TextAreaField
          label="Invalidation"
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
          label="Planned entry"
          value={card.research.plannedEntry}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'plannedEntry', value)
          }
        />
        <TextField
          label="Stop"
          value={card.research.stop}
          onChange={(value) =>
            props.onUpdateResearch(card.symbol, 'stop', value)
          }
        />
        <TextField
          label="Target"
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
          <span>Manual plan fields</span>
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
            label="Planned scale-out"
            value={card.tradeSetup.plannedScaleOut}
            onChange={(value) =>
              props.onUpdateTradeSetup(card.symbol, 'plannedScaleOut', value)
            }
          />
          <TextField
            label="Invalidation"
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
          {isLoading ? 'Running' : 'Run research'}
        </button>
        <button
          disabled={isLoading}
          type="button"
          onClick={() => props.onRunLayer(card.stackLayer)}
        >
          Run layer
        </button>
        {canMarkReviewed && (
          <button
            type="button"
            onClick={() => props.onMarkReviewed(card.symbol)}
          >
            Mark reviewed
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
            detail="The selected symbol has no configured research source catalog yet."
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
            <span>{source.freshness === 'stale' ? 'Stale' : 'Fresh'}</span>
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
          <span>Layer</span>
          <select
            value={props.filters.layer}
            onChange={(event) =>
              props.onUpdateFilter(
                'layer',
                event.target.value as ResearchFiltersForm['layer'],
              )
            }
          >
            <option value="all">All layers</option>
            {AI_STACK_LAYERS.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.label}
              </option>
            ))}
          </select>
        </label>
        <NumberSetting
          label="Min score"
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
          <span>Needs input</span>
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
        Scores count completed checklist fields only. They do not score
        attractiveness, probability, or expected return.
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
        detail="Relax the layer, score, or input filters to show candidates."
        title="No candidates match"
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
            ? `${props.manualLotsNeeded} positions still need manual lots.`
            : 'No ready profit-lock scenario for the current prices.'
        }
        title="No ready scenarios"
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
        detail="Manual shares and average cost are required before allocation can be modeled."
        title="No modeled allocation"
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
        detail="Complete at least one manual lot to calculate open gain or loss."
        title="No modeled P/L"
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
        <span>Alert {formatPercent(props.alertPercent)}</span>
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
        detail="No symbols are configured for the current market feed."
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
  positions: ReturnType<typeof buildPortfolioModel>['positions']
  manualLots: ManualLotInputs
  onUpdate: (
    symbol: string,
    field: keyof ManualLotInputs[string],
    value: string,
  ) => void
}) {
  return (
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
                props.onUpdate(position.symbol, 'shares', event.target.value)
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
        </div>
      ))}
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

function ProfitLockTicketCard(props: { ticket: ProfitLockTicket }) {
  const { ticket } = props

  return (
    <article className={`ticket-row ${ticket.status}`}>
      <div className="ticket-topline">
        <span className={`ticket-state ${ticket.status}`}>
          {ticket.status === 'ready' ? 'Manual scenario' : 'Not applicable'}
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
          <dt>Remain wt</dt>
          <dd>{formatPercent(ticket.remainingWeightPercent)}</dd>
        </div>
      </dl>
      <p className="state-note">{ticket.note}</p>
    </article>
  )
}

function QuoteTable(props: {
  symbols: readonly string[]
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
        const label = getSymbolLabel(symbol)

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
        bundle.warning ?? 'No transparent sources were returned for this symbol.',
      sources: bundle.sources,
      draft: null,
    }
  }

  if (bundle.status === 'stale_source') {
    return {
      status: 'stale_source',
      updatedAt: bundle.generatedAt,
      message:
        'Draft inserted, but every source timestamp is stale. Review URLs before relying on it.',
      sources: bundle.sources,
      draft,
    }
  }

  return {
    status: 'needs_review',
    updatedAt: bundle.generatedAt,
    message:
      'AI-drafted fields were inserted. Review every source note before accepting the card.',
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
      return 'AI-drafted · Needs review'
    case 'reviewed':
      return 'Reviewed'
    case 'empty_source':
      return 'Empty source'
    case 'stale_source':
      return 'Stale source · Needs review'
    case 'error':
      return 'Research error'
  }
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
    const label = getSymbolLabel(symbol)

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

function getSymbolLabel(symbol: string): { name: string; layer: string } {
  const holding = seedHoldings.find((item) => item.symbol === symbol)
  const watchlistItem = seedWatchlist.find((item) => item.symbol === symbol)

  if (holding) {
    return {
      name: holding.name,
      layer: watchlistItem
        ? getAiStackLayerLabel(watchlistItem.stackLayer)
        : 'Holding',
    }
  }

  return {
    name: watchlistItem?.name ?? symbol,
    layer: watchlistItem
      ? getAiStackLayerLabel(watchlistItem.stackLayer)
      : 'Watchlist',
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
