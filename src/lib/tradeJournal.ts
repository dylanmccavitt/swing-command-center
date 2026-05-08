import type { SeedWatchlistItem } from '../data/seedWatchlist'
import type { PortfolioSettings } from './portfolio'
import type { ProfitLockTicket } from './profitLock'
import { estimateTaxReserve } from './profitLock'
import type { TargetStopScenario } from './scenarioPlanner'

export const TRADE_JOURNAL_DISCLOSURE =
  'Manual checklist only. No broker credentials, no Robinhood connection, no order execution, and no automated trading. Tax review export is only a planning summary, not a filing document or tax advice.'

export type ManualTradeTicketSource = 'profit_lock' | 'trade_setup'

export type ManualTradeTicketStatus = 'ready' | 'needs_input'

export type ManualTradeTicket = {
  id: string
  source: ManualTradeTicketSource
  status: ManualTradeTicketStatus
  symbol: string
  name: string
  action: string
  estimatedShares: number | null
  estimatedCashRaised: number
  estimatedCashSpent: number
  estimatedRealizedGain: number
  taxReserveEstimate: number
  reason: string
  invalidation: string
  checklist: string[]
  disclosure: string
}

export type PayYourselfRule = {
  enabled: boolean
  percentOfNetAfterReserve: number
}

export type TradeJournalEntryStatus =
  | 'planned'
  | 'executed'
  | 'mistake'
  | 'result'

export type TradeJournalEntryType =
  | 'planned_trade'
  | 'executed_trade'
  | 'mistake'
  | 'result_review'

export type TradeJournalEntry = {
  id: string
  createdAt: string
  symbol: string
  name: string
  ticketId: string | null
  source: ManualTradeTicketSource | 'manual'
  type: TradeJournalEntryType
  status: TradeJournalEntryStatus
  action: string
  shares: number | null
  cashRaised: number
  cashSpent: number
  realizedProfitLoss: number
  taxReserveEstimate: number
  payYourselfAmount: number
  notes: string
  taxPrepNotes: string
}

export type RealizedProfitSummary = {
  entryCount: number
  plannedCount: number
  executedCount: number
  mistakeCount: number
  resultCount: number
  realizedEntryCount: number
  grossRealizedProfit: number
  realizedLoss: number
  netRealizedTradingProfit: number
  taxReserveEstimate: number
  profitAfterReserve: number
  recommendedPayYourselfAmount: number
  loggedPayYourselfAmount: number
  remainingPayYourselfAmount: number
  taxPrepEntryCount: number
}

export type TaxHelperExport = {
  schemaVersion: 'manual-trade-journal-v1'
  generatedAt: string
  disclosure: string
  guardrails: string[]
  payYourselfRule: PayYourselfRule
  summary: RealizedProfitSummary
  entries: TradeJournalEntry[]
}

export const DEFAULT_PAY_YOURSELF_RULE: PayYourselfRule = {
  enabled: true,
  percentOfNetAfterReserve: 5,
}

const TRADE_SETUP_NEEDS_INPUT_REASON =
  'Enter entry, shares, stop, and target before this becomes a usable checklist.'

export function buildManualTradeTicketFromProfitLock(input: {
  symbol: string
  name: string
  ticket: ProfitLockTicket
  invalidation?: string
}): ManualTradeTicket {
  const status: ManualTradeTicketStatus =
    input.ticket.status === 'ready' ? 'ready' : 'needs_input'

  return {
    id: `${input.symbol}-${input.ticket.id}`,
    source: 'profit_lock',
    status,
    symbol: input.symbol,
    name: input.name,
    action:
      status === 'ready'
        ? 'Review a possible trim / sale'
        : 'Needs more details',
    estimatedShares:
      input.ticket.sharesToSell > 0 ? input.ticket.sharesToSell : null,
    estimatedCashRaised: positiveAmount(input.ticket.estimatedProceeds),
    estimatedCashSpent: 0,
    estimatedRealizedGain: input.ticket.estimatedRealizedGain,
    taxReserveEstimate: input.ticket.estimatedTaxReserve,
    reason: `${input.ticket.title}. ${input.ticket.description}`,
    invalidation:
      input.invalidation?.trim() ||
      'Skip if shares, price, average cost, tax reserve, or target size changed before review.',
    checklist: [
      'Check the quote, shares, and average cost before doing anything.',
      'Check the reserve estimate and cash goal before entering anything in Robinhood.',
      'After any fill, record the actual price, realized P/L, and tax notes.',
    ],
    disclosure: TRADE_JOURNAL_DISCLOSURE,
  }
}

