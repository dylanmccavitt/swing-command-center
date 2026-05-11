import { describe, expect, it } from 'vitest'
import type { SeedWatchlistItem } from '../data/seedWatchlist'
import { buildActionDesk, ACTION_DESK_DISCLOSURE } from './actionDesk'
import { buildTopProfitLockScenarios } from './cockpit'
import { buildPortfolioModel } from './portfolio'
import { buildProfitCashPlan } from './profitCashPlan'
import { buildResearchCandidateScores } from './researchWatchlist'
import { buildBuyingPowerSummary } from './sellFills'

describe('action desk', () => {
  it('prioritizes missing basis before redeploying available cash', () => {
    const positions = buildPortfolioModel([
      holding({ symbol: 'NVDA', shares: 10, averageCost: 100, currentPrice: 150 }),
    ]).positions
    const cards = [card({ symbol: 'NVDA', seedType: 'current_holding' })]
    const researchScores = buildResearchCandidateScores(cards)
    const buyingPower = buildBuyingPowerSummary({
      records: [
        {
          id: 'nvda-fill',
          status: 'filled',
          symbol: 'NVDA',
          sharesSold: 2,
          fillPrice: 180,
          averageCost: null,
          costBasis: null,
          filledDate: '2026-05-11',
          fees: 0,
          source: 'manual',
          reference: '',
          notes: '',
        },
      ],
      startingCash: 500,
    })
    const profitCashPlan = buildProfitCashPlan({
      buyingPower,
      positions,
      researchScores,
    })

    const desk = buildActionDesk({
      buyingPower,
      codexQueue: {},
      positions,
      profitCashPlan,
      researchCards: cards,
      researchRuns: {},
      researchScores,
      topProfitLockScenarios: [],
    })

    expect(desk.disclosure).toBe(ACTION_DESK_DISCLOSURE)
    expect(desk.items[0]).toMatchObject({
      type: 'basis_fix',
      targetView: 'import',
      tone: 'warn',
    })
    expect(desk.items.map((item) => item.type)).toContain('cash_redeploy')
    expect(desk.blockedCount).toBe(1)
  })

  it('turns low-completeness cards into Codex research queue work', () => {
    const positions = buildPortfolioModel([
      holding({ symbol: 'AAPL', shares: 5, averageCost: 150, currentPrice: 190 }),
    ]).positions
    const cards = [
      card({ symbol: 'AAPL', seedType: 'current_holding', thesis: 'Ecosystem hold.' }),
      card({ symbol: 'AMD', seedType: 'placeholder' }),
    ]
    const researchScores = buildResearchCandidateScores(cards)
    const buyingPower = buildBuyingPowerSummary({ records: [] })
    const profitCashPlan = buildProfitCashPlan({
      buyingPower,
      positions,
      researchScores,
      quotesBySymbol: new Map([['AMD', { price: 160 }]]),
    })

    const emptyQueueDesk = buildActionDesk({
      buyingPower,
      codexQueue: {},
      positions,
      profitCashPlan,
      researchCards: cards,
      researchRuns: {},
      researchScores,
      topProfitLockScenarios: [],
    })

    expect(emptyQueueDesk.items).toContainEqual(
      expect.objectContaining({
        primaryAction: 'queue_research',
        symbol: 'AMD',
        targetView: 'research',
        type: 'research_queue',
      }),
    )

    const pendingQueueDesk = buildActionDesk({
      buyingPower,
      codexQueue: {
        AMD: {
          status: 'pending',
          updatedAt: '2026-05-11T12:00:00.000Z',
        },
      },
      positions,
      profitCashPlan,
      researchCards: cards,
      researchRuns: {},
      researchScores,
      topProfitLockScenarios: [],
    })

    expect(pendingQueueDesk.items).toContainEqual(
      expect.objectContaining({
        primaryAction: 'import_result',
        symbol: 'AMD',
        type: 'research_import',
      }),
    )
  })

  it('surfaces missing holding inputs and concentration trim review', () => {
    const model = buildPortfolioModel(
      [
        holding({ symbol: 'AAPL', shares: 1, averageCost: 150, currentPrice: 190 }),
        holding({ symbol: 'NVDA', shares: 20, averageCost: 100, currentPrice: 250 }),
        holding({ symbol: 'IREN', shares: null, averageCost: null, currentPrice: 8 }),
      ],
      { maxPositionWeightPercent: 30, alertPositionWeightPercent: 25 },
    )
    const cards = [
      readyCard({ symbol: 'AAPL', seedType: 'current_holding' }),
      readyCard({ symbol: 'NVDA', seedType: 'current_holding' }),
      card({ symbol: 'IREN', seedType: 'current_holding' }),
    ]
    const researchScores = buildResearchCandidateScores(cards)
    const buyingPower = buildBuyingPowerSummary({ records: [] })
    const profitCashPlan = buildProfitCashPlan({
      buyingPower,
      positions: model.positions,
      researchScores,
    })

    const desk = buildActionDesk({
      buyingPower,
      codexQueue: {},
      positions: model.positions,
      profitCashPlan,
      researchCards: cards,
      researchRuns: {},
      researchScores,
      topProfitLockScenarios: buildTopProfitLockScenarios({
        model,
        cashTargetAmount: 1000,
      }),
    })

    expect(desk.items).toContainEqual(
      expect.objectContaining({
        symbol: 'IREN',
        type: 'holding_setup',
      }),
    )
    expect(desk.items).toContainEqual(
      expect.objectContaining({
        symbol: 'NVDA',
        type: 'risk_trim',
      }),
    )
  })
})

function holding(overrides: {
  symbol: string
  shares: number | null
  averageCost: number | null
  currentPrice: number | null
}) {
  return {
    symbol: overrides.symbol,
    name: overrides.symbol,
    stackLayer: 'General',
    thesisTag: 'Manual test holding.',
    shares: overrides.shares,
    averageCost: overrides.averageCost,
    currentPrice: overrides.currentPrice,
  }
}

function card(
  overrides: Partial<{
    symbol: string
    seedType: SeedWatchlistItem['seedType']
    thesis: string
  }> = {},
): SeedWatchlistItem {
  return {
    symbol: overrides.symbol ?? 'DRAFT',
    name: overrides.symbol ?? 'Draft',
    stackLayer: 'general_watchlist',
    seedType: overrides.seedType ?? 'placeholder',
    research: {
      thesis: overrides.thesis ?? '',
      catalyst: '',
      invalidation: '',
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
    },
  }
}

function readyCard(
  overrides: Partial<{
    symbol: string
    seedType: SeedWatchlistItem['seedType']
  }> = {},
): SeedWatchlistItem {
  return {
    ...card(overrides),
    research: {
      thesis: 'Manual thesis',
      catalyst: 'Catalyst to watch',
      invalidation: 'What changes the setup',
      riskNotes: 'Risk notes',
      sourceNotes: 'Source notes',
      plannedEntry: 'Above support',
      stop: 'Below support',
      target: 'Prior high',
      reviewDate: '2026-05-15',
    },
    tradeSetup: {
      entryTrigger: 'Breakout with volume',
      stopLevel: '$100',
      target: '$120',
      maxLoss: '$250',
      plannedScaleOut: 'Half at first target',
      invalidation: 'Close below support',
      timeHorizon: '2-4 weeks',
    },
  }
}
