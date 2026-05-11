import type { PortfolioSettings } from './portfolio'
import { estimateTaxReserve } from './profitLock'
import type { BuyingPowerSummary, SellFillRecord } from './sellFills'
import {
  DEFAULT_PAY_YOURSELF_RULE,
  estimatePayYourselfAmount,
  normalizePayYourselfRule,
  type PayYourselfRule,
} from './tradeJournal'

export const ROBINHOOD_CSV_DISCLOSURE =
  'Robinhood CSV import is file-only local planning. It does not log in to Robinhood, use credentials, scrape pages, call unofficial APIs, use the Robinhood Crypto Trading API, execute orders, automate trading, or provide tax advice or filing documents.'

export type RobinhoodCsvReportKind =
  | 'account_activity'
  | 'current_positions'
  | 'realized_gain_loss'

export type RobinhoodNormalizedKind =
  | 'buy'
  | 'sell'
  | 'position'
  | 'corporate_action'
  | 'dividend'
  | 'interest'
  | 'transfer'
  | 'fee'
  | 'unknown'

export type RobinhoodReconciliationStatus =
  | 'matched'
  | 'needs_review'
  | 'missing_basis'
  | 'missing_proceeds'
  | 'possible_wash_sale'
  | 'unsupported_row'

export type RobinhoodReviewState =
  | 'needs_review'
  | 'accepted'
  | 'rejected'

export type RobinhoodHoldingPeriod =
  | 'short_term'
  | 'long_term'
  | 'unknown'

export type RobinhoodImportBatch = {
  id: string
  fileName: string
  importedAt: string
  reportKind: RobinhoodCsvReportKind
  rowCount: number
  source: 'robinhood_csv_file'
}

export type RobinhoodNormalizedRow = {
  id: string
  fingerprint: string
  batchId: string
  reportKind: RobinhoodCsvReportKind
  sourceRowIndex: number
  kind: RobinhoodNormalizedKind
  symbol: string
  description: string
  activityType: string
  tradeDate: string
  settleDate: string
  quantity: number | null
  price: number | null
  averageCost: number | null
  amount: number | null
  proceeds: number | null
  costBasis: number | null
  realizedGainLoss: number | null
  holdingPeriod: RobinhoodHoldingPeriod
  washSaleLossDisallowed: number
  fees: number
  reconciliationStatus: RobinhoodReconciliationStatus
  reviewState: RobinhoodReviewState
  reconciliationNotes: string[]
  raw: Record<string, string>
}

export type RobinhoodCsvImportResult = {
  batch: RobinhoodImportBatch | null
  rows: RobinhoodNormalizedRow[]
  errors: string[]
}

export type RobinhoodCsvMergeResult = {
  imports: RobinhoodImportBatch[]
  rows: RobinhoodNormalizedRow[]
  addedRows: RobinhoodNormalizedRow[]
  duplicateRows: RobinhoodNormalizedRow[]
}

export type RobinhoodTaxPlanningBuckets = {
  shortTermGainLoss: number
  longTermGainLoss: number
  unknownTermGainLoss: number
  washSaleDisallowedLosses: number
  dividendsAndInterest: number
  reserveEstimate: number
  payYourselfSetAside: number
  remainingReinvestableCash: number
  acceptedSellCount: number
  acceptedIncomeCount: number
  disclosure: string
}

export type RobinhoodPlanningExport = {
  schemaVersion: 'robinhood-csv-planning-v1'
  generatedAt: string
  disclosure: string
  guardrails: string[]
  imports: RobinhoodImportBatch[]
  normalizedRows: RobinhoodNormalizedRow[]
  reconciliationDecisions: {
    rowId: string
    reviewState: RobinhoodReviewState
    reconciliationStatus: RobinhoodReconciliationStatus
    sellFillId: string | null
    notes: string[]
  }[]
  buyingPower: BuyingPowerSummary
  taxPlanning: RobinhoodTaxPlanningBuckets
}

type FieldGetter = (...keys: string[]) => string