export function buildManualTradeTicketFromTradeSetup(input: {
  card: SeedWatchlistItem
  scenario: TargetStopScenario
  settings: Partial<PortfolioSettings>
}): ManualTradeTicket {
  const isCurrentHolding = input.card.seedType === 'current_holding'
  const plannedShares = getPlannedShares(input.scenario)
  const scaleOutShares = positiveNumberOrNull(input.scenario.trimShares.value)
  const entry = positiveNumberOrNull(input.scenario.plannedEntry.value)
  const estimatedCashSpent =
    !isCurrentHolding && plannedShares !== null && entry !== null
      ? plannedShares * entry
      : 0
  const estimatedCashRaised =
    isCurrentHolding && input.scenario.estimatedProceeds.value !== null
      ? positiveAmount(input.scenario.estimatedProceeds.value)
      : 0
  const estimatedRealizedGain =
    isCurrentHolding && input.scenario.estimatedGainLoss.value !== null
      ? input.scenario.estimatedGainLoss.value
      : 0
  const taxReserveEstimate = estimateTaxReserve(
    estimatedRealizedGain,
    input.settings,
  )
  const estimatedShares = isCurrentHolding ? scaleOutShares : plannedShares
  const status = isTradeSetupTicketReady(input.scenario, estimatedShares)
    ? 'ready'
    : 'needs_input'

  return {
    id: `${input.card.symbol}-trade-setup`,
    source: 'trade_setup',
    status,
    symbol: input.card.symbol,
    name: input.card.name,
    action: isCurrentHolding
      ? 'Review a possible scale-out'
      : 'Review a possible watchlist trade',
    estimatedShares,
    estimatedCashRaised,
    estimatedCashSpent,
    estimatedRealizedGain,
    taxReserveEstimate,
    reason: buildTradeSetupReason(input.card, input.scenario, status),
    invalidation: buildTradeSetupInvalidation(input.card, input.scenario),
    checklist: [
      'Check that the setup still matches the research notes.',
      'Verify entry, stop, target, and share size yourself.',
      'After any fill, use the journal to record what actually happened.',
    ],
    disclosure: TRADE_JOURNAL_DISCLOSURE,
  }
}

export function buildJournalEntryFromTicket(
  ticket: ManualTradeTicket,
  input: {
    createdAt: string
    status: TradeJournalEntryStatus
    id?: string
    realizedProfitLoss?: number
    taxReserveEstimate?: number
    payYourselfAmount?: number
    notes?: string
    taxPrepNotes?: string
  },
  payYourselfRule: Partial<PayYourselfRule> = DEFAULT_PAY_YOURSELF_RULE,
): TradeJournalEntry {
  const normalizedRule = normalizePayYourselfRule(payYourselfRule)
  const isRealizedStatus = isRealizedJournalStatus(input.status)
  const realizedProfitLoss =
    input.realizedProfitLoss ??
    (isRealizedStatus ? ticket.estimatedRealizedGain : 0)
  const taxReserveEstimate =
    input.taxReserveEstimate ??
    (isRealizedStatus ? positiveAmount(ticket.taxReserveEstimate) : 0)
  const payYourselfAmount =
    input.payYourselfAmount ??
    (isRealizedStatus
      ? estimatePayYourselfAmount(
          realizedProfitLoss,
          taxReserveEstimate,
          normalizedRule,
        )
      : 0)

  return {
    id:
      input.id ??
      `${ticket.id}-${input.status}-${input.createdAt.replace(/\D/g, '')}`,
    createdAt: input.createdAt,
    symbol: ticket.symbol,
    name: ticket.name,
    ticketId: ticket.id,
    source: ticket.source,
    type: getJournalEntryType(input.status),
    status: input.status,
    action: ticket.action,
    shares: ticket.estimatedShares,
    cashRaised: ticket.estimatedCashRaised,
    cashSpent: ticket.estimatedCashSpent,
    realizedProfitLoss,
    taxReserveEstimate,
    payYourselfAmount,
    notes:
      input.notes ??
      `${ticket.action}. Reason: ${ticket.reason}. Cancel if: ${ticket.invalidation}`,
    taxPrepNotes:
      input.taxPrepNotes ??
      'Planning entry only. Replace estimates with actual fill, lot, and broker statement details before tax review.',
  }
}

