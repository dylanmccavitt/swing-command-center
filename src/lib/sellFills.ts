import type { PortfolioSettings } from './portfolio'
import { estimateTaxReserve } from './profitLock'
import {
  DEFAULT_PAY_YOURSELF_RULE,
  estimatePayYourselfAmount,
  normalizePayYourselfRule,
  type PayYourselfRule,
} from './tradeJournal'

export const SELL_FILL_DISCLOSURE =
  'Manual sell-fill planning only. No broker credentials, no Robinhood connection, no scraping, no order execution, and no automated trading. Tax reserve output is a planning helper, not tax advice or a filing document.'

export type SellFillStatus =
  | 'planned'
  | 'ordered'
  | 'filled'
  | 'canceled'
  | 'reviewed'

export type SellFillRecord = {
  id: string
  status: SellFillStatus
  symbol: string
  sharesSold: number | null
  fillPrice: number | null
  averageCost: number | null
  costBasis: number | null
  filledDate: string
  fees: number
  source: string
  reference: string
  notes: string
}

export type SellFillMetrics = {
  countsForBuyingPower: boolean
  cashRaised: number
  costBasisRemoved: number
  realizedGainLoss: number
  taxReserveEstimate: number
  payYourselfSetAside: number
  reinvestableCash: number
  missingFields: string[]
  costBasisSource: 'average_cost' | 'cost_basis' | 'missing' | 'not_counted'
}

export type SellFillRow = SellFillRecord & {
  metrics: SellFillMetrics
}

export type BuyingPowerSummary = {
  startingCash: number
  filledSellProceeds: number
  costBasisRemoved: number
  realizedGainLoss: number
  taxReserveSetAside: number
  payYourselfSetAside: number
  manuallyReinvestedCash: number
  remainingCashAvailable: number
  filledSellCount: number
  pendingSellCount: number
  ignoredSellCount: number
  missingInputCount: number
  statusCounts: Record<SellFillStatus, number>
  disclosure: string
}

export type SellFillImportResult = {
  records: SellFillRecord[]
  errors: string[]
}

export type SellFillPlanningExport = {
  schemaVersion: 'sell-fill-buying-power-v1'
  generatedAt: string
  disclosure: string
  guardrails: string[]
  payYourselfRule: PayYourselfRule
  buyingPower: BuyingPowerSummary
  sellFills: SellFillRow[]
}

type MetricOptions = {
  settings?: Partial<PortfolioSettings>
  payYourselfRule?: Partial<PayYourselfRule>
}

const SELL_FILL_STATUSES: readonly SellFillStatus[] = [
  'planned',
  'ordered',
  'filled',
  'canceled',
  'reviewed',
]

const JSON_RECORD_KEYS = ['records', 'sellFills', 'sell_fills', 'fills']

export function buildSellFillRows(
  records: readonly SellFillRecord[],
  options: MetricOptions = {},
): SellFillRow[] {
  return records.map((record) => ({
    ...record,
    metrics: buildSellFillMetrics(record, options),
  }))
}

export function buildSellFillMetrics(
  record: SellFillRecord,
  options: MetricOptions = {},
): SellFillMetrics {
  if (!isFilledSellStatus(record.status)) {
    return {
      countsForBuyingPower: false,
      cashRaised: 0,
      costBasisRemoved: 0,
      realizedGainLoss: 0,
      taxReserveEstimate: 0,
      payYourselfSetAside: 0,
      reinvestableCash: 0,
      missingFields: [],
      costBasisSource: 'not_counted',
    }
  }

  const missingFields: string[] = []
  const sharesSold = positiveNumberOrNull(record.sharesSold)
  const fillPrice = positiveNumberOrNull(record.fillPrice)
  const averageCost = positiveNumberOrNull(record.averageCost)
  const explicitCostBasis = positiveNumberOrNull(record.costBasis)

  if (sharesSold === null) {
    missingFields.push('shares sold')
  }

  if (fillPrice === null) {
    missingFields.push('fill price')
  }

  if (!record.filledDate.trim()) {
    missingFields.push('filled date')
  }

  const costBasisRemoved =
    explicitCostBasis ??
    (sharesSold !== null && averageCost !== null
      ? sharesSold * averageCost
      : null)
  const costBasisSource =
    explicitCostBasis !== null
      ? 'cost_basis'
      : costBasisRemoved !== null
        ? 'average_cost'
        : 'missing'

  if (costBasisRemoved === null) {
    missingFields.push('average cost or cost basis')
  }

  const cashRaised =
    sharesSold !== null && fillPrice !== null
      ? Math.max(0, sharesSold * fillPrice - positiveAmount(record.fees))
      : 0
  const realizedGainLoss =
    costBasisRemoved !== null && sharesSold !== null && fillPrice !== null
      ? cashRaised - costBasisRemoved
      : 0
  const taxReserveEstimate =
    costBasisRemoved !== null
      ? estimateTaxReserve(realizedGainLoss, options.settings ?? {})
      : 0
  const payYourselfSetAside =
    costBasisRemoved !== null
      ? estimatePayYourselfAmount(
          realizedGainLoss,
          taxReserveEstimate,
          options.payYourselfRule,
        )
      : 0
  const reinvestableCash = Math.max(
    0,
    cashRaised - taxReserveEstimate - payYourselfSetAside,
  )

  return {
    countsForBuyingPower: true,
    cashRaised,
    costBasisRemoved: costBasisRemoved ?? 0,
    realizedGainLoss,
    taxReserveEstimate,
    payYourselfSetAside,
    reinvestableCash,
    missingFields,
    costBasisSource,
  }
}

