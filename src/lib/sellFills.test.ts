import { describe, expect, it } from 'vitest'
import {
  buildBuyingPowerSummary,
  buildSellFillMetrics,
  buildSellFillPlanningExport,
  parseSellFillImportText,
  SELL_FILL_DISCLOSURE,
  type SellFillRecord,
} from './sellFills'

describe('sell fills and buying power', () => {
  it('counts only filled or reviewed sell records for realized P/L and buying power', () => {
    const records: SellFillRecord[] = [
      buildSellFill({ status: 'planned', symbol: 'NVDA' }),
      buildSellFill({ status: 'ordered', symbol: 'AAPL' }),
      buildSellFill({ status: 'canceled', symbol: 'AMD' }),
      buildSellFill({ status: 'filled', symbol: 'GOOG' }),
      buildSellFill({ status: 'reviewed', symbol: 'IREN', fillPrice: 12 }),
    ]

    const summary = buildBuyingPowerSummary({
      records,
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
    })

    expect(summary.filledSellCount).toBe(2)
    expect(summary.pendingSellCount).toBe(2)
    expect(summary.ignoredSellCount).toBe(1)
    expect(summary.filledSellProceeds).toBe(224)
    expect(summary.costBasisRemoved).toBe(200)
    expect(summary.realizedGainLoss).toBe(24)
    expect(summary.statusCounts).toMatchObject({
      planned: 1,
      ordered: 1,
      filled: 1,
      canceled: 1,
      reviewed: 1,
    })
  })

  it('calculates sell-fill cash raised, cost basis removed, reserve, pay-yourself, and reinvestable cash', () => {
    const metrics = buildSellFillMetrics(
      buildSellFill({
        sharesSold: 4,
        fillPrice: 150,
        averageCost: 100,
        fees: 2,
      }),
      {
        settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
        payYourselfRule: {
          enabled: true,
          percentOfNetAfterReserve: 5,
        },
      },
    )

    expect(metrics.cashRaised).toBe(598)
    expect(metrics.costBasisRemoved).toBe(400)
    expect(metrics.realizedGainLoss).toBe(198)
    expect(metrics.taxReserveEstimate).toBe(49.5)
    expect(metrics.payYourselfSetAside).toBeCloseTo(7.425)
    expect(metrics.reinvestableCash).toBeCloseTo(541.075)
    expect(metrics.costBasisSource).toBe('average_cost')
    expect(metrics.missingFields).toEqual([])
  })

  it('bases pay-yourself and remaining buying power on actual filled sells, starting cash, and marked reinvestments', () => {
    const summary = buildBuyingPowerSummary({
      records: [
        buildSellFill({
          status: 'filled',
          sharesSold: 4,
          fillPrice: 150,
          averageCost: 100,
          fees: 2,
        }),
        buildSellFill({
          status: 'ordered',
          sharesSold: 10,
          fillPrice: 500,
          averageCost: 100,
        }),
      ],
      startingCash: 100,
      manuallyReinvestedCash: 50,
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
      payYourselfRule: {
        enabled: true,
        percentOfNetAfterReserve: 5,
      },
    })

    expect(summary.filledSellProceeds).toBe(598)
    expect(summary.taxReserveSetAside).toBe(49.5)
    expect(summary.payYourselfSetAside).toBeCloseTo(7.425)
    expect(summary.manuallyReinvestedCash).toBe(50)
    expect(summary.remainingCashAvailable).toBeCloseTo(591.075)
  })

  it('keeps missing filled-sell inputs visible instead of guessing realized P/L', () => {
    const metrics = buildSellFillMetrics(
      buildSellFill({
        fillPrice: null,
        averageCost: null,
        costBasis: null,
        filledDate: '',
      }),
    )

    expect(metrics.countsForBuyingPower).toBe(true)
    expect(metrics.cashRaised).toBe(0)
    expect(metrics.realizedGainLoss).toBe(0)
    expect(metrics.missingFields).toEqual([
      'fill price',
      'filled date',
      'average cost or cost basis',
    ])
  })

  it('imports local CSV and JSON sell records without broker integration', () => {
    const csv = [
      'symbol,status,shares sold,fill price,average cost,filled date,fees,source,reference,notes',
      'nvda,filled,4,150,100,2026-05-08,2,manual,row-1,"trim filled"',
    ].join('\n')
    const json = JSON.stringify({
      records: [
        {
          symbol: 'aapl',
          status: 'reviewed',
          sharesSold: 2,
          fillPrice: 210,
          costBasis: 300,
          filledDate: '2026-05-08',
          fees: 1,
          reference: 'ticket-7',
        },
      ],
    })

    const csvImport = parseSellFillImportText(
      csv,
      '2026-05-08T12:00:00.000Z',
    )
    const jsonImport = parseSellFillImportText(
      json,
      '2026-05-08T12:00:00.000Z',
    )

    expect(csvImport.errors).toEqual([])
    expect(csvImport.records[0]).toMatchObject({
      symbol: 'NVDA',
      status: 'filled',
      sharesSold: 4,
      fillPrice: 150,
      averageCost: 100,
      source: 'manual',
      reference: 'row-1',
    })
    expect(jsonImport.errors).toEqual([])
    expect(jsonImport.records[0]).toMatchObject({
      symbol: 'AAPL',
      status: 'reviewed',
      costBasis: 300,
      reference: 'ticket-7',
    })
  })

  it('exports sell-fill and buying-power data as planning JSON with guardrails', () => {
    const records = [
      buildSellFill({
        symbol: 'NVDA',
        sharesSold: 4,
        fillPrice: 150,
        averageCost: 100,
      }),
    ]
    const buyingPower = buildBuyingPowerSummary({
      records,
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
    })
    const exported = buildSellFillPlanningExport({
      records,
      buyingPower,
      generatedAt: '2026-05-08T12:00:00.000Z',
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
    })

    expect(exported.schemaVersion).toBe('sell-fill-buying-power-v1')
    expect(exported.buyingPower.remainingCashAvailable).toBe(542.5)
    expect(exported.sellFills[0].metrics.realizedGainLoss).toBe(200)
    expect(exported.guardrails.join(' ')).toContain('Manual sell-fill')
    expect(exported.guardrails.join(' ')).toContain('Not a filing document')
  })

  it('keeps copy manual, non-automated, and non-tax-advice', () => {
    expect(SELL_FILL_DISCLOSURE).toContain('Manual sell-fill planning')
    expect(SELL_FILL_DISCLOSURE).toContain('No broker credentials')
    expect(SELL_FILL_DISCLOSURE).toContain('no automated trading')
    expect(SELL_FILL_DISCLOSURE).toContain('not tax advice')
    expect(SELL_FILL_DISCLOSURE).not.toMatch(/\bshould\s+(buy|sell)\b/i)
    expect(SELL_FILL_DISCLOSURE).not.toMatch(/order execution enabled/i)
  })
})

function buildSellFill(
  overrides: Partial<SellFillRecord> = {},
): SellFillRecord {
  return {
    id: overrides.id ?? `${overrides.symbol ?? 'NVDA'}-fill`,
    status: overrides.status ?? 'filled',
    symbol: overrides.symbol ?? 'NVDA',
    sharesSold: hasOverride(overrides, 'sharesSold') ? overrides.sharesSold! : 2,
    fillPrice: hasOverride(overrides, 'fillPrice') ? overrides.fillPrice! : 100,
    averageCost: hasOverride(overrides, 'averageCost')
      ? overrides.averageCost!
      : 50,
    costBasis: hasOverride(overrides, 'costBasis') ? overrides.costBasis! : null,
    filledDate: overrides.filledDate ?? '2026-05-08',
    fees: overrides.fees ?? 0,
    source: overrides.source ?? 'manual',
    reference: overrides.reference ?? '',
    notes: overrides.notes ?? '',
  }
}

function hasOverride(
  overrides: Partial<SellFillRecord>,
  key: keyof SellFillRecord,
): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, key)
}
