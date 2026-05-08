import { describe, expect, it } from 'vitest'
import {
  buildAllocationRows,
  buildTopProfitLockScenarios,
  summarizeCashRunway,
  summarizeConcentrationRisk,
} from './cockpit'
import { buildPortfolioModel } from './portfolio'

describe('cockpit summaries', () => {
  it('prioritizes ready profit-lock scenarios from concentrated positions', () => {
    const model = buildPortfolioModel(
      [
        buildHolding('NVDA', 20, 50, 100),
        buildHolding('AAPL', 10, 50, 100),
        buildHolding('GOOG', 10, 50, 100),
      ],
      {
        alertPositionWeightPercent: 25,
        maxPositionWeightPercent: 30,
        cashRunwayDollars: 700,
      },
    )

    const scenarios = buildTopProfitLockScenarios({
      model,
      cashTargetAmount: 700,
      limit: 2,
    })

    expect(scenarios).toHaveLength(2)
    expect(scenarios[0]).toMatchObject({
      symbol: 'NVDA',
      concentrationLevel: 'over_cap',
      id: 'trim_to_target_weight',
      status: 'ready',
    })
    expect(scenarios[0].estimatedNetCash).toBeGreaterThan(0)
  })

  it('summarizes concentration before and after lots are complete', () => {
    const incompleteModel = buildPortfolioModel([
      buildHolding('AAPL', null, null, 100),
      buildHolding('NVDA', null, null, 100),
    ])
    const completeModel = buildPortfolioModel(
      [
        buildHolding('IREN', 100, 5, 8),
        buildHolding('GOOG', 1, 200, 200),
      ],
      {
        alertPositionWeightPercent: 25,
        maxPositionWeightPercent: 30,
      },
    )

    expect(summarizeConcentrationRisk(incompleteModel)).toMatchObject({
      state: 'needs_input',
      label: 'Needs details',
      atRiskCount: 0,
      needsInputCount: 2,
    })
    expect(summarizeConcentrationRisk(completeModel)).toMatchObject({
      state: 'over_cap',
      label: 'Too big',
      atRiskCount: 1,
      needsInputCount: 0,
    })
  })

  it('compares visible scenario cash with the runway target', () => {
    const model = buildPortfolioModel(
      [
        buildHolding('NVDA', 20, 50, 100),
        buildHolding('AAPL', 10, 50, 100),
        buildHolding('GOOG', 10, 50, 100),
      ],
      {
        maxPositionWeightPercent: 30,
        cashRunwayDollars: 500,
        taxReserveEnabled: false,
      },
    )
    const scenarios = buildTopProfitLockScenarios({
      model,
      cashTargetAmount: 500,
      limit: 3,
    })

    expect(summarizeCashRunway(model, scenarios)).toMatchObject({
      targetAmount: 500,
      shortfallAmount: 0,
      label: 'Covered',
    })
  })

  it('sorts allocation rows by modeled market value', () => {
    const model = buildPortfolioModel([
      buildHolding('AAPL', 1, 100, 100),
      buildHolding('NVDA', 3, 100, 100),
    ])

    expect(buildAllocationRows(model).map((row) => row.symbol)).toEqual([
      'NVDA',
      'AAPL',
    ])
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