const HEADER_ALIASES = {
  activityType: [
    'activity type',
    'trans code',
    'trans type',
    'transaction code',
    'transaction type',
    'type',
    'action',
    'activity',
  ],
  averageCost: [
    'average cost',
    'average cost/share',
    'average cost per share',
    'avg cost',
    'avg cost/share',
    'avg cost per share',
    'average price paid',
  ],
  amount: [
    'amount',
    'net amount',
    'net cash',
    'net cash amount',
    'cash amount',
    'cash value',
  ],
  costBasis: [
    'cost basis',
    'adjusted cost basis',
    'adjusted basis',
    'basis',
    'total cost',
  ],
  dateAcquired: ['date acquired', 'acquired date'],
  dateSold: ['date sold', 'sold date', 'disposed date', 'disposition date'],
  description: [
    'description',
    'details',
    'name',
    'security description',
    'security',
  ],
  fees: ['fees', 'fee', 'commission', 'regulatory fees'],
  holdingPeriod: ['holding period', 'term', 'long short', 'long/short'],
  price: ['price', 'average price', 'avg price', 'fill price'],
  proceeds: [
    'proceeds',
    'sale proceeds',
    'sales proceeds',
    'gross proceeds',
    'total proceeds',
  ],
  quantity: ['quantity', 'qty', 'shares', 'quantity sold'],
  realizedGainLoss: [
    'realized gain/loss',
    'realized gain loss',
    'gain/loss',
    'gain loss',
    'realized p/l',
    'realized pnl',
  ],
  settleDate: ['settle date', 'settlement date', 'process date'],
  symbol: ['symbol', 'instrument', 'ticker', 'underlying symbol'],
  tradeDate: ['activity date', 'trade date', 'date', 'transaction date'],
  washSale: [
    'wash sale loss disallowed',
    'wash sale disallowed loss',
    'wash sale disallowed',
    'wash sale',
    'wash sale adjustment',
    'disallowed loss',
    'loss disallowed',
  ],
} as const

const CURRENT_POSITION_DETECTION_HEADERS = [
  ...HEADER_ALIASES.averageCost,
  ...HEADER_ALIASES.costBasis,
  ...HEADER_ALIASES.quantity,
  ...HEADER_ALIASES.symbol,
]

const REPORT_DETECTION_HEADERS = [
  ...HEADER_ALIASES.proceeds,
  ...HEADER_ALIASES.costBasis,
  ...HEADER_ALIASES.realizedGainLoss,
  ...HEADER_ALIASES.dateAcquired,
  ...HEADER_ALIASES.dateSold,
  ...HEADER_ALIASES.washSale,
]

export function parseRobinhoodCsvFile(input: {
  text: string
  fileName: string
  importedAt: string
  reportKind?: RobinhoodCsvReportKind
}): RobinhoodCsvImportResult {
  const parsedLines = parseCsvRecords(input.text).filter((cells) =>
    cells.some((cell) => cell.trim()),
  )
  const headerIndex = findHeaderIndex(parsedLines)

  if (headerIndex === -1) {
    return {
      batch: null,
      rows: [],
      errors: ['Robinhood CSV needs a recognizable header row.'],
    }
  }

  const headers = parsedLines[headerIndex].map((header) => header.trim())
  const dataRows = parsedLines
    .slice(headerIndex + 1)
    .map((cells, index) => ({
      cells,
      sourceRowIndex: headerIndex + index + 2,
    }))
    .filter((record) => hasHeaderDataCells(headers, record.cells))
  const reportKind = input.reportKind ?? inferReportKind(headers)
  const batch: RobinhoodImportBatch = {
    id: buildBatchId(input.fileName, reportKind, input.importedAt),
    fileName: input.fileName,
    importedAt: input.importedAt,
    reportKind,
    rowCount: dataRows.length,
    source: 'robinhood_csv_file',
  }

  if (dataRows.length === 0) {
    return {
      batch,
      rows: [],
      errors: ['Robinhood CSV has headers but no activity rows.'],
    }
  }

  const rows = assignStableRowFingerprints(
    dataRows.map((record) =>
      normalizeRobinhoodRow({
        batch,
        cells: record.cells,
        headers,
        reportKind,
        sourceRowIndex: record.sourceRowIndex,
      }),
    ),
  )

  return { batch, rows, errors: [] }
}

export function mergeRobinhoodCsvImportResult(input: {
  currentImports: readonly RobinhoodImportBatch[]
  currentRows: readonly RobinhoodNormalizedRow[]
  result: RobinhoodCsvImportResult
}): RobinhoodCsvMergeResult {
  const imports = input.result.batch
    ? [input.result.batch, ...input.currentImports]
    : [...input.currentImports]
  const existingByFingerprint = new Map(
    input.currentRows.map((row) => [row.fingerprint, row]),
  )
  const addedRows: RobinhoodNormalizedRow[] = []
  const duplicateRows: RobinhoodNormalizedRow[] = []

  for (const row of input.result.rows) {
    const existing = existingByFingerprint.get(row.fingerprint)

    if (existing) {
      duplicateRows.push(existing)
      continue
    }

    existingByFingerprint.set(row.fingerprint, row)
    addedRows.push(row)
  }

  return {
    imports,
    rows: [...addedRows, ...input.currentRows],
    addedRows,
    duplicateRows,
  }
}

