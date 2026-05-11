import type { SeedHolding } from '../data/seedHoldings'
import type {
  RobinhoodImportBatch,
  RobinhoodNormalizedRow,
} from './robinhoodCsv'

export type RobinhoodHoldingSyncSource =
  | 'current_positions_csv'
  | 'account_activity_ledger'

export type RobinhoodHoldingSyncStatus =
  | 'ready'
  | 'missing_basis'
  | 'missing_shares'
  | 'closed'

export type RobinhoodDerivedHolding = {
  symbol: string
  name: string
  source: RobinhoodHoldingSyncSource
  shares: number | null
  averageCost: number | null
  costBasis: number | null
  buyQuantity: number
  sellQuantity: number
  rowIds: string[]
  fingerprint: string
  status: RobinhoodHoldingSyncStatus
  notes: string[]
}

export type RobinhoodHoldingsReviewDecision =
  | 'needs_review'
  | 'applied'
  | 'rejected'

export type RobinhoodHoldingsReviewEntry = {
  symbol: string
  fingerprint: string
  decision: RobinhoodHoldingsReviewDecision
  updatedAt: string
  appliedAt: string | null
  source: RobinhoodHoldingSyncSource
  shares: number | null
  averageCost: number | null
  costBasis: number | null
  rowIds: string[]
}

export type RobinhoodHoldingsReviewMap = Record<
  string,
  RobinhoodHoldingsReviewEntry
>

export type ManualLotPatchMap = Record<
  string,
  {
    shares: string
    averageCost: string
  }
>

export type RobinhoodPortfolioSyncResult = {
  holdings: SeedHolding[]
  manualLots: ManualLotPatchMap
  holdingsReview: RobinhoodHoldingsReviewMap
  appliedHoldings: RobinhoodDerivedHolding[]
}

export function deriveRobinhoodHoldings(input: {
  imports: readonly RobinhoodImportBatch[]
  rows: readonly RobinhoodNormalizedRow[]
}): RobinhoodDerivedHolding[] {
  const acceptedRows = input.rows.filter(
    (row) => row.reviewState === 'accepted',
  )
  const batchImportedAt = new Map(
    input.imports.map((batch) => [batch.id, batch.importedAt]),
  )
  const currentPositionHoldings = deriveCurrentPositionHoldings(
    acceptedRows,
    batchImportedAt,
  )
  const currentPositionSymbols = new Set(
    currentPositionHoldings.map((holding) => holding.symbol),
  )
  const ledgerHoldings = deriveLedgerHoldings(acceptedRows).filter(
    (holding) => !currentPositionSymbols.has(holding.symbol),
  )

  return [...currentPositionHoldings, ...ledgerHoldings].sort((left, right) =>
    left.symbol.localeCompare(right.symbol),
  )
}

export function getRobinhoodHoldingsReviewDecision(
  review: RobinhoodHoldingsReviewMap,
  holding: RobinhoodDerivedHolding,
): RobinhoodHoldingsReviewDecision {
  const entry = review[holding.symbol]

  if (!entry || entry.fingerprint !== holding.fingerprint) {
    return 'needs_review'
  }

  return entry.decision
}

export function buildRobinhoodHoldingsReviewEntry(input: {
  holding: RobinhoodDerivedHolding
  decision: RobinhoodHoldingsReviewDecision
  updatedAt: string
  appliedAt?: string | null
}): RobinhoodHoldingsReviewEntry {
  return {
    symbol: input.holding.symbol,
    fingerprint: input.holding.fingerprint,
    decision: input.decision,
    updatedAt: input.updatedAt,
    appliedAt: input.appliedAt ?? null,
    source: input.holding.source,
    shares: input.holding.shares,
    averageCost: input.holding.averageCost,
    costBasis: input.holding.costBasis,
    rowIds: [...input.holding.rowIds],
  }
}

export function applyRobinhoodDerivedHolding(input: {
  holdings: readonly SeedHolding[]
  manualLots: ManualLotPatchMap
  holding: RobinhoodDerivedHolding
}): {
  holdings: SeedHolding[]
  manualLots: ManualLotPatchMap
} {
  const symbol = input.holding.symbol
  const currentHolding = input.holdings.find(
    (holding) => holding.symbol === symbol,
  )
  const nextHolding: SeedHolding = {
    symbol,
    name: input.holding.name || currentHolding?.name || symbol,
    stackLayer: currentHolding?.stackLayer ?? 'general_watchlist',
    thesisTag:
      currentHolding?.thesisTag ??
      'Reviewed from a local Robinhood CSV export.',
    shares: null,
    averageCost: null,
  }
  const holdings = currentHolding
    ? input.holdings.map((holding) =>
        holding.symbol === symbol
          ? {
              ...holding,
              name: nextHolding.name,
            }
          : holding,
      )
    : [...input.holdings, nextHolding]
  const manualLots = {
    ...input.manualLots,
    [symbol]: {
      shares:
        input.holding.shares === null
          ? input.manualLots[symbol]?.shares ?? ''
          : formatNumberForInput(input.holding.shares),
      averageCost:
        input.holding.averageCost === null
          ? ''
          : formatNumberForInput(input.holding.averageCost),
    },
  }

  return { holdings, manualLots }
}

