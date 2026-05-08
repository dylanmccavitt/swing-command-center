import { describe, expect, it } from 'vitest'
import {
  buildTargetStopScenario,
  SCENARIO_PLANNER_DISCLOSURE,
} from './scenarioPlanner'
import type { ScenarioPlannerInput } from './scenarioPlanner'

describe('target and stop scenario planner', () => {
  it('calculates support-based stops, R targets, trim proceeds, and remaining position', () => {
    const scenario = buildTargetStopScenario(
      buildInput({
        currentPrice: 100,
        averageCost: 80,
        shares: 20,
        maxLossDollars: 200,
        desiredRiskReward: 2,
        targetGainPercent: 35,
        trimPercent: 25,
        supportPrice: 92,
      }),
    )

    expect(scenario.status).toBe('ready')
    expect(scenario.plannedEntry.value).toBe(100)
    expect(scenario.stopLevel.value).toBe(92)
    expect(scenario.stopLevel.reason).toContain('manual support')
    expect(scenario.firstTarget.value).toBe(116)
    expect(scenario.firstTarget.reason).toContain('2R')
    expect(scenario.stretchTarget.value).toBe(135)
    expect(scenario.stretchTarget.reason).toContain('35% gain')
    expect(scenario.trimShares.value).toBe(5)
    expect(scenario.estimatedProceeds.value).toBe(580)
    expect(scenario.estimatedGainLoss.value).toBe(180)
    expect(scenario.remainingShares.value).toBe(15)
    expect(scenario.remainingPositionValue.value).toBe(1740)
  })

  it('calculates risk-budget stops when no manual support is provided', () => {
    const scenario = buildTargetStopScenario(
      buildInput({
        currentPrice: 50,
        averageCost: 40,
        shares: 10,
        maxLossDollars: 75,
        desiredRiskReward: 3,
        targetGainPercent: 20,
        trimPercent: 50,
        supportPrice: null,
      }),
    )

    expect(scenario.status).toBe('ready')
    expect(scenario.stopLevel.value).toBe(42.5)
    expect(scenario.stopLevel.reason).toContain('$75 risk budget')
    expect(scenario.firstTarget.value).toBe(72.5)
    expect(scenario.stretchTarget.value).toBe(80)
  })

  it('applies the stop-limit buffer below the stop trigger', () => {
    const scenario = buildTargetStopScenario(
      buildInput({
        stopLimitBufferPercent: 1.5,
        supportPrice: 92,
      }),
    )

    expect(scenario.stopLimit.stop).toBe(92)
    expect(scenario.stopLimit.limit).toBeCloseTo(90.62)
    expect(scenario.stopLimit.bufferPercent).toBe(1.5)
    expect(scenario.stopLimit.note).toContain('buffer below the stop')
    expect(scenario.stopLimit.note).toContain('can miss fills')
  })

  it('reports missing inputs without inventing gain/loss math', () => {
    const scenario = buildTargetStopScenario(
      buildInput({
        averageCost: null,
        currentPrice: null,
        quoteState: 'missing',
      }),
    )

    expect(scenario.status).toBe('missing_input')
    expect(scenario.estimatedGainLoss.value).toBeNull()
    expect(scenario.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'missing_market_data',
        'missing_current_price',
        'missing_average_cost',
      ]),
    )
  })

  it('flags invalid risk/reward and long stops above entry', () => {
    const scenario = buildTargetStopScenario(
      buildInput({
        currentPrice: 100,
        desiredRiskReward: -1,
        supportPrice: 102,
      }),
    )

    expect(scenario.status).toBe('invalid')
    expect(scenario.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid_risk_reward' }),
        expect.objectContaining({ code: 'invalid_stop_level' }),
      ]),
    )
  })

  it('keeps copy framed as manual review instead of a recommendation', () => {
    const scenario = buildTargetStopScenario(buildInput())

    expect(SCENARIO_PLANNER_DISCLOSURE).toContain('Manual scenario')
    expect(SCENARIO_PLANNER_DISCLOSURE).toContain('Not a recommendation')
    expect(SCENARIO_PLANNER_DISCLOSURE).toContain('buy/sell instruction')
    expect(scenario.disclosure).toBe(SCENARIO_PLANNER_DISCLOSURE)
    expect(`${scenario.disclosure} ${scenario.stopLimit.note}`).not.toMatch(
      /\bshould\s+(buy|sell)\b/i,
    )
  })
})

function buildInput(
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
