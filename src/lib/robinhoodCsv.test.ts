import { describe, expect, it } from 'vitest'
import { buildBuyingPowerSummary } from './sellFills'
import {
  buildRobinhoodPlanningExport,
  buildRobinhoodTaxPlanningBuckets,
  buildSellFillsFromAcceptedRobinhoodRows,
  mergeRobinhoodCsvImportResult,
  parseRobinhoodCsvFile,
  ROBINHOOD_CSV_DISCLOSURE,
  updateRobinhoodRowReviewState,
  type RobinhoodNormalizedRow,
} from './robinhoodCsv'

const IMPORTED_AT = '2026-05-08T12:00:00.000Z'

describe('Robinhood CSV import and reconciliation', () => {
  it('parses account activity CSV rows into normalized local row kinds', () => {
    const csv = [
      'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
      '05/01/2026,05/01/2026,05/04/2026,AAPL,Apple buy,Buy,2,$100.00,"($200.00)"',
      '05/02/2026,05/02/2026,05/05/2026,NVDA,NVIDIA sell,Sell,4,$300.00,"$1,200.00"',
      '05/03/2026,05/03/2026,05/03/2026,AAPL,Cash dividend,Dividend,,$0.00,$12.40',
      '05/04/2026,05/04/2026,05/04/2026,,ACH Deposit,Transfer,,$0.00,$500.00',
      '05/05/2026,05/05/2026,05/05/2026,TSM,ADR Fee,Fee,,$0.00,"($1.50)"',
      '05/06/2026,05/06/2026,05/06/2026,ABC,Stock lending income,Other,,$0.00,$0.12',
    ].join('\n')

    const result = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      text: csv,
    })

    expect(result.errors).toEqual([])
    expect(result.batch).toMatchObject({
      fileName: 'account-activity.csv',
      reportKind: 'account_activity',
      rowCount: 6,
      source: 'robinhood_csv_file',
    })
    expect(result.rows.map((row) => row.kind)).toEqual([
      'buy',
      'sell',
      'dividend',
      'transfer',
      'fee',
      'unknown',
    ])
    expect(result.rows[1]).toMatchObject({
      symbol: 'NVDA',
      quantity: 4,
      proceeds: 1200,
      reconciliationStatus: 'missing_basis',
      reviewState: 'needs_review',
      tradeDate: '2026-05-02',
    })
  })

  it('keeps quoted CUSIP line breaks inside Robinhood account rows', () => {
    const csv = [
      '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
      '"05/08/2026","05/08/2026","05/11/2026","TEST","Test Company',
      'CUSIP: 000000001","Buy","25","$27.34","($683.50)"',
      '"05/08/2026","05/08/2026","05/11/2026","CHIP","Chip Company',
      'CUSIP: 000000002","Sell","3","$216.00","$647.98"',
    ].join('\n')

    const result = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      text: csv,
      reportKind: 'account_activity',
    })

    expect(result.errors).toEqual([])
    expect(result.batch).toMatchObject({ rowCount: 2 })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      description: 'Test Company\nCUSIP: 000000001',
      kind: 'buy',
      quantity: 25,
      symbol: 'TEST',
    })
    expect(result.rows[1]).toMatchObject({
      description: 'Chip Company\nCUSIP: 000000002',
      kind: 'sell',
      proceeds: 647.98,
      symbol: 'CHIP',
    })
  })

  it('skips Robinhood account CSV footer disclaimers instead of importing blank unsupported rows', () => {
    const result = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
        '"05/08/2026","05/08/2026","05/11/2026","HIMS","Hims & Hers Health',
        'CUSIP: 433000106","Buy","25","$27.34","($683.50)"',
        '""',
        '"","","","","","","","","","The data provided is for informational purposes only. Please consult a professional tax service."',
      ].join('\n'),
    })

    expect(result.errors).toEqual([])
    expect(result.batch).toMatchObject({ rowCount: 1 })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      amount: -683.5,
      kind: 'buy',
      price: 27.34,
      quantity: 25,
      symbol: 'HIMS',
    })
  })

  it('captures Robinhood corporate-action share rows without inventing basis', () => {
    const result = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        '"Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"',
        '"11/12/2018","11/12/2018","11/12/2018","AAPL","Apple',
        'CUSIP: 037833100","CONV","4","",""',
        '"8/31/2020","8/31/2020","8/31/2020","AAPL","Apple',
        'CUSIP: 037833100","SPL","15","",""',
        '"6/22/2020","6/22/2020","6/22/2020","HLX","Helix Energy',
        'CUSIP: 42330P107","REC","1","",""',
        '"5/5/2022","5/5/2022","5/5/2022","DKNG","Draftkings',
        'CUSIP: 26142R104","SXCH","10.0181S","",""',
        '"11/12/2018","11/12/2018","11/12/2018","","Apex to RHS Conversion","CONV","","","$0.07"',
      ].join('\n'),
    })

    expect(result.errors).toEqual([])
    expect(result.rows.map((row) => row.kind)).toEqual([
      'position',
      'position',
      'position',
      'corporate_action',
      'transfer',
    ])
    expect(result.rows[0]).toMatchObject({
      quantity: 4,
      reconciliationStatus: 'missing_basis',
      symbol: 'AAPL',
    })
    expect(result.rows[1]).toMatchObject({
      quantity: 15,
      reconciliationStatus: 'missing_basis',
      symbol: 'AAPL',
    })
    expect(result.rows[2]).toMatchObject({
      quantity: 1,
      reconciliationStatus: 'missing_basis',
      symbol: 'HLX',
    })
    expect(result.rows[3]).toMatchObject({
      quantity: 10.0181,
      reconciliationStatus: 'needs_review',
      symbol: 'DKNG',
    })
    expect(result.rows[4]).toMatchObject({
      amount: 0.07,
      kind: 'transfer',
      symbol: '',
    })
  })

  it('parses realized gain/loss CSV rows with basis, P/L, term, and wash-sale fields', () => {
    const csv = [
      'Symbol,Date Acquired,Date Sold,Quantity,Proceeds,Cost Basis,Realized Gain/Loss,Term,Wash Sale Loss Disallowed',
      'NVDA,01/02/2026,05/02/2026,4,"$1,200.00","$1,000.00",$200.00,Short Term,$0.00',
      'AMD,01/10/2026,05/03/2026,5,$500.00,$600.00,"($100.00)",Short Term,$25.00',
    ].join('\n')

    const result = parseRobinhoodCsvFile({
      fileName: 'realized-gain-loss.csv',
      importedAt: IMPORTED_AT,
      text: csv,
    })

    expect(result.errors).toEqual([])
    expect(result.batch?.reportKind).toBe('realized_gain_loss')
    expect(result.rows[0]).toMatchObject({
      kind: 'sell',
      symbol: 'NVDA',
      quantity: 4,
      proceeds: 1200,
      costBasis: 1000,
      realizedGainLoss: 200,
      holdingPeriod: 'short_term',
      reconciliationStatus: 'matched',
    })
    expect(result.rows[1]).toMatchObject({
      symbol: 'AMD',
      realizedGainLoss: -100,
      washSaleLossDisallowed: 25,
      reconciliationStatus: 'possible_wash_sale',
    })
  })

  it('parses current positions CSV rows with shares, average cost, and cost basis', () => {
    const result = parseRobinhoodCsvFile({
      fileName: 'current-positions.csv',
      importedAt: IMPORTED_AT,
      text: [
        'Symbol,Name,Shares,Average Cost,Cost Basis',
        'NVDA,NVIDIA Corp,6,$125.50,$753.00',
        'AAPL,Apple Inc,2,$180.00,$360.00',
      ].join('\n'),
    })

    expect(result.errors).toEqual([])
    expect(result.batch?.reportKind).toBe('current_positions')
    expect(result.rows[0]).toMatchObject({
      averageCost: 125.5,
      costBasis: 753,
      kind: 'position',
      quantity: 6,
      reconciliationStatus: 'matched',
      symbol: 'NVDA',
    })
    expect(result.rows[0].fingerprint).toBeTruthy()
    expect(result.rows[0].id).toContain(result.rows[0].fingerprint)
  })

  it('dedupes older rows when a newer full-history account CSV is re-imported', () => {
    const firstImport = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: IMPORTED_AT,
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/01/2026,AAPL,Apple buy,Buy,2,$100.00,"($200.00)"',
        '05/02/2026,NVDA,NVIDIA sell,Sell,4,$300.00,"$1,200.00"',
      ].join('\n'),
    })
    const reviewedRows = updateRobinhoodRowReviewState(
      firstImport.rows,
      firstImport.rows[0].id,
      'accepted',
    )
    const secondImport = parseRobinhoodCsvFile({
      fileName: 'account-activity.csv',
      importedAt: '2026-05-09T12:00:00.000Z',
      reportKind: 'account_activity',
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/03/2026,AMD,AMD buy,Buy,1,$110.00,"($110.00)"',
        '05/01/2026,AAPL,Apple buy,Buy,2,$100.00,"($200.00)"',
        '05/02/2026,NVDA,NVIDIA sell,Sell,4,$300.00,"$1,200.00"',
      ].join('\n'),
    })
    const merged = mergeRobinhoodCsvImportResult({
      currentImports: firstImport.batch ? [firstImport.batch] : [],
      currentRows: reviewedRows,
      result: secondImport,
    })

    expect(secondImport.rows[1].fingerprint).toBe(firstImport.rows[0].fingerprint)
    expect(merged.addedRows).toHaveLength(1)
    expect(merged.duplicateRows).toHaveLength(2)
    expect(merged.rows).toHaveLength(3)
    expect(
      merged.rows.find((row) => row.symbol === 'AAPL')?.reviewState,
    ).toBe('accepted')
  })

  it('maps only accepted imported sells into the sell-fill model and prefers realized gain/loss rows', () => {
    const accountRows = parseAccountRows()
    const realizedRows = parseRealizedRows()
    const rows = acceptRows([...accountRows, ...realizedRows], [
      accountRows[1].id,
      realizedRows[0].id,
    ])

    const sellFills = buildSellFillsFromAcceptedRobinhoodRows(rows)

    expect(sellFills).toHaveLength(1)
    expect(sellFills[0]).toMatchObject({
      id: `robinhood-${realizedRows[0].id}`,
      status: 'reviewed',
      symbol: 'NVDA',
      sharesSold: 4,
      fillPrice: 300,
      costBasis: 1000,
      source: 'Robinhood realized gain/loss CSV',
      reference: realizedRows[0].id,
    })
  })

  it('keeps imported rows out of buying-power math until they are accepted', () => {
    const realizedRows = parseRealizedRows()

    const beforeAccept = buildBuyingPowerSummary({
      records: buildSellFillsFromAcceptedRobinhoodRows(realizedRows),
    })
    const acceptedRows = updateRobinhoodRowReviewState(
      realizedRows,
      realizedRows[0].id,
      'accepted',
    )
    const afterAccept = buildBuyingPowerSummary({
      records: buildSellFillsFromAcceptedRobinhoodRows(acceptedRows),
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
      payYourselfRule: {
        enabled: true,
        percentOfNetAfterReserve: 5,
      },
    })

    expect(beforeAccept.filledSellProceeds).toBe(0)
    expect(beforeAccept.remainingCashAvailable).toBe(0)
    expect(afterAccept.filledSellProceeds).toBe(1200)
    expect(afterAccept.costBasisRemoved).toBe(1000)
    expect(afterAccept.realizedGainLoss).toBe(200)
    expect(afterAccept.remainingCashAvailable).toBeCloseTo(1142.5)
  })

  it('assigns reconciliation statuses for missing basis, missing proceeds, wash sales, and unsupported rows', () => {
    const accountRows = parseAccountRows()
    const missingProceeds = parseRobinhoodCsvFile({
      fileName: 'missing-proceeds.csv',
      importedAt: IMPORTED_AT,
      text: [
        'Activity Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
        '05/07/2026,MSFT,Microsoft sell,Sell,2,,',
      ].join('\n'),
    }).rows[0]
    const realizedRows = parseRealizedRows()

    expect(accountRows[1].reconciliationStatus).toBe('missing_basis')
    expect(missingProceeds.reconciliationStatus).toBe('missing_proceeds')
    expect(realizedRows[1].reconciliationStatus).toBe('possible_wash_sale')
    expect(accountRows[5].reconciliationStatus).toBe('unsupported_row')
  })

  it('builds accepted tax-planning buckets from realized rows, dividends, and buying power', () => {
    const rows = acceptRows([...parseAccountRows(), ...parseRealizedRows()], [
      parseAccountRows()[2].id,
      parseRealizedRows()[0].id,
      parseRealizedRows()[1].id,
    ])
    const sellFills = buildSellFillsFromAcceptedRobinhoodRows(rows)
    const buyingPower = buildBuyingPowerSummary({
      records: sellFills,
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
    })
    const buckets = buildRobinhoodTaxPlanningBuckets({
      rows,
      buyingPower,
      settings: { taxReserveEnabled: true, taxReserveRatePercent: 25 },
    })

    expect(buckets.shortTermGainLoss).toBe(100)
    expect(buckets.longTermGainLoss).toBe(0)
    expect(buckets.washSaleDisallowedLosses).toBe(25)
    expect(buckets.dividendsAndInterest).toBe(12.4)
    expect(buckets.reserveEstimate).toBe(50)
    expect(buckets.remainingReinvestableCash).toBe(1642.5)
    expect(buckets.acceptedSellCount).toBe(2)
    expect(buckets.acceptedIncomeCount).toBe(1)
  })

  it('exports import metadata, normalized rows, reconciliation decisions, buying power, and tax buckets with guardrails', () => {
    const rows = acceptRows(parseRealizedRows(), [parseRealizedRows()[0].id])
    const sellFills = buildSellFillsFromAcceptedRobinhoodRows(rows)
    const buyingPower = buildBuyingPowerSummary({ records: sellFills })
    const taxPlanning = buildRobinhoodTaxPlanningBuckets({
      rows,
      buyingPower,
    })
    const exported = buildRobinhoodPlanningExport({
      imports: [parseRealizedBatch()],
      rows,
      buyingPower,
      taxPlanning,
      generatedAt: IMPORTED_AT,
    })

    expect(exported.schemaVersion).toBe('robinhood-csv-planning-v1')
    expect(exported.imports[0]).toMatchObject({
      reportKind: 'realized_gain_loss',
      source: 'robinhood_csv_file',
    })
    expect(exported.normalizedRows).toHaveLength(2)
    expect(exported.reconciliationDecisions[0]).toMatchObject({
      reviewState: 'accepted',
      reconciliationStatus: 'matched',
      sellFillId: `robinhood-${rows[0].id}`,
    })
    expect(exported.buyingPower.filledSellProceeds).toBe(1200)
    expect(exported.taxPlanning.shortTermGainLoss).toBe(200)
    expect(exported.guardrails.join(' ')).toContain('File import only')
    expect(exported.guardrails.join(' ')).toContain('not tax advice')
    expect(ROBINHOOD_CSV_DISCLOSURE).toContain('does not log in')
    expect(ROBINHOOD_CSV_DISCLOSURE).toContain('does not')
    expect(ROBINHOOD_CSV_DISCLOSURE).toContain('execute orders')
    expect(ROBINHOOD_CSV_DISCLOSURE).toContain('automate trading')
    expect(ROBINHOOD_CSV_DISCLOSURE).toContain('provide tax advice')
  })
})

