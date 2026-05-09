import { describe, expect, it } from 'vitest'
import { buildBuyingPowerSummary } from './sellFills'
import {
  buildSellFillsFromAcceptedRobinhoodRows,
  parseRobinhoodCsvFile,
  updateRobinhoodRowReviewState,
} from './robinhoodCsv'

const IMPORTED_AT = '2026-05-08T12:00:00.000Z'

describe('Robinhood account activity sells without basis', () => {
  it('keeps accepted rows as proceeds until basis is present', () => {
    const rows = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      text: [
        'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/02/2026,05/02/2026,05/05/2026,NVDA,NVIDIA sell,Sell,4,$300.00,"$1,200.00"',
      ].join('\n'),
    }).rows
    const acceptedRows = updateRobinhoodRowReviewState(
      rows,
      rows[0].id,
      'accepted',
    )
    const summary = buildBuyingPowerSummary({
      records: buildSellFillsFromAcceptedRobinhoodRows(acceptedRows),
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
      payYourselfRule: {
        enabled: true,
        percentOfNetAfterReserve: 5,
      },
    })

    expect(summary.filledSellProceeds).toBe(1200)
    expect(summary.realizedGainLoss).toBe(0)
    expect(summary.taxReserveSetAside).toBe(0)
    expect(summary.payYourselfSetAside).toBe(0)
    expect(summary.remainingCashAvailable).toBe(1200)
    expect(summary.missingInputCount).toBe(1)
  })
})