export function buildManualJournalEntry(input: {
  id: string
  createdAt: string
  symbol: string
  name: string
  status: TradeJournalEntryStatus
  action: string
  realizedProfitLoss?: number
  taxReserveEstimate?: number
  payYourselfAmount?: number
  notes?: string
  taxPrepNotes?: string
}): TradeJournalEntry {
  return {
    id: input.id,
    createdAt: input.createdAt,
    symbol: input.symbol,
    name: input.name,
    ticketId: null,
    source: 'manual',
    type: getJournalEntryType(input.status),
    status: input.status,
    action: input.action,
    shares: null,
    cashRaised: 0,
    cashSpent: 0,
    realizedProfitLoss: input.realizedProfitLoss ?? 0,
    taxReserveEstimate: positiveAmount(input.taxReserveEstimate ?? 0),
    payYourselfAmount: positiveAmount(input.payYourselfAmount ?? 0),
    notes: input.notes ?? '',
    taxPrepNotes: input.taxPrepNotes ?? '',
  }
}

export function buildRealizedProfitSummary(
  entries: readonly TradeJournalEntry[],
  payYourselfRule: Partial<PayYourselfRule> = DEFAULT_PAY_YOURSELF_RULE,
): RealizedProfitSummary {
  const realizedEntries = entries.filter((entry) =>
    isRealizedJournalStatus(entry.status),
  )
  const grossRealizedProfit = realizedEntries.reduce(
    (sum, entry) => sum + Math.max(0, entry.realizedProfitLoss),
    0,
  )
  const realizedLoss = realizedEntries.reduce(
    (sum, entry) => sum + Math.min(0, entry.realizedProfitLoss),
    0,
  )
  const netRealizedTradingProfit = realizedEntries.reduce(
    (sum, entry) => sum + entry.realizedProfitLoss,
    0,
  )
  const taxReserveEstimate = realizedEntries.reduce(
    (sum, entry) => sum + positiveAmount(entry.taxReserveEstimate),
    0,
  )
  const profitAfterReserve = Math.max(
    0,
    netRealizedTradingProfit - taxReserveEstimate,
  )
  const normalizedRule = normalizePayYourselfRule(payYourselfRule)
  const recommendedPayYourselfAmount = estimatePayYourselfAmount(
    netRealizedTradingProfit,
    taxReserveEstimate,
    normalizedRule,
  )
  const loggedPayYourselfAmount = entries.reduce(
    (sum, entry) => sum + positiveAmount(entry.payYourselfAmount),
    0,
  )

  return {
    entryCount: entries.length,
    plannedCount: entries.filter((entry) => entry.status === 'planned').length,
    executedCount: entries.filter((entry) => entry.status === 'executed')
      .length,
    mistakeCount: entries.filter((entry) => entry.status === 'mistake').length,
    resultCount: entries.filter((entry) => entry.status === 'result').length,
    realizedEntryCount: realizedEntries.length,
    grossRealizedProfit,
    realizedLoss,
    netRealizedTradingProfit,
    taxReserveEstimate,
    profitAfterReserve,
    recommendedPayYourselfAmount,
    loggedPayYourselfAmount,
    remainingPayYourselfAmount: Math.max(
      0,
      recommendedPayYourselfAmount - loggedPayYourselfAmount,
    ),
    taxPrepEntryCount: entries.filter((entry) => entry.taxPrepNotes.trim())
      .length,
  }
}

export function estimatePayYourselfAmount(
  realizedProfitLoss: number,
  taxReserveEstimate: number,
  rule: Partial<PayYourselfRule> = DEFAULT_PAY_YOURSELF_RULE,
): number {
  const normalizedRule = normalizePayYourselfRule(rule)

  if (!normalizedRule.enabled) {
    return 0
  }

  const availableProfit = Math.max(
    0,
    realizedProfitLoss - positiveAmount(taxReserveEstimate),
  )

  return availableProfit * (normalizedRule.percentOfNetAfterReserve / 100)
}