export function buildBuyingPowerSummary(input: {
  records: readonly SellFillRecord[]
  startingCash?: number
  manuallyReinvestedCash?: number
  settings?: Partial<PortfolioSettings>
  payYourselfRule?: Partial<PayYourselfRule>
}): BuyingPowerSummary {
  const rows = buildSellFillRows(input.records, {
    settings: input.settings,
    payYourselfRule: input.payYourselfRule,
  })
  const statusCounts = buildStatusCounts(input.records)
  const filledRows = rows.filter((row) => row.metrics.countsForBuyingPower)
  const startingCash = positiveAmount(input.startingCash ?? 0)
  const manuallyReinvestedCash = positiveAmount(
    input.manuallyReinvestedCash ?? 0,
  )
  const filledSellProceeds = sumMetric(filledRows, 'cashRaised')
  const taxReserveSetAside = sumMetric(filledRows, 'taxReserveEstimate')
  const payYourselfSetAside = sumMetric(filledRows, 'payYourselfSetAside')

  return {
    startingCash,
    filledSellProceeds,
    costBasisRemoved: sumMetric(filledRows, 'costBasisRemoved'),
    realizedGainLoss: sumMetric(filledRows, 'realizedGainLoss'),
    taxReserveSetAside,
    payYourselfSetAside,
    manuallyReinvestedCash,
    remainingCashAvailable: Math.max(
      0,
      startingCash +
        filledSellProceeds -
        taxReserveSetAside -
        payYourselfSetAside -
        manuallyReinvestedCash,
    ),
    filledSellCount: filledRows.length,
    pendingSellCount: statusCounts.planned + statusCounts.ordered,
    ignoredSellCount: statusCounts.canceled,
    missingInputCount: filledRows.filter(
      (row) => row.metrics.missingFields.length > 0,
    ).length,
    statusCounts,
    disclosure: SELL_FILL_DISCLOSURE,
  }
}

export function buildSellFillPlanningExport(input: {
  records: readonly SellFillRecord[]
  buyingPower: BuyingPowerSummary
  generatedAt: string
  settings?: Partial<PortfolioSettings>
  payYourselfRule?: Partial<PayYourselfRule>
}): SellFillPlanningExport {
  return {
    schemaVersion: 'sell-fill-buying-power-v1',
    generatedAt: input.generatedAt,
    disclosure: SELL_FILL_DISCLOSURE,
    guardrails: [
      'Manual sell-fill and buying-power planning data only.',
      'Only filled or reviewed sell records affect realized P/L and buying power.',
      'No broker credentials, Robinhood integration, scraping, order execution, or automated trading.',
      'Not a filing document and not tax advice.',
    ],
    payYourselfRule: normalizePayYourselfRule(
      input.payYourselfRule ?? DEFAULT_PAY_YOURSELF_RULE,
    ),
    buyingPower: input.buyingPower,
    sellFills: buildSellFillRows(input.records, {
      settings: input.settings,
      payYourselfRule: input.payYourselfRule,
    }),
  }
}

export function parseSellFillImportText(
  text: string,
  importedAt: string,
): SellFillImportResult {
  const trimmed = text.trim()

  if (!trimmed) {
    return {
      records: [],
      errors: ['Paste local CSV or JSON sell records before importing.'],
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseSellFillJson(trimmed, importedAt)
  }

  return parseSellFillCsv(trimmed, importedAt)
}

export function isFilledSellStatus(status: SellFillStatus): boolean {
  return status === 'filled' || status === 'reviewed'
}

export function normalizeSellFillStatus(
  value: unknown,
): SellFillStatus | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = normalizeHeader(value)

  if (normalized === 'cancelled') {
    return 'canceled'
  }

  return SELL_FILL_STATUSES.find((status) => status === normalized) ?? null
}

