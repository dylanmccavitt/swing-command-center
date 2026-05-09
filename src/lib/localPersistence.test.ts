import { describe, expect, it } from 'vitest'
import { seedHoldings } from '../data/seedHoldings'
import { seedWatchlist, type SeedWatchlistItem } from '../data/seedWatchlist'
import { DEFAULT_PORTFOLIO_SETTINGS } from './portfolio'
import {
  buildSellFillsFromAcceptedRobinhoodRows,
  parseRobinhoodCsvFile,
  updateRobinhoodRowReviewState,
} from './robinhoodCsv'
import type { SellFillRecord } from './sellFills'
import { DEFAULT_PAY_YOURSELF_RULE, type TradeJournalEntry } from './tradeJournal'
import {
  buildSwingLocalStateSnapshot,
  loadSwingLocalState,
  parseSwingLocalStateSnapshot,
  saveSwingLocalState,
  serializeSwingLocalState,
  SWING_LOCAL_PERSISTENCE_KEY,
  type SwingLocalState,
  type SwingLocalStateStorage,
} from './localPersistence'

const SAVED_AT = '2026-05-08T12:00:00.000Z'

describe('local Swing state persistence', () => {
  it('serializes and hydrates core user-entered cockpit state', () => {
    const storage = createMemoryStorage()
    const state = buildLocalState({
      manualLots: {
        AAPL: { shares: '4', averageCost: '125' },
      },
      cashTargetInput: '2500',
      journalEntries: [buildJournalEntry()],
      sellFills: [buildSellFill()],
      buyingPowerForm: {
        startingCash: '500',
        manuallyReinvestedCash: '75',
      },
    })

    const saved = saveSwingLocalState(storage, state, SAVED_AT)
    const loaded = loadSwingLocalState(storage, buildLocalState())

    expect(saved.ok).toBe(true)
    expect(storage.getItem(SWING_LOCAL_PERSISTENCE_KEY)).toContain(
      'scc.swingLocalState.v1',
    )
    expect(loaded.ok).toBe(true)

    if (!loaded.ok) {
      return
    }

    expect(loaded.snapshot.savedAt).toBe(SAVED_AT)
    expect(loaded.snapshot.state.manualLots.AAPL).toEqual({
      shares: '4',
      averageCost: '125',
    })
    expect(loaded.snapshot.state.cashTargetInput).toBe('2500')
    expect(loaded.snapshot.state.journalEntries[0]).toMatchObject({
      symbol: 'AAPL',
      status: 'executed',
    })
    expect(loaded.snapshot.state.sellFills[0]).toMatchObject({
      symbol: 'NVDA',
      status: 'filled',
    })
    expect(loaded.snapshot.state.buyingPowerForm.startingCash).toBe('500')
  })

  it('rejects unsupported snapshot versions without hydrating state', () => {
    const snapshot = buildSwingLocalStateSnapshot(buildLocalState(), SAVED_AT)
    const result = parseSwingLocalStateSnapshot(
      JSON.stringify({
        ...snapshot,
        schemaVersion: 'scc.swingLocalState.v0',
      }),
      buildLocalState(),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.status).toBe('unsupported')
    expect(result.errors[0]).toContain('scc.swingLocalState.v1')
  })

  it('rejects invalid stored data instead of corrupting current app state', () => {
    const snapshot = buildSwingLocalStateSnapshot(buildLocalState(), SAVED_AT)
    const invalid = JSON.parse(serializeSwingLocalState(snapshot)) as {
      state: Record<string, unknown>
    }
    invalid.state.holdings = 'AAPL'

    const result = parseSwingLocalStateSnapshot(
      JSON.stringify(invalid),
      buildLocalState(),
    )

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.status).toBe('invalid')
    expect(result.errors.join(' ')).toContain('holdings')
  })

  it('hydrates missing optional UI fields from defaults', () => {
    const defaults = buildLocalState({
      cashTargetInput: '1000',
      researchFilters: {
        layer: 'all',
        minimumScore: '3',
        holdingsOnly: true,
        needsInputOnly: false,
      },
      scenarioPlannerForms: {
        AAPL: {
          maxLossDollars: '150',
        },
      },
    })
    const snapshot = buildSwingLocalStateSnapshot(buildLocalState(), SAVED_AT)
    const olderShape = JSON.parse(serializeSwingLocalState(snapshot)) as {
      state: Record<string, unknown>
    }

    delete olderShape.state.cashTargetInput
    delete olderShape.state.researchFilters
    delete olderShape.state.scenarioPlannerForms

    const result = parseSwingLocalStateSnapshot(
      JSON.stringify(olderShape),
      defaults,
    )

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('cashTargetInput missing'),
        expect.stringContaining('researchFilters missing'),
        expect.stringContaining('scenarioPlannerForms missing'),
      ]),
    )
    expect(result.snapshot.state.cashTargetInput).toBe('1000')
    expect(result.snapshot.state.researchFilters).toEqual(
      defaults.researchFilters,
    )
    expect(result.snapshot.state.scenarioPlannerForms).toEqual(
      defaults.scenarioPlannerForms,
    )
  })

  it('adds newly seeded research cards without overwriting saved edits', () => {
    const defaults = buildLocalState()
    const savedCards = defaults.researchCards
      .filter((card) => card.symbol !== 'HIMS')
      .map((card) =>
        card.symbol === 'AAPL'
          ? {
              ...card,
              research: {
                ...card.research,
                thesis: 'Saved local AAPL thesis',
              },
            }
          : card,
      )
    const saved = buildLocalState({ researchCards: savedCards })

    const result = parseSwingLocalStateSnapshot(
      serializeSwingLocalState(buildSwingLocalStateSnapshot(saved, SAVED_AT)),
      defaults,
    )

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(
      result.snapshot.state.researchCards.find((card) => card.symbol === 'AAPL')
        ?.research.thesis,
    ).toBe('Saved local AAPL thesis')
    expect(
      result.snapshot.state.researchCards.find((card) => card.symbol === 'HIMS'),
    ).toMatchObject({
      name: 'Hims & Hers Health',
      stackLayer: 'general_watchlist',
    })
  })

  it('preserves Robinhood review gates across reload hydration', () => {
    const parsed = parseRobinhoodCsvFile({
      fileName: 'realized-gain-loss.csv',
      importedAt: SAVED_AT,
      text: [
        'Symbol,Date Acquired,Date Sold,Quantity,Proceeds,Cost Basis,Realized Gain/Loss,Term,Wash Sale Loss Disallowed',
        'NVDA,01/02/2026,05/02/2026,4,"$1,200.00","$1,000.00",$200.00,Short Term,$0.00',
        'AMD,01/10/2026,05/03/2026,5,$500.00,$600.00,"($100.00)",Short Term,$25.00',
      ].join('\n'),
    })
    const acceptedFirstRow = updateRobinhoodRowReviewState(
      parsed.rows,
      parsed.rows[0].id,
      'accepted',
    )
    const mixedReviewRows = updateRobinhoodRowReviewState(
      acceptedFirstRow,
      parsed.rows[1].id,
      'rejected',
    )
    const state = buildLocalState({
      robinhoodImports: parsed.batch ? [parsed.batch] : [],
      robinhoodRows: mixedReviewRows,
    })
    const result = parseSwingLocalStateSnapshot(
      serializeSwingLocalState(buildSwingLocalStateSnapshot(state, SAVED_AT)),
      buildLocalState(),
    )

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.snapshot.state.robinhoodRows.map((row) => row.reviewState))
      .toEqual(['accepted', 'rejected'])
    expect(
      buildSellFillsFromAcceptedRobinhoodRows(
        result.snapshot.state.robinhoodRows,
      ),
    ).toHaveLength(1)
  })
})

