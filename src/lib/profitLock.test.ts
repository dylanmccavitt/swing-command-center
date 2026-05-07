import { describe, expect, it } from 'vitest'
import { buildPortfolioModel } from './portfolio'
import { buildProfitLockTickets, estimateTaxReserve } from './profitLock'

describe('profit-lock tickets', () => {
  it('calculates trim-to-target tickets against portfolio weight', () => {
    const { selected, totalMarketValue } = buildModelPosition()
    const tickets = buildProfitLockTickets({
      position: selected,
      portfolioMarketValue: totalMarketValue,
      settings: {
        maxPositionWeightPercent: 30,
        taxReserveRatePercent: 25,
        taxReserveEnabled: true,
      },
    })
    const ticket = tickets.find((item) => item.id === 'trim_to_target_weight')

    expect(ticket?.status).toBe('ready')
    expect(ticket?.sharesToSell).toBeCloseTo(8)
    expect(ticket?.estimatedProceeds).toBeCloseTo(800)
    expect(ticket?.estimatedRealizedGain).toBeCloseTo(400)
    expect(ticket?.estimatedTaxReserve).toBeCloseTo(100)
    expect(ticket?.estimatedNetCash).toBeCloseTo(700)
    expect(ticket?.remainingWeightPercent).toBeCloseTo(30)
  })

  it('locks selected percentages of unrealized gains', () => {
    const { selected, totalMarketValue } = buildModelPosition()
    const tickets = buildProfitLockTickets({
      position: selected,
      portfolioMarketValue: totalMarketValue,
      settings: {
        taxReserveRatePercent: 25,
        taxReserveEnabled: true,
      },
    })
    const tenPercent = tickets.find(
      (item) => item.id === 'lock_10_percent_gain',
    )
    const twentyPercent = tickets.find(
      (item) => item.id === 'lock_20_percent_gain',
    )
    const twentyFivePercent = tickets.find(
      (item) => item.id === 'lock_25_percent_gain',
    )

    expect(tenPercent?.sharesToSell).toBeCloseTo(2)
    expect(tenPercent?.estimatedRealizedGain).toBeCloseTo(100)
    expect(twentyPercent?.sharesToSell).toBeCloseTo(4)
    expect(twentyPercent?.estimatedRealizedGain).toBeCloseTo(200)
    expect(twentyFivePercent?.sharesToSell).toBeCloseTo(5)
    expect(twentyFivePercent?.estimatedRealizedGain).toBeCloseTo(250)
  })

  it('calculates cost-basis recovery and specific cash raise scenarios', () => {
    const { selected, totalMarketValue } = buildModelPosition()
    const tickets = buildProfitLockTickets({
      position: selected,
      portfolioMarketValue: totalMarketValue,
      cashTargetAmount: 300,
      settings: {
        taxReserveRatePercent: 25,
        taxReserveEnabled: true,
      },
    })
    const recoverBasis = tickets.find(
      (item) => item.id === 'recover_cost_basis',
    )
    const raiseCash = tickets.find((item) => item.id === 'raise_cash_amount')

    expect(recoverBasis?.sharesToSell).toBeCloseTo(10)
    expect(recoverBasis?.estimatedProceeds).toBeCloseTo(1000)
    expect(recoverBasis?.estimatedRealizedGain).toBeCloseTo(500)
    expect(recoverBasis?.estimatedTaxReserve).toBeCloseTo(125)
    expect(raiseCash?.sharesToSell).toBeCloseTo(3)
    expect(raiseCash?.estimatedProceeds).toBeCloseTo(300)
    expect(raiseCash?.estimatedRealizedGain).toBeCloseTo(150)
  })

  it('can disable tax reserve estimates', () => {
    expect(
      estimateTaxReserve(400, {
        taxReserveRatePercent: 25,
        taxReserveEnabled: false,
      }),
    ).toBe(0)

    expect(
      estimateTaxReserve(-100, {
        taxReserveRatePercent: 25,
        taxReserveEnabled: true,
      }),
    ).toBe(0)
  })

  it('does not draft gain-lock tickets for losing positions', () => {
    const model = buildPortfolioModel([
      buildHolding('IREN', 20, 10, 8),
      buildHolding('AAPL', 4, 100, 100),
    ])
    const selected = model.positions[0]
    const tickets = buildProfitLockTickets({
      position: selected,
      portfolioMarketValue: model.totalMarketValue,
      settings: {},
    })
    const gainLock = tickets.find((item) => item.id === 'lock_20_percent_gain')

    expect(gainLock?.status).toBe('not_applicable')
    expect(gainLock?.sharesToSell).toBe(0)
    expect(gainLock?.estimatedTaxReserve).toBe(0)
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