export function updateRobinhoodRowReviewState(
  rows: readonly RobinhoodNormalizedRow[],
  rowId: string,
  reviewState: RobinhoodReviewState,
): RobinhoodNormalizedRow[] {
  return rows.map((row) =>
    row.id === rowId ? { ...row, reviewState } : row,
  )
}

export function buildSellFillsFromAcceptedRobinhoodRows(
  rows: readonly RobinhoodNormalizedRow[],
): SellFillRecord[] {
  const acceptedSells = rows.filter(
    (row) => row.reviewState === 'accepted' && row.kind === 'sell',
  )
  const realizedKeys = new Set(
    acceptedSells
      .filter((row) => row.reportKind === 'realized_gain_loss')
      .map(buildSellMatchKey),
  )

  return acceptedSells
    .filter(
      (row) =>
        row.reportKind === 'realized_gain_loss' ||
        !realizedKeys.has(buildSellMatchKey(row)),
    )
    .map(mapRobinhoodRowToSellFill)
}

export function buildRobinhoodTaxPlanningBuckets(input: {
  rows: readonly RobinhoodNormalizedRow[]
  buyingPower: BuyingPowerSummary
  settings?: Partial<PortfolioSettings>
  payYourselfRule?: Partial<PayYourselfRule>
}): RobinhoodTaxPlanningBuckets {
  const acceptedRows = input.rows.filter(
    (row) => row.reviewState === 'accepted',
  )
  const acceptedSells = acceptedRows.filter((row) => row.kind === 'sell')
  const acceptedIncome = acceptedRows.filter(
    (row) => row.kind === 'dividend' || row.kind === 'interest',
  )
  const realizedGainLoss = sumNumbers(
    acceptedSells.map((row) => row.realizedGainLoss),
  )
  const reserveEstimate =
    input.buyingPower.taxReserveSetAside ||
    estimateTaxReserve(realizedGainLoss, input.settings ?? {})
  const payYourselfSetAside =
    input.buyingPower.payYourselfSetAside ||
    estimatePayYourselfAmount(
      realizedGainLoss,
      reserveEstimate,
      input.payYourselfRule,
    )

  return {
    shortTermGainLoss: sumNumbers(
      acceptedSells
        .filter((row) => row.holdingPeriod === 'short_term')
        .map((row) => row.realizedGainLoss),
    ),
    longTermGainLoss: sumNumbers(
      acceptedSells
        .filter((row) => row.holdingPeriod === 'long_term')
        .map((row) => row.realizedGainLoss),
    ),
    unknownTermGainLoss: sumNumbers(
      acceptedSells
        .filter((row) => row.holdingPeriod === 'unknown')
        .map((row) => row.realizedGainLoss),
    ),
    washSaleDisallowedLosses: sumNumbers(
      acceptedSells.map((row) => row.washSaleLossDisallowed),
    ),
    dividendsAndInterest: sumNumbers(
      acceptedIncome.map((row) => positiveNumberOrNull(row.amount)),
    ),
    reserveEstimate,
    payYourselfSetAside,
    remainingReinvestableCash: input.buyingPower.remainingCashAvailable,
    acceptedSellCount: acceptedSells.length,
    acceptedIncomeCount: acceptedIncome.length,
    disclosure: ROBINHOOD_CSV_DISCLOSURE,
  }
}

export function buildRobinhoodPlanningExport(input: {
  imports: readonly RobinhoodImportBatch[]
  rows: readonly RobinhoodNormalizedRow[]
  buyingPower: BuyingPowerSummary
  taxPlanning: RobinhoodTaxPlanningBuckets
  generatedAt: string
}): RobinhoodPlanningExport {
  const sellFillIdByRowId = new Map(
    buildSellFillsFromAcceptedRobinhoodRows(input.rows).map((record) => [
      record.reference,
      record.id,
    ]),
  )

  return {
    schemaVersion: 'robinhood-csv-planning-v1',
    generatedAt: input.generatedAt,
    disclosure: ROBINHOOD_CSV_DISCLOSURE,
    guardrails: [
      'File import only; imported files stay local to the browser session.',
      'Rows must be reviewed and accepted before imported sells affect buying power, pay-yourself, or reinvest cash.',
      'Realized gain/loss CSV rows are preferred over matching account-activity sell rows.',
      'No Robinhood login, credentials, scraping, unofficial API, Crypto Trading API, order execution, or automated trading.',
      'Planning output only; not tax advice and not a filing document.',
    ],
    imports: [...input.imports],
    normalizedRows: [...input.rows],
    reconciliationDecisions: input.rows.map((row) => ({
      rowId: row.id,
      reviewState: row.reviewState,
      reconciliationStatus: row.reconciliationStatus,
      sellFillId: sellFillIdByRowId.get(row.id) ?? null,
      notes: row.reconciliationNotes,
    })),
    buyingPower: input.buyingPower,
    taxPlanning: input.taxPlanning,
  }
}

