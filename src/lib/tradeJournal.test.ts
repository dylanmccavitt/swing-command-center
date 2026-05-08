import { describe, expect, it } from 'vitest'
import type { SeedWatchlistItem } from '../data/seedWatchlist'
import { buildPortfolioModel } from './portfolio'
import { buildProfitLockTickets } from './profitLock'
import { buildTargetStopScenario } from './scenarioPlanner'
import type { ScenarioPlannerInput } from './scenarioPlanner'
import {
  buildJournalEntryFromTicket,
  buildManualTradeTicketFromProfitLock,
  buildManualTradeTicketFromTradeSetup,
  buildRealizedProfitSummary,
  buildTaxHelperExport,
  DEFAULT_PAY_YOURSELF_RULE,
  estimatePayYourselfAmount,
  TRADE_JOURNAL_DISCLOSURE,
} from './tradeJournal'

describe('manual trade tickets and journal', () => {
  it('generates manual trade tickets from profit-lock scenarios', () => {
    const { selected, totalMarketValue } = buildModelPosition()
    const profitLockTicket = buildProfitLockTickets({
      position: selected,
      portfolioMarketValue: totalMarketValue,
      settings: {
        taxReserveEnabled: true,
        taxReserveRatePercent: 25,
      },
    }).find((ticket) => ticket.id === 'lock_20_percent_gain')

    expect(profitLockTicket).toBeDefined()

    const manualTicket = buildManualTradeTicketFromProfitLock({
      symbol: 'NVDA',
      name: 'NVIDIA',
      ticket: profitLockTicket!,
      invalidation: 'Skip if NVDA loses the breakout level.',
    })

    expect(manualTicket.source).toBe('profit_lock')
    expect(manualTicket.status).toBe('ready')
    expect(manualTicket.action).toBe('Review a possible trim / sale')
    expect(manualTicket.estimatedShares).toBeCloseTo(4)
    expect(manualTicket.estimatedCashRaised).toBeCloseTo(400)
    expect(manualTicket.estimatedCashSpent).toBe(0)
    expect(manualTicket.estimatedRealizedGain).toBeCloseTo(200)
    expect(manualTicket.taxReserveEstimate).toBeCloseTo(50)
    expect(manualTicket.reason).toContain('Take 20% of open gain')
    expect(manualTicket.invalidation).toContain('breakout level')
  })

  it('generates manual trade tickets from trade setups without treating them as orders', () => {
    const scenario = buildTargetStopScenario(
      buildScenarioInput({
        symbol: 'AMD',
        name: 'Advanced Micro Devices',
        currentPrice: 50,
        averageCost: null,
        shares: 20,
        supportPrice: 45,
        maxLossDollars: 100,
        desiredRiskReward: 2,
        trimPercent: 25,
      }),
    )
    const ticket = buildManualTradeTicketFromTradeSetup({
      card: buildWatchlistCard({
        seedType: 'placeholder',
        symbol: 'AMD',
        tradeSetup: {
          entryTrigger: 'Break above $50 on volume',
          stopLevel: '$45 close',
          target: '$60 first target',
          maxLoss: '$100',
          plannedScaleOut: 'Trim 25% at first target',
          invalidation: 'Volume fails and price loses $45.',
          timeHorizon: '2-4 weeks',
        },
      }),
      scenario,
      settings: {
        taxReserveEnabled: true,
        taxReserveRatePercent: 25,
      },
    })

    expect(ticket.source).toBe('trade_setup')
    expect(ticket.status).toBe('ready')
    expect(ticket.action).toBe('Review a possible watchlist trade')
    expect(ticket.estimatedShares).toBe(20)
    expect(ticket.estimatedCashSpent).toBe(1000)
    expect(ticket.estimatedCashRaised).toBe(0)
    expect(ticket.estimatedRealizedGain).toBe(0)
    expect(ticket.taxReserveEstimate).toBe(0)
    expect(ticket.reason).toContain('Entry idea')
    expect(ticket.invalidation).toContain('loses $45')
    expect(ticket.disclosure).toContain('no order execution')
  })

  it('tracks journal statuses and realized-profit math without counting planned entries as realized', () => {
    const ticket = buildManualTradeTicketFromProfitLock({
      symbol: 'NVDA',
      name: 'NVIDIA',
      ticket: {
        id: 'lock_20_percent_gain',
        title: 'Take 20% of open gain',
        description: 'Manual gain-lock scenario.',
        status: 'ready',
        note: 'Manual scenario only.',
        sharesToSell: 4,
        estimatedProceeds: 400,
        estimatedRealizedGain: 300,
        estimatedTaxReserve: 75,
        estimatedNetCash: 325,
        remainingShares: 16,
        remainingMarketValue: 1600,
        remainingWeightPercent: 30,
      },
    })
    const planned = buildJournalEntryFromTicket(ticket, {
      createdAt: '2026-05-08T12:00:00.000Z',
      status: 'planned',
    })
    const executed = buildJournalEntryFromTicket(ticket, {
      createdAt: '2026-05-08T13:00:00.000Z',
      status: 'executed',
    })
    const mistake = buildJournalEntryFromTicket(ticket, {
      createdAt: '2026-05-08T14:00:00.000Z',
      realizedProfitLoss: -50,
      status: 'mistake',
      taxReserveEstimate: 0,
    })

    expect(planned.type).toBe('planned_trade')
    expect(planned.realizedProfitLoss).toBe(0)
    expect(executed.type).toBe('executed_trade')
    expect(mistake.type).toBe('mistake')

    const summary = buildRealizedProfitSummary([planned, executed, mistake])

    expect(summary.entryCount).toBe(3)
    expect(summary.plannedCount).toBe(1)
    expect(summary.executedCount).toBe(1)
    expect(summary.mistakeCount).toBe(1)
    expect(summary.realizedEntryCount).toBe(2)
    expect(summary.grossRealizedProfit).toBe(300)
    expect(summary.realizedLoss).toBe(-50)
    expect(summary.netRealizedTradingProfit).toBe(250)
    expect(summary.taxReserveEstimate).toBe(75)
  })

  it('defaults the pay-yourself rule to a small slice of net realized profit after reserve', () => {
    expect(DEFAULT_PAY_YOURSELF_RULE.percentOfNetAfterReserve).toBe(5)
    expect(estimatePayYourselfAmount(400, 100)).toBe(15)
    expect(
      estimatePayYourselfAmount(400, 100, {
        enabled: false,
        percentOfNetAfterReserve: 50,
      }),
    ).toBe(0)

    const ticket = buildManualTradeTicketFromProfitLock({
      symbol: 'NVDA',
      name: 'NVIDIA',
      ticket: {
        id: 'recover_cost_basis',
        title: 'Recover cost basis',
        description: 'Manual cash raise.',
        status: 'ready',
        note: 'Manual scenario only.',
        sharesToSell: 4,
        estimatedProceeds: 600,
        estimatedRealizedGain: 400,
        estimatedTaxReserve: 100,
        estimatedNetCash: 500,
        remainingShares: 16,
        remainingMarketValue: 2400,
        remainingWeightPercent: 28,
      },
    })
    const entry = buildJournalEntryFromTicket(ticket, {
      createdAt: '2026-05-08T12:00:00.000Z',
      status: 'executed',
    })
    const summary = buildRealizedProfitSummary([entry])

    expect(entry.payYourselfAmount).toBe(15)
    expect(summary.profitAfterReserve).toBe(300)
    expect(summary.recommendedPayYourselfAmount).toBe(15)
    expect(summary.loggedPayYourselfAmount).toBe(15)
  })

  it('exports a tax review shape with summary, entries, and guardrails', () => {
    const ticket = buildManualTradeTicketFromProfitLock({
      symbol: 'AAPL',
      name: 'Apple',
      ticket: {
        id: 'raise_cash_amount',
        title: 'Raise specific cash amount',
        description: 'Manual cash target.',
        status: 'ready',
        note: 'Manual scenario only.',
        sharesToSell: 2,
        estimatedProceeds: 300,
        estimatedRealizedGain: 120,
        estimatedTaxReserve: 30,
        estimatedNetCash: 270,
        remainingShares: 8,
        remainingMarketValue: 1200,
        remainingWeightPercent: 20,
      },
    })
    const entry = buildJournalEntryFromTicket(ticket, {
      createdAt: '2026-05-08T12:00:00.000Z',
      status: 'result',
      taxPrepNotes: 'Match against broker statement lot details.',
    })
    const exported = buildTaxHelperExport({
      entries: [entry],
      generatedAt: '2026-05-08T12:30:00.000Z',
    })

    expect(exported.schemaVersion).toBe('manual-trade-journal-v1')
    expect(exported.generatedAt).toBe('2026-05-08T12:30:00.000Z')
    expect(exported.summary.netRealizedTradingProfit).toBe(120)
    expect(exported.entries).toHaveLength(1)
    expect(exported.entries[0].taxPrepNotes).toContain('broker statement')
    expect(exported.guardrails.join(' ')).toContain('Not a filing document')
  })

  it('keeps copy framed as non-automated planning and not tax advice', () => {
    expect(TRADE_JOURNAL_DISCLOSURE).toContain('Manual checklist')
    expect(TRADE_JOURNAL_DISCLOSURE).toContain('No broker credentials')
    expect(TRADE_JOURNAL_DISCLOSURE).toContain('no automated trading')
    expect(TRADE_JOURNAL_DISCLOSURE).toContain('not a filing document')
    expect(TRADE_JOURNAL_DISCLOSURE).toContain('tax advice')
    expect(TRADE_JOURNAL_DISCLOSURE).not.toMatch(/\bshould\s+(buy|sell)\b/i)
    expect(TRADE_JOURNAL_DISCLOSURE).not.toMatch(/order execution enabled/i)
  })
})

