import { describe, expect, it } from 'vitest'
import { seedHoldings } from '../data/seedHoldings'
import {
  buildPortfolioModel,
  buildPortfolioSeedSummary,
  normalizePortfolioSettings,
} from './portfolio'

describe('portfolio seed summary', () => {
  it('keeps the bootstrap holdings limited to the known current symbols', () => {
    const summary = buildPortfolioSeedSummary(seedHoldings)

    expect(summary.symbols).toEqual(['AAPL', 'GOOG', 'NVDA', 'IREN'])
    expect(summary.totalSymbols).toBe(4)
  })

  it('does not invent manual lot details for seeded holdings', () => {
    const summary = buildPortfolioSeedSummary(seedHoldings)

    expect(summary.manualLotsNeeded).toBe(4)
  })
})

describe('portfolio model', () => {
  it('models market value, cost basis, unrealized P/L, and portfolio weight', () => {
    const model = buildPortfolioModel(
      [
        buildHolding('NVDA', 10, 100, 150),
        buildHolding('AAPL', 5, 100, 100),
      ],
      {
        alertPositionWeightPercent: 60,
        maxPositionWeightPercent: 80,
      },
    )

    const nvda = model.positions.find((position) => position.symbol === 'NVDA')
    const aapl = model.positions.find((position) => position.symbol === 'AAPL')

    expect(model.totalMarketValue).toBe(2000)
    expect(model.totalCostBasis).toBe(1500)
    expect(model.totalUnrealizedGain).toBe(500)
    expect(model.completePositionCount).toBe(2)
    expect(nvda?.marketValue).toBe(1500)
    expect(nvda?.costBasis).toBe(1000)
    expect(nvda?.unrealizedGain).toBe(500)
    expect(nvda?.unrealizedGainPercent).toBe(50)
    expect(nvda?.weightPercent).toBe(75)
    expect(nvda?.concentrationLevel).toBe('alert')
    expect(aapl?.weightPercent).toBe(25)
    expect(aapl?.concentrationLevel).toBe('within_rules')
  })

  it('marks positions over the hard concentration cap as trim scenarios', () => {
    const model = buildPortfolioModel(
      [
        buildHolding('IREN', 100, 5, 8),
        buildHolding('GOOG', 1, 200, 200),
      ],
      {
        alertPositionWeightPercent: 25,
        maxPositionWeightPercent: 30,
      },
    )

    const iren = model.positions.find((position) => position.symbol === 'IREN')

    expect(iren?.weightPercent).toBe(80)
    expect(iren?.concentrationLevel).toBe('over_cap')
    expect(iren?.concentrationLabel).toBe('Trim scenario')
    expect(model.rules.alertDefinition).toContain('soft warning at 25%')
    expect(model.rules.alertDefinition).toContain('hard cap of 30%')
  })

  it('leaves incomplete manual positions out of portfolio totals', () => {
    const model = buildPortfolioModel([
      buildHolding('AAPL', null, null, 196.12),
      buildHolding('NVDA', 4, 120, 180),
    ])

    expect(model.totalMarketValue).toBe(720)
    expect(model.manualLotsNeeded).toBe(1)
    expect(model.positions[0].missingFields).toEqual([
      'shares',
      'average cost',
    ])
    expect(model.positions[0].concentrationLevel).toBe('needs_input')
  })

  it('normalizes alert settings so the soft warning does not exceed the cap', () => {
    const settings = normalizePortfolioSettings({
      alertPositionWeightPercent: 40,
      maxPositionWeightPercent: 30,
      taxReserveRatePercent: 125,
      cashRunwayDollars: -1,
      activeTradingSleeveDollars: 2500,
    })

    expect(settings.alertPositionWeightPercent).toBe(30)
    expect(settings.maxPositionWeightPercent).toBe(30)
    expect(settings.taxReserveRatePercent).toBe(100)
    expect(settings.cashRunwayDollars).toBe(0)
    expect(settings.activeTradingSleeveDollars).toBe(2500)
  })
})

function buildHolding(
  symbol: string,
  shares: number | null,
  averageCost: number | null,
  currentPrice: number | null,
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