function normalizeRobinhoodRow(input: {
  batch: RobinhoodImportBatch
  cells: readonly string[]
  headers: readonly string[]
  reportKind: RobinhoodCsvReportKind
  sourceRowIndex: number
}): RobinhoodNormalizedRow {
  const raw = Object.fromEntries(
    input.headers.map((header, index) => [
      header || `Column ${index + 1}`,
      input.cells[index]?.trim() ?? '',
    ]),
  )
  const get = buildFieldGetter(input.headers, input.cells)

  if (input.reportKind === 'realized_gain_loss') {
    return normalizeRealizedGainLossRow(input, raw, get)
  }

  if (input.reportKind === 'current_positions') {
    return normalizeCurrentPositionRow(input, raw, get)
  }

  return normalizeAccountActivityRow(input, raw, get)
}

function normalizeAccountActivityRow(
  input: {
    batch: RobinhoodImportBatch
    reportKind: RobinhoodCsvReportKind
    sourceRowIndex: number
  },
  raw: Record<string, string>,
  get: FieldGetter,
): RobinhoodNormalizedRow {
  const activityType = get(...HEADER_ALIASES.activityType)
  const description = get(...HEADER_ALIASES.description)
  const symbol = normalizeSymbol(
    get(...HEADER_ALIASES.symbol) || extractSymbol(description),
  )
  const quantity = positiveNumberOrNull(
    absoluteNumber(parseOptionalQuantity(get(...HEADER_ALIASES.quantity))),
  )
  const price = positiveNumberOrNull(
    parseOptionalNumber(get(...HEADER_ALIASES.price)),
  )
  const amount = parseOptionalNumber(get(...HEADER_ALIASES.amount))
  const kind = classifyAccountActivity({
    activityType,
    description,
    quantity,
    symbol,
  })
  const fees = positiveAmount(
    parseOptionalNumber(get(...HEADER_ALIASES.fees)) ?? 0,
  )
  const explicitProceeds = positiveNumberOrNull(
    parseOptionalNumber(get(...HEADER_ALIASES.proceeds)),
  )
  const proceeds =
    kind === 'sell'
      ? (explicitProceeds ??
        positiveNumberOrNull(amount) ??
        (quantity !== null && price !== null
          ? Math.max(0, quantity * price - fees)
          : null))
      : null
  const costBasis = positiveNumberOrNull(
    parseOptionalNumber(get(...HEADER_ALIASES.costBasis)),
  )
  const realizedGainLoss =
    proceeds !== null && costBasis !== null ? proceeds - costBasis : null
  const baseRow = buildBaseRow({
    activityType,
    amount,
    averageCost: null,
    batch: input.batch,
    costBasis,
    description,
    fees,
    holdingPeriod: 'unknown',
    kind,
    price,
    proceeds,
    quantity,
    raw,
    realizedGainLoss,
    reportKind: input.reportKind,
    settleDate: normalizeDate(get(...HEADER_ALIASES.settleDate)),
    sourceRowIndex: input.sourceRowIndex,
    symbol,
    tradeDate: normalizeDate(get(...HEADER_ALIASES.tradeDate)),
    washSaleLossDisallowed: 0,
  })

  return finalizeRow(baseRow)
}