function buildLocalState(
  overrides: Partial<SwingLocalState> = {},
): SwingLocalState {
  return {
    holdings: clone(seedHoldings),
    manualLots: Object.fromEntries(
      seedHoldings.map((holding) => [
        holding.symbol,
        {
          shares: '',
          averageCost: '',
        },
      ]),
    ),
    settingsForm: {
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
      cashRunwayDollars: '1000',
      activeTradingSleeveDollars: String(
        DEFAULT_PORTFOLIO_SETTINGS.activeTradingSleeveDollars,
      ),
    },
    cashTargetInput: '1000',
    researchCards: cloneWatchlist(seedWatchlist),
    selectedResearchSymbol: seedWatchlist[0].symbol,
    researchFilters: {
      layer: 'all',
      minimumScore: '0',
      holdingsOnly: false,
      needsInputOnly: false,
    },
    selectedPlannerSymbol: seedWatchlist[0].symbol,
    scenarioPlannerForms: {},
    payYourselfForm: {
      enabled: DEFAULT_PAY_YOURSELF_RULE.enabled,
      percentOfNetAfterReserve: String(
        DEFAULT_PAY_YOURSELF_RULE.percentOfNetAfterReserve,
      ),
    },
    journalEntries: [],
    sellFills: [],
    robinhoodImports: [],
    robinhoodRows: [],
    buyingPowerForm: {
      startingCash: '',
      manuallyReinvestedCash: '',
    },
    ...overrides,
  }
}

function buildJournalEntry(): TradeJournalEntry {
  return {
    id: 'journal-aapl-1',
    createdAt: SAVED_AT,
    symbol: 'AAPL',
    name: 'Apple',
    ticketId: 'AAPL-trim',
    source: 'profit_lock',
    type: 'executed_trade',
    status: 'executed',
    action: 'Review a possible trim / sale',
    shares: 1,
    cashRaised: 200,
    cashSpent: 0,
    realizedProfitLoss: 75,
    taxReserveEstimate: 18.75,
    payYourselfAmount: 2.81,
    notes: 'Filled manually.',
    taxPrepNotes: 'Statement needed before tax use.',
  }
}

function buildSellFill(): SellFillRecord {
  return {
    id: 'nvda-fill-1',
    status: 'filled',
    symbol: 'NVDA',
    sharesSold: 4,
    fillPrice: 300,
    averageCost: 250,
    costBasis: null,
    filledDate: '2026-05-08',
    fees: 0,
    source: 'manual entry',
    reference: 'ticket-1',
    notes: 'Local fill.',
  }
}

function cloneWatchlist(
  cards: readonly SeedWatchlistItem[],
): SeedWatchlistItem[] {
  return cards.map((card) => ({
    ...card,
    research: { ...card.research },
    tradeSetup: { ...card.tradeSetup },
  }))
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createMemoryStorage(): SwingLocalStateStorage {
  const values = new Map<string, string>()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}