export function syncAcceptedRobinhoodHoldingsToPortfolio(input: {
  imports: readonly RobinhoodImportBatch[]
  rows: readonly RobinhoodNormalizedRow[]
  holdings: readonly SeedHolding[]
  manualLots: ManualLotPatchMap
  holdingsReview: RobinhoodHoldingsReviewMap
  symbols?: readonly string[]
  updatedAt: string
}): RobinhoodPortfolioSyncResult {
  const symbolSet = input.symbols
    ? new Set(input.symbols.map((symbol) => symbol.toUpperCase()))
    : null
  const holdingsToApply = deriveRobinhoodHoldings({
    imports: input.imports,
    rows: input.rows,
  }).filter((holding) => {
    if (symbolSet && !symbolSet.has(holding.symbol)) {
      return false
    }

    if (
      holding.shares === null ||
      holding.status === 'missing_shares' ||
      holding.status === 'closed'
    ) {
      return false
    }

    const decision = getRobinhoodHoldingsReviewDecision(
      input.holdingsReview,
      holding,
    )

    return decision !== 'rejected' && decision !== 'applied'
  })
  const appliedState = holdingsToApply.reduce(
    (state, holding) =>
      applyRobinhoodDerivedHolding({
        holdings: state.holdings,
        manualLots: state.manualLots,
        holding,
      }),
    {
      holdings: [...input.holdings],
      manualLots: { ...input.manualLots },
    },
  )
  const holdingsReview = { ...input.holdingsReview }

  for (const holding of holdingsToApply) {
    holdingsReview[holding.symbol] = buildRobinhoodHoldingsReviewEntry({
      holding,
      decision: 'applied',
      updatedAt: input.updatedAt,
      appliedAt: input.updatedAt,
    })
  }

  return {
    ...appliedState,
    holdingsReview,
    appliedHoldings: holdingsToApply,
  }
}

function deriveCurrentPositionHoldings(
  rows: readonly RobinhoodNormalizedRow[],
  batchImportedAt: ReadonlyMap<string, string>,
): RobinhoodDerivedHolding[] {
  const latestBySymbol = new Map<string, RobinhoodNormalizedRow>()

  for (const row of rows) {
    if (row.reportKind !== 'current_positions' || row.kind !== 'position') {
      continue
    }

    if (!row.symbol) {
      continue
    }

    const current = latestBySymbol.get(row.symbol)
    const rowImportedAt = batchImportedAt.get(row.batchId) ?? ''
    const currentImportedAt = current
      ? batchImportedAt.get(current.batchId) ?? ''
      : ''

    if (!current || rowImportedAt >= currentImportedAt) {
      latestBySymbol.set(row.symbol, row)
    }
  }

  return Array.from(latestBySymbol.values()).map((row) => {
    const shares = row.quantity
    const costBasis = row.costBasis
    const averageCost = row.averageCost
    const status = getPositionStatus(shares, averageCost, costBasis)
    const notes = [
      'Derived from an accepted current positions CSV row.',
      status === 'missing_basis'
        ? 'Average cost or cost basis is missing; the sync will keep basis blank.'
        : '',
      status === 'missing_shares'
        ? 'Share count is missing; this row cannot update holdings.'
        : '',
    ].filter(Boolean)

    return buildDerivedHolding({
      averageCost,
      buyQuantity: shares ?? 0,
      costBasis,
      name: row.description || row.symbol,
      notes,
      rowIds: [row.id],
      sellQuantity: 0,
      shares,
      source: 'current_positions_csv',
      status,
      symbol: row.symbol,
    })
  })
}