function parseAccountRows(): RobinhoodNormalizedRow[] {
  return parseRobinhoodCsvFile({
    fileName: 'account-activity.csv',
    importedAt: IMPORTED_AT,
    text: [
      'Activity Date,Process Date,Settle Date,Instrument,Description,Trans Code,Quantity,Price,Amount',
      '05/01/2026,05/01/2026,05/04/2026,AAPL,Apple buy,Buy,2,$100.00,"($200.00)"',
      '05/02/2026,05/02/2026,05/05/2026,NVDA,NVIDIA sell,Sell,4,$300.00,"$1,200.00"',
      '05/03/2026,05/03/2026,05/03/2026,AAPL,Cash dividend,Dividend,,$0.00,$12.40',
      '05/04/2026,05/04/2026,05/04/2026,,ACH Deposit,Transfer,,$0.00,$500.00',
      '05/05/2026,05/05/2026,05/05/2026,TSM,ADR Fee,Fee,,$0.00,"($1.50)"',
      '05/06/2026,05/06/2026,05/06/2026,ABC,Stock lending income,Other,,$0.00,$0.12',
    ].join('\n'),
  }).rows
}

function parseRealizedRows(): RobinhoodNormalizedRow[] {
  return parseRobinhoodCsvFile({
    fileName: 'realized-gain-loss.csv',
    importedAt: IMPORTED_AT,
    text: [
      'Symbol,Date Acquired,Date Sold,Quantity,Proceeds,Cost Basis,Realized Gain/Loss,Term,Wash Sale Loss Disallowed',
      'NVDA,01/02/2026,05/02/2026,4,"$1,200.00","$1,000.00",$200.00,Short Term,$0.00',
      'AMD,01/10/2026,05/03/2026,5,$500.00,$600.00,"($100.00)",Short Term,$25.00',
    ].join('\n'),
  }).rows
}

function parseRealizedBatch() {
  const batch = parseRobinhoodCsvFile({
    fileName: 'realized-gain-loss.csv',
    importedAt: IMPORTED_AT,
    text: [
      'Symbol,Date Acquired,Date Sold,Quantity,Proceeds,Cost Basis,Realized Gain/Loss,Term,Wash Sale Loss Disallowed',
      'NVDA,01/02/2026,05/02/2026,4,"$1,200.00","$1,000.00",$200.00,Short Term,$0.00',
      'AMD,01/10/2026,05/03/2026,5,$500.00,$600.00,"($100.00)",Short Term,$25.00',
    ].join('\n'),
  }).batch

  if (!batch) {
    throw new Error('Expected realized batch')
  }

  return batch
}

function acceptRows(
  rows: readonly RobinhoodNormalizedRow[],
  rowIds: readonly string[],
): RobinhoodNormalizedRow[] {
  const acceptedIds = new Set(rowIds)

  return rows.map((row) =>
    acceptedIds.has(row.id) ? { ...row, reviewState: 'accepted' } : row,
  )
}
