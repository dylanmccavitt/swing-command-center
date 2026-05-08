import { describe, expect, it } from 'vitest'
import type { PortfolioPosition } from './portfolio'
import type { ResearchCandidateScore } from './researchWatchlist'
import type { BuyingPowerSummary } from './sellFills'
import type { RealizedProfitSummary } from './tradeJournal'
import {
  buildProfitCashPlan,
  PROFIT_CASH_PLAN_DISCLOSURE,
} from './profitCashPlan'

describe('profit cash plan', () => {
  it('calculates cash left after reserve and pay-yourself before showing places to review', () => {
    const plan = buildProfitCashPlan({
      summary: buildSummary({
        profitAfterReserve: 300,
        recommendedPayYourselfAmount: 15,
      }),
      positions: [
        buildPosition({
          symbol: 'AAPL',
          name: 'Apple',
          currentPrice: 100,
          concentrationLabel: 'Within rules',
        }),
      ],
      researchScores: [
        buildScore({
          symbol: 'AAPL',
          name: 'Apple',
          scorePercent: 70,
          seedType: 'current_holding',
        }),
        buildScore({
          symbol: 'AMD',
          name: 'Advanced Micro Devices',
          scorePercent: 90,
          seedType: 'placeholder',
        }),
      ],
      quotesBySymbol: new Map([['AMD', { price: 50 }]]),
    })

    const holding = plan.candidates.find((candidate) => candidate.symbol === 'AAPL')
    const watchlist = plan.candidates.find(
      (candidate) => candidate.symbol === 'AMD',
    )

    expect(plan.profitAfterReserve).toBe(300)
    expect(plan.payYourselfAmount).toBe(15)
    expect(plan.cashToPlan).toBe(285)
    expect(holding).toMatchObject({
      kind: 'current_holding',
      estimatedShares: 2.85,
      researchScorePercent: 70,
    })
    expect(watchlist).toMatchObject({
      kind: 'watchlist',
      estimatedShares: 5.7,
      researchScorePercent: 90,
    })
    expect(plan.candidates.at(-1)).toMatchObject({
      kind: 'cash',
      symbol: 'CASH',
    })
  })

  it('feeds remaining filled-sell buying power into reinvest review rows', () => {
    const plan = buildProfitCashPlan({
      buyingPower: buildBuyingPower({
        startingCash: 100,
        filledSellProceeds: 598,
        taxReserveSetAside: 49.5,
        payYourselfSetAside: 7.425,
        manuallyReinvestedCash: 50,
        remainingCashAvailable: 591.075,
      }),
      positions: [
        buildPosition({
          symbol: 'AAPL',
          name: 'Apple',
          currentPrice: 100,
          concentrationLabel: 'Within rules',
        }),
      ],
      researchScores: [
        buildScore({
          symbol: 'AAPL',
          name: 'Apple',
          scorePercent: 70,
          seedType: 'current_holding',
        }),
      ],
    })

    const holding = plan.candidates.find((candidate) => candidate.symbol === 'AAPL')

    expect(plan.sourceLabel).toBe('Filled sell buying power')
    expect(plan.startingCash).toBe(100)
    expect(plan.filledSellProceeds).toBe(598)
    expect(plan.reserveSetAside).toBe(49.5)
    expect(plan.payYourselfAmount).toBe(7.425)
    expect(plan.manuallyReinvestedCash).toBe(50)
    expect(plan.cashToPlan).toBe(591.075)
    expect(holding?.estimatedShares).toBeCloseTo(5.91075)
  })

  it('keeps profit routing copy manual and non-advisory', () => {
    const plan = buildProfitCashPlan({
      summary: buildSummary({
        profitAfterReserve: 100,
        recommendedPayYourselfAmount: 5,
      }),
      positions: [
        buildPosition({
          concentrationLabel: 'Trim idea',
          concentrationLevel: 'over_cap',
        }),
      ],
      researchScores: [buildScore()],
    })
    const copy = [
      PROFIT_CASH_PLAN_DISCLOSURE,
      plan.disclosure,
      ...plan.candidates.flatMap((candidate) => [
        candidate.reason,
        candidate.nextStep,
      ]),
    ].join(' ')

    expect(copy).toContain('Manual planning only')
    expect(copy).toContain('does not recommend buys or sells')
    expect(copy).toContain('connect to a broker')
    expect(copy).toContain('tax advice')
    expect(copy).not.toMatch(/\bshould\s+(buy|sell)\b/i)
    expect(copy).not.toMatch(/order execution enabled/i)
  })
})

function buildSummary(
  overrides: Partial<RealizedProfitSummary> = {},
): RealizedProfitSummary {
  return {
    entryCount: 0,
    plannedCount: 0,
    executedCount: 0,
    mistakeCount: 0,
    resultCount: 0,
    realizedEntryCount: 0,
    grossRealizedProfit: 0,
    realizedLoss: 0,
    netRealizedTradingProfit: 0,
    taxReserveEstimate: 0,
    profitAfterReserve: 0,
    recommendedPayYourselfAmount: 0,
    loggedPayYourselfAmount: 0,
    remainingPayYourselfAmount: 0,
    taxPrepEntryCount: 0,
    ...overrides,
  }
}

function buildBuyingPower(
  overrides: Partial<BuyingPowerSummary> = {},
): BuyingPowerSummary {
  return {
    startingCash: 0,
    filledSellProceeds: 0,
    costBasisRemoved: 0,
    realizedGainLoss: 0,
    taxReserveSetAside: 0,
    payYourselfSetAside: 0,
    manuallyReinvestedCash: 0,
    remainingCashAvailable: 0,
    filledSellCount: 0,
    pendingSellCount: 0,
    ignoredSellCount: 0,
    missingInputCount: 0,
    statusCounts: {
      planned: 0,
      ordered: 0,
      filled: 0,
      canceled: 0,
      reviewed: 0,
    },
    disclosure: 'Manual planning only.',
    ...overrides,
  }
}

function buildPosition(
  overrides: Partial<PortfolioPosition> = {},
): PortfolioPosition {
  return {
    symbol: 'NVDA',
    name: 'NVIDIA',
    stackLayer: 'GPU/chip designers',
    thesisTag: 'Manual thesis',
    shares: 10,
    averageCost: 100,
    currentPrice: 150,
    marketValue: 1500,
    costBasis: 1000,
    unrealizedGain: 500,
    unrealizedGainPercent: 50,
    weightPercent: 20,
    concentrationLevel: 'within_rules',
    concentrationLabel: 'Within rules',
    concentrationDetail: 'Inside position size rules.',
    missingFields: [],
    ...overrides,
  }
}

function buildScore(
  overrides: Partial<ResearchCandidateScore> = {},
): ResearchCandidateScore {
  return {
    symbol: 'NVDA',
    name: 'NVIDIA',
    stackLayer: 'gpu_chip_designers',
    seedType: 'current_holding',
    score: 70,
    maxScore: 100,
    scorePercent: 70,
    statusLabel: 'Setup started',
    missingFields: [],
    ...overrides,
  }
}