function deriveLedgerHoldings(
  rows: readonly RobinhoodNormalizedRow[],
): RobinhoodDerivedHolding[] {
  const realizedSellKeys = new Set(
    rows
      .filter(
        (row) =>
          row.reportKind === 'realized_gain_loss' && row.kind === 'sell',
      )
      .map(buildSellMatchKey),
  )
  const bySymbol = new Map<
    string,
    {
      buyQuantity: number
      buyBasis: number
      hasMissingBuyBasis: boolean
      hasMissingSellBasis: boolean
      hasMissingShares: boolean
      name: string
      rowIds: string[]
      sellBasis: number
      sellQuantity: number
    }
  >()

  for (const row of rows) {
    if (!row.symbol || (row.kind !== 'buy' && row.kind !== 'sell')) {
      continue
    }

    if (
      row.reportKind === 'account_activity' &&
      row.kind === 'sell' &&
      realizedSellKeys.has(buildSellMatchKey(row))
    ) {
      continue
    }

    const bucket =
      bySymbol.get(row.symbol) ??
      {
        buyQuantity: 0,
        buyBasis: 0,
        hasMissingBuyBasis: false,
        hasMissingSellBasis: false,
        hasMissingShares: false,
        name: row.description || row.symbol,
        rowIds: [],
        sellBasis: 0,
        sellQuantity: 0,
      }
    bucket.rowIds.push(row.id)
    bucket.name = bucket.name || row.description || row.symbol

    if (row.quantity === null) {
      bucket.hasMissingShares = true
    } else if (row.kind === 'buy') {
      bucket.buyQuantity += row.quantity
    } else {
      bucket.sellQuantity += row.quantity
    }

    if (row.kind === 'buy') {
      const basis = getBuyCostBasis(row)

      if (basis === null) {
        bucket.hasMissingBuyBasis = true
      } else {
        bucket.buyBasis += basis
      }
    }

    if (row.kind === 'sell') {
      if (row.costBasis === null) {
        bucket.hasMissingSellBasis = true
      } else {
        bucket.sellBasis += row.costBasis
      }
    }

    bySymbol.set(row.symbol, bucket)
  }

  return Array.from(bySymbol.entries()).map(([symbol, bucket]) => {
    const shares = Math.max(0, bucket.buyQuantity - bucket.sellQuantity)
    const missingBasis =
      bucket.hasMissingBuyBasis ||
      bucket.hasMissingSellBasis ||
      bucket.buyBasis < bucket.sellBasis
    const costBasis =
      missingBasis || shares <= 0 ? null : bucket.buyBasis - bucket.sellBasis
    const averageCost =
      costBasis === null || shares <= 0 ? null : costBasis / shares
    const status = bucket.hasMissingShares
      ? 'missing_shares'
      : shares <= 0
        ? 'closed'
        : missingBasis
          ? 'missing_basis'
          : 'ready'
    const notes = [
      'Derived from accepted account activity buys/sells.',
      bucket.sellQuantity > 0
        ? 'Accepted realized gain/loss sells are preferred over matching account activity sells.'
        : '',
      missingBasis
        ? 'Some buy or sell basis is missing; average cost stays blank.'
        : '',
      bucket.hasMissingShares
        ? 'At least one accepted buy/sell row is missing quantity.'
        : '',
    ].filter(Boolean)

    return buildDerivedHolding({
      averageCost,
      buyQuantity: bucket.buyQuantity,
      costBasis,
      name: bucket.name,
      notes,
      rowIds: bucket.rowIds,
      sellQuantity: bucket.sellQuantity,
      shares,
      source: 'account_activity_ledger',
      status,
      symbol,
    })
  })
}

function buildDerivedHolding(input: Omit<RobinhoodDerivedHolding, 'fingerprint'>) {
  return {
    ...input,
    fingerprint: stableHash(
      [
        input.symbol,
        input.source,
        formatFingerprintNumber(input.shares),
        formatFingerprintNumber(input.averageCost),
        formatFingerprintNumber(input.costBasis),
        input.rowIds.join(','),
      ].join('|'),
    ),
  }
}

function getPositionStatus(
  shares: number | null,
  averageCost: number | null,
  costBasis: number | null,
): RobinhoodHoldingSyncStatus {
  if (shares === null) {
    return 'missing_shares'
  }

  if (shares <= 0) {
    return 'closed'
  }

  if (averageCost === null || costBasis === null) {
    return 'missing_basis'
  }

  return 'ready'
}

function getBuyCostBasis(row: RobinhoodNormalizedRow): number | null {
  if (row.costBasis !== null) {
    return row.costBasis
  }

  if (row.amount !== null && row.amount !== 0) {
    return Math.abs(row.amount)
  }

  if (row.quantity !== null && row.price !== null) {
    return row.quantity * row.price + row.fees
  }

  return null
}

function buildSellMatchKey(row: RobinhoodNormalizedRow): string {
  return [
    row.symbol,
    row.tradeDate,
    row.quantity === null ? '' : row.quantity.toFixed(6),
  ].join('|')
}

function formatNumberForInput(value: number): string {
  return String(Number(value.toFixed(6)))
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