export function buildTaxHelperExport(input: {
  entries: readonly TradeJournalEntry[]
  payYourselfRule?: Partial<PayYourselfRule>
  generatedAt: string
}): TaxHelperExport {
  const payYourselfRule = normalizePayYourselfRule(input.payYourselfRule)
  const entries = input.entries.map((entry) => ({ ...entry }))

  return {
    schemaVersion: 'manual-trade-journal-v1',
    generatedAt: input.generatedAt,
    disclosure: TRADE_JOURNAL_DISCLOSURE,
    guardrails: [
      'Manual planning and review data only.',
      'No broker credentials, Robinhood integration, order execution, or automated trading.',
      'Not a filing document and not tax advice.',
    ],
    payYourselfRule,
    summary: buildRealizedProfitSummary(entries, payYourselfRule),
    entries,
  }
}

export function normalizePayYourselfRule(
  rule: Partial<PayYourselfRule> = DEFAULT_PAY_YOURSELF_RULE,
): PayYourselfRule {
  return {
    enabled: rule.enabled ?? DEFAULT_PAY_YOURSELF_RULE.enabled,
    percentOfNetAfterReserve: clamp(
      positiveAmount(
        rule.percentOfNetAfterReserve ??
          DEFAULT_PAY_YOURSELF_RULE.percentOfNetAfterReserve,
      ),
      0,
      100,
    ),
  }
}

function buildTradeSetupReason(
  card: SeedWatchlistItem,
  scenario: TargetStopScenario,
  status: ManualTradeTicketStatus,
): string {
  if (status === 'needs_input') {
    return TRADE_SETUP_NEEDS_INPUT_REASON
  }

  const reasonParts = [
    card.tradeSetup.entryTrigger
      ? `Entry idea: ${card.tradeSetup.entryTrigger}`
      : `Planned entry: ${formatMoney(scenario.plannedEntry.value)}`,
    card.tradeSetup.target
      ? `Target: ${card.tradeSetup.target}`
      : `First target: ${formatMoney(scenario.firstTarget.value)}`,
    card.tradeSetup.plannedScaleOut
      ? `Take-profit plan: ${card.tradeSetup.plannedScaleOut}`
      : `Estimated shares to trim: ${formatNumber(scenario.trimShares.value)}`,
    `Time horizon: ${scenario.timeHorizon}`,
  ]

  return reasonParts.join(' | ')
}

function buildTradeSetupInvalidation(
  card: SeedWatchlistItem,
  scenario: TargetStopScenario,
): string {
  if (card.tradeSetup.invalidation.trim()) {
    return card.tradeSetup.invalidation
  }

  if (card.research.invalidation.trim()) {
    return card.research.invalidation
  }

  if (scenario.stopLevel.value !== null) {
    return `Revisit if price breaks the manual stop/reference level near ${formatMoney(
      scenario.stopLevel.value,
    )}.`
  }

  return 'Pause if the thesis, price, source notes, or risk inputs change before you act.'
}

function isTradeSetupTicketReady(
  scenario: TargetStopScenario,
  estimatedShares: number | null,
): boolean {
  return (
    scenario.status !== 'invalid' &&
    positiveNumberOrNull(scenario.plannedEntry.value) !== null &&
    positiveNumberOrNull(scenario.stopLevel.value) !== null &&
    positiveNumberOrNull(scenario.firstTarget.value) !== null &&
    positiveNumberOrNull(estimatedShares) !== null
  )
}

function getPlannedShares(scenario: TargetStopScenario): number | null {
  const trimShares = positiveNumberOrNull(scenario.trimShares.value)
  const remainingShares = positiveNumberOrNull(scenario.remainingShares.value)

  if (trimShares !== null && remainingShares !== null) {
    return trimShares + remainingShares
  }

  return remainingShares ?? trimShares
}

function getJournalEntryType(
  status: TradeJournalEntryStatus,
): TradeJournalEntryType {
  switch (status) {
    case 'planned':
      return 'planned_trade'
    case 'executed':
      return 'executed_trade'
    case 'mistake':
      return 'mistake'
    case 'result':
      return 'result_review'
  }
}

function isRealizedJournalStatus(status: TradeJournalEntryStatus): boolean {
  return status === 'executed' || status === 'mistake' || status === 'result'
}

function positiveNumberOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function positiveAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function formatMoney(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `$${formatNumber(value)}`
    : 'unavailable'
}

function formatNumber(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 4,
        minimumFractionDigits: 0,
      }).format(value)
    : 'unavailable'
}
