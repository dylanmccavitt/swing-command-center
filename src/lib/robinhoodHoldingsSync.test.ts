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
  buildRobinhoodHoldingsReviewEntry,
  deriveRobinhoodHoldings,
  syncAcceptedRobinhoodHoldingsToPortfolio,
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

  it('uses accepted account corporate-action position quantities without inventing basis', () => {
    const account = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
        '"11/12/2018","11/12/2018","11/12/2018","AAPL","Apple',
        'CUSIP: 037833100","CONV","4","",""',
        '"01/08/2019","01/08/2019","01/10/2019","AAPL","Apple',
        'CUSIP: 037833100","Buy","1","$150.17","($150.17)"',
        '"08/31/2020","08/31/2020","08/31/2020","AAPL","Apple',
        'CUSIP: 037833100","SPL","15","",""',
      ].join('\n'),
    })
    const holdings = deriveRobinhoodHoldings({
      imports: account.batch ? [account.batch] : [],
      rows: acceptRows(account.rows),
    })

    expect(holdings).toHaveLength(1)
    expect(holdings[0]).toMatchObject({
      averageCost: null,
      buyQuantity: 20,
      costBasis: null,
      shares: 20,
      status: 'missing_basis',
      symbol: 'AAPL',
    })
  })

  it('does not let account security-exchange rows change holdings shares', () => {
    const account = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
        '"05/05/2022","05/05/2022","05/05/2022","DKNG","DraftKings',
        'CUSIP: 26142V105","SXCH","10.0181","",""',
        '"05/05/2022","05/05/2022","05/05/2022","DKNG","Draftkings',
        'CUSIP: 26142R104","SXCH","10.0181S","",""',
      ].join('\n'),
    })
    const holdings = deriveRobinhoodHoldings({
      imports: account.batch ? [account.batch] : [],
      rows: acceptRows(account.rows),
    })

    expect(account.rows.map((row) => row.kind)).toEqual([
      'corporate_action',
      'corporate_action',
    ])
    expect(account.rows.map((row) => row.quantity)).toEqual([10.0181, 10.0181])
    expect(holdings).toEqual([])
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

  it('syncs an accepted CSV buy into holdings and manual lots in one state transition', () => {
    const parsed = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/08/2026,HIMS,Hims & Hers Health,Buy,25,$27.34,"($683.50)"',
      ].join('\n'),
    })
    const rows = updateRobinhoodRowReviewState(
      parsed.rows,
      parsed.rows[0].id,
      'accepted',
    )
    const synced = syncAcceptedRobinhoodHoldingsToPortfolio({
      holdings: [],
      holdingsReview: {},
      imports: parsed.batch ? [parsed.batch] : [],
      manualLots: {},
      rows,
      symbols: ['HIMS'],
      updatedAt: IMPORTED_AT,
    })

    expect(synced.appliedHoldings.map((holding) => holding.symbol)).toEqual([
      'HIMS',
    ])
    expect(synced.holdings[0]).toMatchObject({
      name: 'Hims & Hers Health',
      symbol: 'HIMS',
    })
    expect(synced.manualLots.HIMS).toEqual({
      shares: '25',
      averageCost: '27.34',
    })
    expect(synced.holdingsReview.HIMS).toMatchObject({
      decision: 'applied',
      shares: 25,
      averageCost: 27.34,
      appliedAt: IMPORTED_AT,
    })
  })

  it('syncs accepted shares while keeping missing basis explicit', () => {
    const parsed = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/01/2026,AMD,AMD buy,Buy,10,,',
      ].join('\n'),
    })
    const rows = updateRobinhoodRowReviewState(
      parsed.rows,
      parsed.rows[0].id,
      'accepted',
    )
    const synced = syncAcceptedRobinhoodHoldingsToPortfolio({
      holdings: [],
      holdingsReview: {},
      imports: parsed.batch ? [parsed.batch] : [],
      manualLots: {},
      rows,
      symbols: ['AMD'],
      updatedAt: IMPORTED_AT,
    })

    expect(synced.appliedHoldings[0]).toMatchObject({
      symbol: 'AMD',
      shares: 10,
      averageCost: null,
      status: 'missing_basis',
    })
    expect(synced.manualLots.AMD).toEqual({
      shares: '10',
      averageCost: '',
    })
    expect(synced.holdingsReview.AMD).toMatchObject({
      decision: 'applied',
      averageCost: null,
    })
  })

  it('does not sync rejected CSV rows into portfolio state', () => {
    const parsed = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/01/2026,AMD,AMD buy,Buy,10,$10.00,"($100.00)"',
      ].join('\n'),
    })
    const rows = updateRobinhoodRowReviewState(
      parsed.rows,
      parsed.rows[0].id,
      'rejected',
    )
    const synced = syncAcceptedRobinhoodHoldingsToPortfolio({
      holdings: [],
      holdingsReview: {},
      imports: parsed.batch ? [parsed.batch] : [],
      manualLots: {},
      rows,
      symbols: ['AMD'],
      updatedAt: IMPORTED_AT,
    })

    expect(synced.appliedHoldings).toEqual([])
    expect(synced.holdings).toEqual([])
    expect(synced.manualLots).toEqual({})
    expect(synced.holdingsReview).toEqual({})
  })

  it('does not re-apply an already applied derived holding fingerprint', () => {
    const parsed = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/08/2026,HIMS,Hims & Hers Health,Buy,25,$27.34,"($683.50)"',
      ].join('\n'),
    })
    const rows = acceptRows(parsed.rows)
    const holding = deriveRobinhoodHoldings({
      imports: parsed.batch ? [parsed.batch] : [],
      rows,
    })[0]
    const synced = syncAcceptedRobinhoodHoldingsToPortfolio({
      holdings: [],
      holdingsReview: {
        HIMS: buildRobinhoodHoldingsReviewEntry({
          appliedAt: IMPORTED_AT,
          decision: 'applied',
          holding,
          updatedAt: IMPORTED_AT,
        }),
      },
      imports: parsed.batch ? [parsed.batch] : [],
      manualLots: {},
      rows,
      updatedAt: IMPORTED_AT,
    })

    expect(synced.appliedHoldings).toEqual([])
    expect(synced.holdings).toEqual([])
    expect(synced.manualLots).toEqual({})
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
