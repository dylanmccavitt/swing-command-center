import { describe, expect, it } from 'vitest'
import { buildBuyingPowerSummary } from './sellFills'
import {
  buildRobinhoodTaxPlanningBuckets,
  buildSellFillsFromAcceptedRobinhoodRows,
  parseRobinhoodCsvFile,
  updateRobinhoodRowReviewState,
} from './robinhoodCsv'

const IMPORTED_AT = '2026-05-11T12:00:00.000Z'

describe('Robinhood CSV variant hardening', () => {
  it('accepts account-activity header aliases with multiline quoted descriptions', () => {
    const result = parseRobinhoodCsvFile({
      fileName: 'account-activity-variant.csv',
      importedAt: IMPORTED_AT,
      text: [
        '"Trade Date","Settlement Date","Ticker","Security Description","Transaction Type","Shares","Average Price","Net Cash Amount"',
        '"05/08/2026","05/11/2026","CHIP","Chip Company',
        'CUSIP: 000000002","Sell","3","$216.00","$647.98"',
      ].join('\n'),
    })

    expect(result.errors).toEqual([])
    expect(result.batch).toMatchObject({
      reportKind: 'account_activity',
      rowCount: 1,
    })
    expect(result.rows[0]).toMatchObject({
      activityType: 'Sell',
      description: 'Chip Company\nCUSIP: 000000002',
      kind: 'sell',
      price: 216,
      proceeds: 647.98,
      quantity: 3,
      reconciliationStatus: 'missing_basis',
      symbol: 'CHIP',
      tradeDate: '2026-05-08',
      settleDate: '2026-05-11',
    })
  })

  it('infers realized gain/loss variants from sale proceeds, adjusted basis, and disallowed loss headers', () => {
    const result = parseRobinhoodCsvFile({
      fileName: 'realized-gain-loss-variant.csv',
      importedAt: IMPORTED_AT,
      text: [
        'Ticker,Name,Disposed Date,Quantity Sold,Sale Proceeds,Adjusted Basis,Realized Gain/Loss ($),Holding Period,Disallowed Loss',
        'NVDA,NVIDIA Corp,05/02/2026,4,"$1,200.00","$1,000.00",$200.00,Short Term,$0.00',
        'AMD,Advanced Micro Devices,05/03/2026,5,$500.00,$600.00,"($100.00)",Short Term,$25.00',
      ].join('\n'),
    })

    expect(result.errors).toEqual([])
    expect(result.batch?.reportKind).toBe('realized_gain_loss')
    expect(result.rows[0]).toMatchObject({
      costBasis: 1000,
      holdingPeriod: 'short_term',
      kind: 'sell',
      proceeds: 1200,
      quantity: 4,
      realizedGainLoss: 200,
      reconciliationStatus: 'matched',
      symbol: 'NVDA',
      tradeDate: '2026-05-02',
    })
    expect(result.rows[1]).toMatchObject({
      realizedGainLoss: -100,
      reconciliationStatus: 'possible_wash_sale',
      washSaleLossDisallowed: 25,
    })
  })

  it('keeps rejected rows and pending rows out while accepted missing-basis sells count as proceeds only', () => {
    const parsed = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/02/2026,NVDA,NVIDIA sell,Sell,4,$300.00,"$1,200.00"',
        '05/03/2026,AMD,AMD sell,Sell,5,$100.00,$500.00',
      ].join('\n'),
    })
    const acceptedFirst = updateRobinhoodRowReviewState(
      parsed.rows,
      parsed.rows[0].id,
      'accepted',
    )
    const reviewedRows = updateRobinhoodRowReviewState(
      acceptedFirst,
      parsed.rows[1].id,
      'rejected',
    )
    const records = buildSellFillsFromAcceptedRobinhoodRows(reviewedRows)
    const buyingPower = buildBuyingPowerSummary({
      records,
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
      payYourselfRule: {
        enabled: true,
        percentOfNetAfterReserve: 5,
      },
    })
    const buckets = buildRobinhoodTaxPlanningBuckets({
      rows: reviewedRows,
      buyingPower,
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
      payYourselfRule: {
        enabled: true,
        percentOfNetAfterReserve: 5,
      },
    })

    expect(records).toHaveLength(1)
    expect(buyingPower.filledSellProceeds).toBe(1200)
    expect(buyingPower.realizedGainLoss).toBe(0)
    expect(buyingPower.taxReserveSetAside).toBe(0)
    expect(buyingPower.payYourselfSetAside).toBe(0)
    expect(buyingPower.remainingCashAvailable).toBe(1200)
    expect(buyingPower.missingInputCount).toBe(1)
    expect(buckets.acceptedSellCount).toBe(1)
    expect(buckets.shortTermGainLoss).toBe(0)
    expect(buckets.reserveEstimate).toBe(0)
    expect(buckets.payYourselfSetAside).toBe(0)
  })

  it('prefers accepted realized gain/loss rows over matching accepted account-activity proceeds', () => {
    const accountRows = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/02/2026,NVDA,NVIDIA sell,Sell,4,$300.00,"$1,200.00"',
      ].join('\n'),
    }).rows
    const realizedRows = parseRobinhoodCsvFile({
      fileName: 'realized-gain-loss.csv',
      importedAt: IMPORTED_AT,
      text: [
        'Symbol,Date Sold,Quantity,Proceeds,Cost Basis,Realized Gain/Loss,Term',
        'NVDA,05/02/2026,4,"$1,200.00","$1,000.00",$200.00,Short Term',
      ].join('\n'),
    }).rows
    const acceptedRows = [...accountRows, ...realizedRows].map((row) => ({
      ...row,
      reviewState: 'accepted' as const,
    }))
    const buyingPower = buildBuyingPowerSummary({
      records: buildSellFillsFromAcceptedRobinhoodRows(acceptedRows),
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
      payYourselfRule: {
        enabled: true,
        percentOfNetAfterReserve: 5,
      },
    })

    expect(buyingPower.filledSellCount).toBe(1)
    expect(buyingPower.filledSellProceeds).toBe(1200)
    expect(buyingPower.costBasisRemoved).toBe(1000)
    expect(buyingPower.realizedGainLoss).toBe(200)
    expect(buyingPower.taxReserveSetAside).toBe(50)
    expect(buyingPower.payYourselfSetAside).toBe(7.5)
  })
})
