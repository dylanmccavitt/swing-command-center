import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { seedHoldings } from './data/seedHoldings'
import { seedWatchlist } from './data/seedWatchlist'
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
  cashRunwayDollars: String(DEFAULT_PORTFOLIO_SETTINGS.cashRunwayDollars),
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
  const [cashTargetInput, setCashTargetInput] = useState('1000')
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

        <div className="status-grid" aria-label="Portfolio status">
          <MetricTile
            label="Seeded symbols"
            value={String(summary.totalSymbols)}
            detail={summary.symbols.join(', ')}
          />
          <MetricTile
            label="Modeled value"
            value={formatCurrency(portfolioModel.totalMarketValue)}
            detail={`${portfolioModel.completePositionCount} positions with local lot inputs`}
          />
          <MetricTile
            label="Open P/L"
            value={formatSignedCurrency(portfolioModel.totalUnrealizedGain)}
            detail={`${portfolioModel.manualLotsNeeded} positions still need manual lots`}
          />
          <MetricTile
            label="Market data"
            value={marketStatus}
            detail={marketTimestamp}
          />
        </div>
      </section>

      <section className="settings-panel" aria-label="Risk settings">
        <div className="section-heading">
          <p className="eyebrow">Risk rules</p>
          <h2>Concentration and planning settings</h2>
          <p>{portfolioModel.rules.alertDefinition}</p>
        </div>

        <div className="settings-grid">
          <NumberSetting
            label="Alert weight"
            suffix="%"
            min="1"
            max="100"
            value={settingsForm.alertPositionWeightPercent}
            onChange={(value) =>
              updateSetting('alertPositionWeightPercent', value)
            }
          />
          <NumberSetting
            label="Max single-position weight"
            suffix="%"
            min="1"
            max="100"
            value={settingsForm.maxPositionWeightPercent}
            onChange={(value) =>
              updateSetting('maxPositionWeightPercent', value)
            }
          />
          <NumberSetting
            label="Cash runway target"
            prefix="$"
            min="0"
            value={settingsForm.cashRunwayDollars}
            onChange={(value) => updateSetting('cashRunwayDollars', value)}
          />
          <NumberSetting
            label="Active trading sleeve"
            prefix="$"
            min="0"
            value={settingsForm.activeTradingSleeveDollars}
            onChange={(value) =>
              updateSetting('activeTradingSleeveDollars', value)
            }
          />
          <label className="setting-control toggle-control">
            <span>Tax reserve estimate</span>
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
            label="Tax reserve rate"
            suffix="%"
            min="0"
            max="100"
            value={settingsForm.taxReserveRatePercent}
            onChange={(value) => updateSetting('taxReserveRatePercent', value)}
          />
        </div>

        <p className="tax-copy">
          Tax reserve is an editable estimate bucket for planning. It is not tax
          advice or a tax filing calculation.
        </p>
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

      <section className="workspace-grid" aria-label="Portfolio model">
        <div className="section-heading">
          <p className="eyebrow">Portfolio model</p>
          <h2>Manual lots, concentration, and P/L</h2>
        </div>

        <div className="holding-grid">
          {portfolioModel.positions.map((position) => (
            <article className="holding-card" key={position.symbol}>
              <div>
                <div className="holding-card-header">
                  <span className="symbol">{position.symbol}</span>
                  <span
                    className={`risk-pill ${position.concentrationLevel}`}
                  >
                    {position.concentrationLabel}
                  </span>
                </div>
                <h3>{position.name}</h3>
                <p>{position.thesisTag}</p>
              </div>

              <div className="manual-lot-grid">
                <label>
                  <span>Shares</span>
                  <input
                    min="0"
                    step="0.0001"
                    type="number"
                    value={manualLots[position.symbol]?.shares ?? ''}
                    onChange={(event) =>
                      updateManualLot(
                        position.symbol,
                        'shares',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  <span>Average cost</span>
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={manualLots[position.symbol]?.averageCost ?? ''}
                    onChange={(event) =>
                      updateManualLot(
                        position.symbol,
                        'averageCost',
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <dl>
                <div>
                  <dt>Current price</dt>
                  <dd>{formatMarketPrice(position.currentPrice)}</dd>
                </div>
                <div>
                  <dt>Market value</dt>
                  <dd>{formatCurrency(position.marketValue)}</dd>
                </div>
                <div>
                  <dt>Cost basis</dt>
                  <dd>{formatCurrency(position.costBasis)}</dd>
                </div>
                <div>
                  <dt>Unrealized P/L</dt>
                  <dd>{formatSignedCurrency(position.unrealizedGain)}</dd>
                </div>
                <div>
                  <dt>Weight</dt>
                  <dd>{formatPercent(position.weightPercent)}</dd>
                </div>
              </dl>
              <p className="position-note">{position.concentrationDetail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="planner-panel" aria-label="Profit-lock planner">
        <div className="section-heading">
          <p className="eyebrow">Profit-lock planner</p>
          <h2>Manual scenario tickets</h2>
          <p>
            Outputs are scenario drafts for review, not buy or sell certainty.
          </p>
        </div>

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
            label="Specific cash amount"
            prefix="$"
            min="0"
            value={cashTargetInput}
            onChange={setCashTargetInput}
          />
          <MetricTile
            label="Tax reserve"
            value={
              portfolioModel.settings.taxReserveEnabled
                ? `${portfolioModel.settings.taxReserveRatePercent}%`
                : 'Off'
            }
            detail="estimate bucket only"
          />
        </div>

        {profitLockTickets.length === 0 ? (
          <p className="empty-state">
            Add shares, average cost, and a current price for {selectedSymbol}
            before scenario tickets are drafted.
          </p>
        ) : (
          <div className="ticket-grid">
            {profitLockTickets.map((ticket) => (
              <ProfitLockTicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </section>

      <section className="guardrail-band" aria-label="Safety guardrails">
        <h2>Guardrails</h2>
        <ul>
          <li>Local storage and manual input first.</li>
          <li>Market data is separate from brokerage access.</li>
          <li>Scenario tickets only, no automated trading.</li>
        </ul>
      </section>
    </main>
  )
}

export default App

function MetricTile(props: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="metric-tile">
      <span className="metric-label">{props.label}</span>
      <strong>{props.value}</strong>
      <span>{props.detail}</span>
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
    <article className={`ticket-card ${ticket.status}`}>
      <div>
        <span className={`ticket-state ${ticket.status}`}>
          {ticket.status === 'ready'
            ? 'Manual ticket scenario'
            : 'Not applicable'}
        </span>
        <h3>{ticket.title}</h3>
        <p>{ticket.description}</p>
      </div>
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
          <dt>Realized gain</dt>
          <dd>{formatSignedCurrency(ticket.estimatedRealizedGain)}</dd>
        </div>
        <div>
          <dt>Tax reserve</dt>
          <dd>{formatCurrency(ticket.estimatedTaxReserve)}</dd>
        </div>
        <div>
          <dt>Cash after reserve</dt>
          <dd>{formatCurrency(ticket.estimatedNetCash)}</dd>
        </div>
        <div>
          <dt>Remaining weight</dt>
          <dd>{formatPercent(ticket.remainingWeightPercent)}</dd>
        </div>
      </dl>
      <p className="position-note">{ticket.note}</p>
    </article>
  )
}

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