function buildModelPosition() {
  const model = buildPortfolioModel([
    buildHolding('NVDA', 20, 50, 100),
    buildHolding('AAPL', 10, 50, 100),
    buildHolding('GOOG', 10, 50, 100),
  ])

  return {
    selected: model.positions[0],
    totalMarketValue: model.totalMarketValue,
  }
}

function buildHolding(
  symbol: string,
  shares: number,
  averageCost: number,
  currentPrice: number,
) {
  return {
    symbol,
    name: symbol,
    stackLayer: 'Test layer',
    thesisTag: 'Test thesis',
    shares,
    averageCost,
    currentPrice,
  }
}

function buildScenarioInput(
  overrides: Partial<ScenarioPlannerInput> = {},
): ScenarioPlannerInput {
  return {
    symbol: 'NVDA',
    name: 'NVIDIA',
    sourceLabel: 'Current holding',
    currentPrice: 100,
    averageCost: 80,
    shares: 20,
    maxLossDollars: 200,
    desiredRiskReward: 2,
    targetGainPercent: 30,
    trimPercent: 25,
    supportPrice: 90,
    stopLimitBufferPercent: 0.5,
    timeHorizon: '2-4 weeks',
    quoteState: 'fresh',
    ...overrides,
  }
}

function buildWatchlistCard(
  overrides: Partial<SeedWatchlistItem> & {
    tradeSetup?: Partial<SeedWatchlistItem['tradeSetup']>
  } = {},
): SeedWatchlistItem {
  return {
    symbol: overrides.symbol ?? 'NVDA',
    name: overrides.name ?? 'NVIDIA',
    stackLayer: overrides.stackLayer ?? 'gpu_chip_designers',
    seedType: overrides.seedType ?? 'current_holding',
    research: {
      thesis: '',
      catalyst: '',
      invalidation: 'Thesis invalidation.',
      riskNotes: '',
      sourceNotes: '',
      plannedEntry: '',
      stop: '',
      target: '',
      reviewDate: '',
    },
    tradeSetup: {
      entryTrigger: '',
      stopLevel: '',
      target: '',
      maxLoss: '',
      plannedScaleOut: '',
      invalidation: '',
      timeHorizon: '',
      ...overrides.tradeSetup,
    },
  }
}
