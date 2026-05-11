import { describe, expect, it } from 'vitest'
import type { SeedHolding } from '../data/seedHoldings'
import { buildBuyingPowerSummary } from './sellFills'
import {
  buildSellFillsFromAcceptedRobinhoodRows,
  parseRobinhoodCsvFile,
  updateRobinhoodRowReviewState,
  type RobinhoodNormalizedRow,
} from './robinhoodCsv'
import {
  applyRobinhoodDerivedHolding,
  deriveRobinhoodHoldings,
} from './robinhoodHoldingsSync'

const IMPORTED_AT = '2026-05-11T12:00:00.000Z'

describe('Robinhood holdings sync', () => {
  it('projects buy/sell ledger rows into current net shares and remaining basis', () => {
    const account = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/01/2026,NVDA,NVIDIA buy,Buy,10,$10.00,"($100.00)"',
        '05/02/2026,NVDA,NVIDIA buy,Buy,2,$20.00,"($40.00)"',
        '05/03/2026,NVDA,NVIDIA sell,Sell,4,$30.00,$120.00',
      ].join('\n'),
    })
    const realized = parseRobinhoodCsvFile({
      fileName: 'realized-gain-loss.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'realized_gain_loss',
      text: [
        'Symbol,Date Sold,Quantity,Proceeds,Cost Basis,Realized Gain/Loss,Term',
        'NVDA,05/03/2026,4,$120.00,$40.00,$80.00,Short Term',
      ].join('\n'),
    })
    const rows = acceptRows([...account.rows, ...realized.rows])
    const holdings = deriveRobinhoodHoldings({
      imports: [account.batch, realized.batch].flatMap((batch) =>
        batch ? [batch] : [],
      ),
      rows,
    })

    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      averageCost: 12.5,
      buyQuantity: 12,
      costBasis: 100,
      sellQuantity: 4,
      shares: 8,
      source: 'account_activity_ledger',
      status: 'ready',
      symbol: 'NVDA',
    })
  })

  it('keeps basis missing when ledger rows do not provide enough basis data', () => {
    const account = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/01/2026,AMD,AMD buy,Buy,10,,',
      ].join('\n'),
    })
    const holdings = deriveRobinhoodHoldings({
      imports: account.batch ? [account.batch] : [],
      rows: acceptRows(account.rows),
    })

    expect(holdings[0]).toMatchObject({
      averageCost: null,
      costBasis: null,
      shares: 10,
      status: 'missing_basis',
      symbol: 'AMD',
    })
    expect(holdings[0].notes.join(' ')).toContain('basis is missing')
  })

  it('uses accepted positions CSV rows ahead of ledger projections for the same symbol', () => {
    const account = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/01/2026,AAPL,Apple buy,Buy,1,$100.00,"($100.00)"',
      ].join('\n'),
    })
    const positions = parseRobinhoodCsvFile({
      fileName: 'current-positions.csv',
      importedAt: '2026-05-12T12:00:00.000Z',
      reportKind: 'current_positions',
      text: [
        'Symbol,Name,Shares,Average Cost,Cost Basis',
        'AAPL,Apple Inc,3,$150.00,$450.00',
      ].join('\n'),
    })
    const holdings = deriveRobinhoodHoldings({
      imports: [account.batch, positions.batch].flatMap((batch) =>
        batch ? [batch] : [],
      ),
      rows: acceptRows([...account.rows, ...positions.rows]),
    })

    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      averageCost: 150,
      costBasis: 450,
      shares: 3,
      source: 'current_positions_csv',
      symbol: 'AAPL',
    })
  })

  it('applies a reviewed derived holding to holdings and manual lots', () => {
    const holding = deriveRobinhoodHoldings({
      imports: [],
      rows: acceptRows(
        parseRobinhoodCsvFile({
          fileName: 'current-positions.csv',
          importedAt: IMPORTED_AT,
          reportKind: 'current_positions',
          text: [
            'Symbol,Name,Shares,Average Cost,Cost Basis',
            'NVDA,NVIDIA Corp,6,$125.50,$753.00',
          ].join('\n'),
        }).rows,
      ),
    })[0]
    const currentHoldings: SeedHolding[] = []
    const applied = applyRobinhoodDerivedHolding({
      holdings: currentHoldings,
      manualLots: {},
      holding,
    })

    expect(applied.holdings[0]).toMatchObject({
      name: 'NVIDIA Corp',
      symbol: 'NVDA',
    })
    expect(applied.manualLots.NVDA).toEqual({
      shares: '6',
      averageCost: '125.5',
    })
  })

  it('keeps rejected rows out of holdings, buying power, and realized P/L', () => {
    const parsed = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/01/2026,AMD,AMD buy,Buy,10,$10.00,"($100.00)"',
        '05/02/2026,NVDA,NVIDIA sell,Sell,2,$25.00,$50.00',
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
    const holdings = deriveRobinhoodHoldings({
      imports: parsed.batch ? [parsed.batch] : [],
      rows: reviewedRows,
    })
    const buyingPower = buildBuyingPowerSummary({
      records: buildSellFillsFromAcceptedRobinhoodRows(reviewedRows),
    })

    expect(holdings.map((holding) => holding.symbol)).toEqual(['AMD'])
    expect(buyingPower.filledSellProceeds).toBe(0)
    expect(buyingPower.realizedGainLoss).toBe(0)
  })
})

function acceptRows(
  rows: readonly RobinhoodNormalizedRow[],
): RobinhoodNormalizedRow[] {
  return rows.map((row) => ({ ...row, reviewState: 'accepted' }))
}