function normalizeCurrentPositionRow(
  input: {
    batch: RobinhoodImportBatch
    reportKind: RobinhoodCsvReportKind
    sourceRowIndex: number
  },
  raw: Record<string, string>,
  get: FieldGetter,
): RobinhoodNormalizedRow {
  const description = get(...HEADER_ALIASES.description)
  const symbol = normalizeSymbol(
    get(...HEADER_ALIASES.symbol) || extractSymbol(description),
  )
  const quantity = positiveNumberOrNull(
    absoluteNumber(parseOptionalQuantity(get(...HEADER_ALIASES.quantity))),
  )
  const explicitAverageCost = positiveNumberOrNull(
    parseOptionalNumber(get(...HEADER_ALIASES.averageCost)),
  )
  const explicitCostBasis = positiveNumberOrNull(
    parseOptionalNumber(get(...HEADER_ALIASES.costBasis)),
  )
  const averageCost =
    explicitAverageCost ??
    (explicitCostBasis !== null && quantity !== null
      ? explicitCostBasis / quantity
      : null)
  const costBasis =
    explicitCostBasis ??
    (explicitAverageCost !== null && quantity !== null
      ? explicitAverageCost * quantity
      : null)

  const baseRow = buildBaseRow({
    activityType: 'Current position',
    amount: null,
    averageCost,
    batch: input.batch,
    costBasis,
    description,
    fees: 0,
    holdingPeriod: 'unknown',
    kind: 'position',
    price: null,
    proceeds: null,
    quantity,
    raw,
    realizedGainLoss: null,
    reportKind: input.reportKind,
    settleDate: '',
    sourceRowIndex: input.sourceRowIndex,
    symbol,
    tradeDate: '',
    washSaleLossDisallowed: 0,
  })

  return finalizeRow(baseRow)
}

function normalizeRealizedGainLossRow(
  input: {
    batch: RobinhoodImportBatch
    reportKind: RobinhoodCsvReportKind
    sourceRowIndex: number
  },
  raw: Record<string, string>,
  get: FieldGetter,
): RobinhoodNormalizedRow {
  const description = get(...HEADER_ALIASES.description)
  const symbol = normalizeSymbol(
    get(...HEADER_ALIASES.symbol) || extractSymbol(description),
  )
  const quantity = positiveNumberOrNull(
    absoluteNumber(parseOptionalQuantity(get(...HEADER_ALIASES.quantity))),
  )
  const explicitPrice = positiveNumberOrNull(
    parseOptionalNumber(get(...HEADER_ALIASES.price)),
  )
  const proceeds = positiveNumberOrNull(
    parseOptionalNumber(
      get(...HEADER_ALIASES.proceeds) || get(...HEADER_ALIASES.amount),
    ),
  )
  const costBasis = positiveNumberOrNull(
    parseOptionalNumber(get(...HEADER_ALIASES.costBasis)),
  )
  const realizedGainLoss =
    parseOptionalNumber(get(...HEADER_ALIASES.realizedGainLoss)) ??
    (proceeds !== null && costBasis !== null ? proceeds - costBasis : null)
  const washSaleLossDisallowed = positiveAmount(
    parseOptionalNumber(get(...HEADER_ALIASES.washSale)) ?? 0,
  )
  const price =
    explicitPrice ??
    (proceeds !== null && quantity !== null ? proceeds / quantity : null)
  const kind = symbol || proceeds !== null ? 'sell' : 'unknown'
  const baseRow = buildBaseRow({
    activityType: 'Realized gain/loss',
    amount: proceeds,
    averageCost: null,
    batch: input.batch,
    costBasis,
    description,
    fees: positiveAmount(parseOptionalNumber(get(...HEADER_ALIASES.fees)) ?? 0),
    holdingPeriod: normalizeHoldingPeriod(
      get(...HEADER_ALIASES.holdingPeriod),
    ),
    kind,
    price,
    proceeds,
    quantity,
    raw,
    realizedGainLoss,
    reportKind: input.reportKind,
    settleDate: '',
    sourceRowIndex: input.sourceRowIndex,
    symbol,
    tradeDate: normalizeDate(
      get(...HEADER_ALIASES.dateSold) || get(...HEADER_ALIASES.tradeDate),
    ),
    washSaleLossDisallowed,
  })

  return finalizeRow(baseRow)
}

function buildBaseRow(input: {
  activityType: string
  amount: number | null
  averageCost: number | null
  batch: RobinhoodImportBatch
  costBasis: number | null
  description: string
  fees: number
  holdingPeriod: RobinhoodHoldingPeriod
  kind: RobinhoodNormalizedKind
  price: number | null
  proceeds: number | null
  quantity: number | null
  raw: Record<string, string>
  realizedGainLoss: number | null
  reportKind: RobinhoodCsvReportKind
  settleDate: string
  sourceRowIndex: number
  symbol: string
  tradeDate: string
  washSaleLossDisallowed: number
}): RobinhoodNormalizedRow {
  return {
    id: `${input.batch.id}-row-${input.sourceRowIndex}`,
    fingerprint: '',
    batchId: input.batch.id,
    reportKind: input.reportKind,
    sourceRowIndex: input.sourceRowIndex,
    kind: input.kind,
    symbol: input.symbol,
    description: input.description,
    activityType: input.activityType,
    tradeDate: input.tradeDate,
    settleDate: input.settleDate,
    quantity: input.quantity,
    price: input.price,
    averageCost: input.averageCost,
    amount: input.amount,
    proceeds: input.proceeds,
    costBasis: input.costBasis,
    realizedGainLoss: input.realizedGainLoss,
    holdingPeriod: input.holdingPeriod,
    washSaleLossDisallowed: input.washSaleLossDisallowed,
    fees: input.fees,
    reconciliationStatus: 'needs_review',
    reviewState: 'needs_review',
    reconciliationNotes: [],
    raw: input.raw,
  }
}