function parseSellFillJson(
  text: string,
  importedAt: string,
): SellFillImportResult {
  try {
    const parsed: unknown = JSON.parse(text)
    const rows = Array.isArray(parsed) ? parsed : extractJsonRecords(parsed)

    if (!rows) {
      return {
        records: [],
        errors: [
          'JSON must be an array or an object with records, sellFills, sell_fills, or fills.',
        ],
      }
    }

    return normalizeImportedRows(rows, importedAt)
  } catch {
    return {
      records: [],
      errors: ['JSON import could not be parsed. Check brackets and commas.'],
    }
  }
}

function parseSellFillCsv(
  text: string,
  importedAt: string,
): SellFillImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return {
      records: [],
      errors: ['CSV import needs a header row and at least one sell record.'],
    }
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader)
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const row: Record<string, string> = {}

    for (const [index, header] of headers.entries()) {
      row[header] = cells[index] ?? ''
    }

    return row
  })

  return normalizeImportedRows(rows, importedAt)
}

function normalizeImportedRows(
  rows: readonly unknown[],
  importedAt: string,
): SellFillImportResult {
  const errors: string[] = []
  const records = rows.flatMap((row, index) => {
    const record = normalizeImportedRecord(row, index, importedAt)

    if ('error' in record) {
      errors.push(record.error)
      return []
    }

    return [record]
  })

  return { records, errors }
}

function normalizeImportedRecord(
  row: unknown,
  index: number,
  importedAt: string,
): SellFillRecord | { error: string } {
  if (!row || typeof row !== 'object') {
    return { error: `Row ${index + 1} is not an object or CSV record.` }
  }

  const get = buildFieldGetter(row as Record<string, unknown>)
  const symbol = normalizeSymbol(get('symbol') ?? get('ticker'))

  if (!symbol) {
    return { error: `Row ${index + 1} is missing a symbol.` }
  }

  const status =
    normalizeSellFillStatus(get('status')) ??
    normalizeSellFillStatus(get('state')) ??
    'filled'

  return {
    id:
      stringOrEmpty(get('id')) ||
      buildImportedSellFillId({
        index,
        importedAt,
        status,
        symbol,
      }),
    status,
    symbol,
    sharesSold: parseOptionalNumber(get('sharesSold') ?? get('shares')),
    fillPrice: parseOptionalNumber(get('fillPrice') ?? get('price')),
    averageCost: parseOptionalNumber(
      get('averageCost') ?? get('avgCost') ?? get('avgcost'),
    ),
    costBasis: parseOptionalNumber(get('costBasis') ?? get('basis')),
    filledDate: stringOrEmpty(get('filledDate') ?? get('date')),
    fees: positiveAmount(parseOptionalNumber(get('fees') ?? get('fee')) ?? 0),
    source: stringOrEmpty(get('source')) || 'local import',
    reference:
      stringOrEmpty(get('reference') ?? get('ref') ?? get('orderRef')) || '',
    notes: stringOrEmpty(get('notes') ?? get('note')) || '',
  }
}

function extractJsonRecords(value: unknown): unknown[] | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  for (const key of JSON_RECORD_KEYS) {
    const maybeRecords = (value as Record<string, unknown>)[key]

    if (Array.isArray(maybeRecords)) {
      return maybeRecords
    }
  }

  return null
}

function buildFieldGetter(row: Record<string, unknown>) {
  const fields = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
  )

  return (key: string) => fields.get(normalizeHeader(key))
}

function buildImportedSellFillId(input: {
  symbol: string
  status: SellFillStatus
  importedAt: string
  index: number
}) {
  const timestamp = input.importedAt.replace(/\D/g, '')

  return `${input.symbol.toLowerCase()}-${input.status}-${timestamp}-${input.index + 1}`
}

function buildStatusCounts(
  records: readonly SellFillRecord[],
): Record<SellFillStatus, number> {
  return {
    planned: records.filter((record) => record.status === 'planned').length,
    ordered: records.filter((record) => record.status === 'ordered').length,
    filled: records.filter((record) => record.status === 'filled').length,
    canceled: records.filter((record) => record.status === 'canceled').length,
    reviewed: records.filter((record) => record.status === 'reviewed').length,
  }
}

function sumMetric(
  rows: readonly SellFillRow[],
  field: keyof Pick<
    SellFillMetrics,
    | 'cashRaised'
    | 'costBasisRemoved'
    | 'realizedGainLoss'
    | 'taxReserveEstimate'
    | 'payYourselfSetAside'
  >,
): number {
  return rows.reduce((sum, row) => sum + row.metrics[field], 0)
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"' && nextChar === '"') {
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

    cell += char
  }

  cells.push(cell.trim())

  return cells
}

function normalizeSymbol(value: unknown): string {
  return stringOrEmpty(value).toUpperCase()
}

function normalizeHeader(value: unknown): string {
  return stringOrEmpty(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
}

function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.replace(/[$,%]/g, '').trim()

  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : null
}

function positiveNumberOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function positiveAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}