function finalizeRow(row: RobinhoodNormalizedRow): RobinhoodNormalizedRow {
  const reconciliationStatus = getReconciliationStatus(row)
  return {
    ...row,
    reconciliationStatus,
    reconciliationNotes: buildReconciliationNotes(row, reconciliationStatus),
  }
}

function getReconciliationStatus(
  row: RobinhoodNormalizedRow,
): RobinhoodReconciliationStatus {
  if (row.kind === 'unknown') {
    return 'unsupported_row'
  }

  if (row.kind === 'position') {
    if (!row.symbol || row.quantity === null) {
      return 'unsupported_row'
    }

    if (row.averageCost === null || row.costBasis === null) {
      return 'missing_basis'
    }

    return 'matched'
  }

  if (row.kind === 'corporate_action') {
    return 'needs_review'
  }

  if (row.kind !== 'sell') {
    return 'needs_review'
  }

  if (row.proceeds === null) {
    return 'missing_proceeds'
  }

  if (row.washSaleLossDisallowed > 0) {
    return 'possible_wash_sale'
  }

  if (row.costBasis === null) {
    return 'missing_basis'
  }

  return 'matched'
}

function buildReconciliationNotes(
  row: RobinhoodNormalizedRow,
  status: RobinhoodReconciliationStatus,
): string[] {
  const notes: string[] = []

  if (status === 'unsupported_row') {
    notes.push('Unsupported Robinhood row; keep it out of sell-fill math.')
  }

  if (status === 'needs_review') {
    notes.push('Review this imported row before accepting it.')
  }

  if (status === 'missing_basis') {
    notes.push('Cost basis is missing; do not invent it.')
  }

  if (status === 'missing_proceeds') {
    notes.push('Proceeds are missing; do not invent them.')
  }

  if (status === 'possible_wash_sale') {
    notes.push('Wash-sale field is present; review before using tax buckets.')
  }

  if (status === 'matched') {
    notes.push(
      row.kind === 'position'
        ? 'Position row has shares and basis for local holdings review.'
        : 'Sell row has proceeds and basis for local planning.',
    )
  }

  if (row.kind === 'position') {
    notes.push('Position rows must be applied from the holdings review before changing portfolio lots.')
  }

  if (row.kind === 'corporate_action') {
    notes.push(
      'Corporate action row is captured for review but does not change holdings or buying power automatically.',
    )
  }

  if (row.reportKind === 'realized_gain_loss') {
    notes.push('Realized gain/loss CSV values are preferred for this sell.')
  }

  return notes
}

function mapRobinhoodRowToSellFill(row: RobinhoodNormalizedRow): SellFillRecord {
  const fillPrice =
    row.proceeds !== null && row.quantity !== null
      ? row.proceeds / row.quantity
      : row.price
  const notes = [
    row.description || 'Robinhood imported sell',
    `Reconciliation: ${formatReconciliationStatus(row.reconciliationStatus)}.`,
    row.holdingPeriod !== 'unknown'
      ? `Holding period: ${formatHoldingPeriod(row.holdingPeriod)}.`
      : '',
    row.washSaleLossDisallowed > 0
      ? `Wash-sale loss disallowed: ${row.washSaleLossDisallowed}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    id: `robinhood-${row.id}`,
    status: 'reviewed',
    symbol: row.symbol,
    sharesSold: row.quantity,
    fillPrice,
    averageCost: null,
    costBasis: row.costBasis,
    filledDate: row.tradeDate,
    fees: row.proceeds !== null ? 0 : row.fees,
    source:
      row.reportKind === 'realized_gain_loss'
        ? 'Robinhood realized gain/loss CSV'
        : 'Robinhood account activity CSV',
    reference: row.id,
    notes,
  }
}

function buildSellMatchKey(row: RobinhoodNormalizedRow): string {
  return [
    row.symbol,
    row.tradeDate,
    row.quantity === null ? '' : row.quantity.toFixed(6),
  ].join('|')
}

function classifyAccountActivity(input: {
  activityType: string
  description: string
  quantity: number | null
  symbol: string
}): RobinhoodNormalizedKind {
  const code = input.activityType.trim().toUpperCase()
  const text = `${input.activityType} ${input.description}`.toLowerCase()

  if (code === 'CONV') {
    return input.symbol && input.quantity !== null ? 'position' : 'transfer'
  }

  if (code === 'SPL' || code === 'REC') {
    return input.symbol && input.quantity !== null
      ? 'position'
      : 'corporate_action'
  }

  if (code === 'SXCH') {
    return 'corporate_action'
  }

  if (code === 'CDIV') {
    return 'dividend'
  }

  if (code === 'INT') {
    return 'interest'
  }

  if (code === 'GOLD') {
    return 'fee'
  }

  if (code === 'ACH' || code === 'RTP') {
    return 'transfer'
  }

  if (/\b(dividend|qualified dividend|cash dividend|div)\b/.test(text)) {
    return 'dividend'
  }

  if (/\b(interest|int)\b/.test(text)) {
    return 'interest'
  }

  if (/\b(fee|commission|regulatory|adr fee|margin interest)\b/.test(text)) {
    return 'fee'
  }

  if (/\b(transfer|deposit|withdraw|ach|acat|journal|cash sweep)\b/.test(text)) {
    return 'transfer'
  }

  if (/\b(sell|sold|stc|sell to close|assigned)\b/.test(text)) {
    return 'sell'
  }

  if (/\b(buy|bought|btc|buy to close)\b/.test(text)) {
    return 'buy'
  }

  return 'unknown'
}

function hasHeaderDataCells(
  headers: readonly string[],
  cells: readonly string[],
): boolean {
  return headers.some((header, index) =>
    Boolean(header.trim() && cells[index]?.trim()),
  )
}

function findHeaderIndex(lines: readonly string[][]): number {
  return lines.findIndex((cells) => {
    const normalizedHeaders = cells.map(normalizeHeader)
    const score = [
      ...HEADER_ALIASES.symbol,
      ...HEADER_ALIASES.description,
      ...HEADER_ALIASES.activityType,
      ...HEADER_ALIASES.quantity,
      ...HEADER_ALIASES.amount,
      ...HEADER_ALIASES.proceeds,
      ...HEADER_ALIASES.costBasis,
    ].filter((header) => normalizedHeaders.includes(normalizeHeader(header)))
      .length

    return score >= 2
  })
}

function inferReportKind(headers: readonly string[]): RobinhoodCsvReportKind {
  const normalizedHeaders = headers.map(normalizeHeader)
  const currentPositionScore = CURRENT_POSITION_DETECTION_HEADERS.filter(
    (header) => normalizedHeaders.includes(normalizeHeader(header)),
  ).length
  const realizedScore = REPORT_DETECTION_HEADERS.filter((header) =>
    normalizedHeaders.includes(normalizeHeader(header)),
  ).length

  if (currentPositionScore >= 3 && realizedScore < 2) {
    return 'current_positions'
  }

  return realizedScore >= 2 ? 'realized_gain_loss' : 'account_activity'
}

function buildFieldGetter(
  headers: readonly string[],
  cells: readonly string[],
): FieldGetter {
  const fields = new Map(
    headers.map((header, index) => [
      normalizeHeader(header),
      cells[index]?.trim() ?? '',
    ]),
  )

  return (...keys: string[]) => {
    for (const key of keys) {
      const value = fields.get(normalizeHeader(key))

      if (value) {
        return value
      }
    }

    return ''
  }
}

function buildBatchId(
  fileName: string,
  reportKind: RobinhoodCsvReportKind,
  importedAt: string,
): string {
  const timestamp = importedAt.replace(/\D/g, '')
  const slug =
    fileName
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'robinhood-csv'

  return `${reportKind}-${slug}-${timestamp}`
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let cells: string[] = []
  let cell = ''
  let inQuotes = false

  function pushCell() {
    cells.push(cell.trim())
    cell = ''
  }

  function pushRecord() {
    pushCell()

    if (cells.some((value) => value.trim())) {
      records.push(cells)
    }

    cells = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"' && nextChar === '"' && inQuotes) {
      cell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(cell.trim())
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      pushRecord()

      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      continue
    }

    if ((char === '\n' || char === '\r') && inQuotes) {
      cell += '\n'

      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      continue
    }

    cell += char
  }

  if (cell.length > 0 || cells.length > 0) {
    pushRecord()
  }

  return records
}

export function buildRobinhoodRowFingerprint(
  row: RobinhoodNormalizedRow,
): string {
  return stableHash(
    [
      row.reportKind,
      row.kind,
      row.symbol,
      row.description,
      row.activityType,
      row.tradeDate,
      row.settleDate,
      formatFingerprintNumber(row.quantity),
      formatFingerprintNumber(row.price),
      formatFingerprintNumber(row.averageCost),
      formatFingerprintNumber(row.amount),
      formatFingerprintNumber(row.proceeds),
      formatFingerprintNumber(row.costBasis),
      formatFingerprintNumber(row.realizedGainLoss),
      row.holdingPeriod,
      formatFingerprintNumber(row.washSaleLossDisallowed),
      formatFingerprintNumber(row.fees),
    ].join('|'),
  )
}

function assignStableRowFingerprints(
  rows: readonly RobinhoodNormalizedRow[],
): RobinhoodNormalizedRow[] {
  const baseFingerprints = rows.map(buildRobinhoodRowFingerprint)
  const totalByBaseFingerprint = new Map<string, number>()
  const seenByBaseFingerprint = new Map<string, number>()

  for (const fingerprint of baseFingerprints) {
    totalByBaseFingerprint.set(
      fingerprint,
      (totalByBaseFingerprint.get(fingerprint) ?? 0) + 1,
    )
  }

  return rows.map((row, index) => {
    const baseFingerprint = baseFingerprints[index]
    const duplicateCount = totalByBaseFingerprint.get(baseFingerprint) ?? 1
    const nextSeen = (seenByBaseFingerprint.get(baseFingerprint) ?? 0) + 1
    seenByBaseFingerprint.set(baseFingerprint, nextSeen)

    const fingerprint =
      duplicateCount > 1
        ? `${baseFingerprint}-${String(nextSeen).padStart(3, '0')}`
        : baseFingerprint

    return {
      ...row,
      fingerprint,
      id: `robinhood-row-${fingerprint}`,
    }
  })
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed || /^(-|--|n\/a|na)$/i.test(trimmed)) {
    return null
  }

  const isParentheticalNegative =
    trimmed.startsWith('(') && trimmed.endsWith(')')
  const cleaned = trimmed.replace(/[,$%()]/g, '').trim()
  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return isParentheticalNegative ? -parsed : parsed
}

function parseOptionalQuantity(value: unknown): number | null {
  const parsed = parseOptionalNumber(value)

  if (parsed !== null || typeof value !== 'string') {
    return parsed
  }

  const trimmed = value.trim()
  const withoutRobinhoodSuffix = trimmed.replace(/[A-Z]+$/i, '')

  return withoutRobinhoodSuffix === trimmed
    ? null
    : parseOptionalNumber(withoutRobinhoodSuffix)
}

function formatFingerprintNumber(value: number | null): string {
  return value === null ? '' : String(Number(value.toFixed(8)))
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

function normalizeDate(value: string): string {
  const trimmed = value.trim()

  if (!trimmed) {
    return ''
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (!match) {
    return trimmed
  }

  const [, month, day, year] = match

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function normalizeHoldingPeriod(value: string): RobinhoodHoldingPeriod {
  const normalized = value.trim().toLowerCase()

  if (/\b(long|lt|long-term|long term)\b/.test(normalized)) {
    return 'long_term'
  }

  if (/\b(short|st|short-term|short term)\b/.test(normalized)) {
    return 'short_term'
  }

  return 'unknown'
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase()

  if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
    return symbol
  }

  return ''
}

function extractSymbol(value: string): string {
  const parenthetical = value.match(/\(([A-Z][A-Z0-9.-]{0,9})\)/)

  if (parenthetical) {
    return parenthetical[1]
  }

  const leading = value.trim().match(/^([A-Z][A-Z0-9.-]{0,9})\b/)

  return leading?.[1] ?? ''
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function absoluteNumber(value: number | null): number | null {
  return value === null ? null : Math.abs(value)
}

function positiveNumberOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function positiveAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function sumNumbers(values: readonly (number | null)[]): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
}

function formatReconciliationStatus(
  status: RobinhoodReconciliationStatus,
): string {
  return status.replace(/_/g, ' ')
}

function formatHoldingPeriod(period: RobinhoodHoldingPeriod): string {
  return period.replace(/_/g, ' ')
}

export function normalizeRobinhoodPayYourselfRule(
  payYourselfRule?: Partial<PayYourselfRule>,
): PayYourselfRule {
  return normalizePayYourselfRule(
    payYourselfRule ?? DEFAULT_PAY_YOURSELF_RULE,
  )
}
