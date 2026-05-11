import type { SeedHolding } from '../data/seedHoldings'
import {
  AI_STACK_LAYERS,
  type AiStackLayerId,
  type ResearchFields,
  type SeedWatchlistItem,
  type TradeSetupFields,
} from '../data/seedWatchlist'
import type {
  RobinhoodCsvReportKind,
  RobinhoodHoldingPeriod,
  RobinhoodImportBatch,
  RobinhoodNormalizedKind,
  RobinhoodNormalizedRow,
  RobinhoodReconciliationStatus,
  RobinhoodReviewState,
} from './robinhoodCsv'
import { buildRobinhoodRowFingerprint } from './robinhoodCsv'
import type {
  RobinhoodHoldingsReviewDecision,
  RobinhoodHoldingsReviewEntry,
  RobinhoodHoldingsReviewMap,
} from './robinhoodHoldingsSync'
import type { SellFillRecord, SellFillStatus } from './sellFills'
import type {
  TradeJournalEntry,
  TradeJournalEntryStatus,
  TradeJournalEntryType,
} from './tradeJournal'

export const SWING_LOCAL_PERSISTENCE_KEY =
  'swing-command-center.local-state.v1'
export const SWING_LOCAL_PERSISTENCE_SCHEMA_VERSION =
  'scc.swingLocalState.v1'

export type ManualLotInputs = Record<
  string,
  {
    shares: string
    averageCost: string
  }
>

export type SettingsForm = {
  maxPositionWeightPercent: string
  alertPositionWeightPercent: string
  taxReserveRatePercent: string
  taxReserveEnabled: boolean
  cashRunwayDollars: string
  activeTradingSleeveDollars: string
}

export type ResearchFiltersForm = {
  layer: AiStackLayerId | 'all'
  minimumScore: string
  holdingsOnly: boolean
  needsInputOnly: boolean
}

export type ScenarioPlannerForm = {
  currentPrice: string
  averageCost: string
  shares: string
  maxLossDollars: string
  desiredRiskReward: string
  targetGainPercent: string
  trimPercent: string
  supportPrice: string
  stopLimitBufferPercent: string
  timeHorizon: string
}

export type ScenarioPlannerFormMap = Record<
  string,
  Partial<ScenarioPlannerForm>
>

export type PayYourselfForm = {
  enabled: boolean
  percentOfNetAfterReserve: string
}

export type BuyingPowerForm = {
  startingCash: string
  manuallyReinvestedCash: string
}

export type SwingLocalState = {
  holdings: SeedHolding[]
  manualLots: ManualLotInputs
  settingsForm: SettingsForm
  cashTargetInput: string
  researchCards: SeedWatchlistItem[]
  selectedResearchSymbol: string
  researchFilters: ResearchFiltersForm
  selectedPlannerSymbol: string
  scenarioPlannerForms: ScenarioPlannerFormMap
  payYourselfForm: PayYourselfForm
  journalEntries: TradeJournalEntry[]
  sellFills: SellFillRecord[]
  robinhoodImports: RobinhoodImportBatch[]
  robinhoodRows: RobinhoodNormalizedRow[]
  robinhoodHoldingsReview: RobinhoodHoldingsReviewMap
  buyingPowerForm: BuyingPowerForm
}

export type SwingLocalStateSnapshot = {
  schemaVersion: typeof SWING_LOCAL_PERSISTENCE_SCHEMA_VERSION
  savedAt: string
  state: SwingLocalState
}

export type SwingLocalStateStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>

export type SwingLocalStateLoadResult =
  | {
      ok: true
      status: 'ready'
      snapshot: SwingLocalStateSnapshot
      message: string
      warnings: string[]
    }
  | {
      ok: false
      status: 'empty' | 'invalid' | 'unsupported' | 'unavailable' | 'error'
      message: string
      errors: string[]
      warnings: string[]
    }

export type SwingLocalStateSaveResult =
  | {
      ok: true
      status: 'saved'
      snapshot: SwingLocalStateSnapshot
      message: string
    }
  | {
      ok: false
      status: 'unavailable' | 'error'
      message: string
      errors: string[]
    }

export type SwingLocalStateClearResult =
  | {
      ok: true
      status: 'cleared'
      message: string
    }
  | {
      ok: false
      status: 'unavailable' | 'error'
      message: string
      errors: string[]
    }

type JsonObject = Record<string, unknown>

const REQUIRED_RESEARCH_FIELDS: readonly (keyof ResearchFields)[] = [
  'thesis',
  'catalyst',
  'invalidation',
  'riskNotes',
  'sourceNotes',
  'plannedEntry',
  'stop',
  'target',
  'reviewDate',
]

const REQUIRED_TRADE_SETUP_FIELDS: readonly (keyof TradeSetupFields)[] = [
  'entryTrigger',
  'stopLevel',
  'target',
  'maxLoss',
  'plannedScaleOut',
  'invalidation',
  'timeHorizon',
]

const SCENARIO_PLANNER_FIELDS: readonly (keyof ScenarioPlannerForm)[] = [
  'currentPrice',
  'averageCost',
  'shares',
  'maxLossDollars',
  'desiredRiskReward',
  'targetGainPercent',
  'trimPercent',
  'supportPrice',
  'stopLimitBufferPercent',
  'timeHorizon',
]

const AI_STACK_LAYER_IDS = new Set<string>(
  AI_STACK_LAYERS.map((layer) => layer.id),
)
const RESEARCH_FILTER_LAYERS = new Set<string>([
  'all',
  ...AI_STACK_LAYERS.map((layer) => layer.id),
])
const SEED_TYPES = new Set(['current_holding', 'placeholder'])
const SELL_FILL_STATUSES = new Set<SellFillStatus>([
  'planned',
  'ordered',
  'filled',
  'canceled',
  'reviewed',
])
const JOURNAL_STATUSES = new Set<TradeJournalEntryStatus>([
  'planned',
  'executed',
  'mistake',
  'result',
])
const JOURNAL_TYPES = new Set<TradeJournalEntryType>([
  'planned_trade',
  'executed_trade',
  'mistake',
  'result_review',
])
const JOURNAL_SOURCES = new Set(['profit_lock', 'trade_setup', 'manual'])
const ROBINHOOD_REPORT_KINDS = new Set<RobinhoodCsvReportKind>([
  'account_activity',
  'current_positions',
  'realized_gain_loss',
])
const ROBINHOOD_ROW_KINDS = new Set<RobinhoodNormalizedKind>([
  'buy',
  'sell',
  'position',
  'corporate_action',
  'dividend',
  'interest',
  'transfer',
  'fee',
  'unknown',
])
const ROBINHOOD_RECONCILIATION_STATUSES =
  new Set<RobinhoodReconciliationStatus>([
    'matched',
    'needs_review',
    'missing_basis',
    'missing_proceeds',
    'possible_wash_sale',
    'unsupported_row',
  ])
const ROBINHOOD_REVIEW_STATES = new Set<RobinhoodReviewState>([
  'needs_review',
  'accepted',
  'rejected',
])
const ROBINHOOD_HOLDINGS_REVIEW_DECISIONS =
  new Set<RobinhoodHoldingsReviewDecision>([
    'needs_review',
    'applied',
    'rejected',
  ])
const ROBINHOOD_HOLDING_PERIODS = new Set<RobinhoodHoldingPeriod>([
  'short_term',
  'long_term',
  'unknown',
])

export function buildSwingLocalStateSnapshot(
  state: SwingLocalState,
  savedAt = new Date().toISOString(),
): SwingLocalStateSnapshot {
  return {
    schemaVersion: SWING_LOCAL_PERSISTENCE_SCHEMA_VERSION,
    savedAt,
    state: cloneJson(state),
  }
}

export function serializeSwingLocalState(
  snapshot: SwingLocalStateSnapshot,
): string {
  return JSON.stringify(snapshot)
}

export function parseSwingLocalStateSnapshot(
  text: string,
  defaults: SwingLocalState,
): SwingLocalStateLoadResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      status: 'invalid',
      message: 'Saved local state is not valid JSON.',
      errors: [getErrorMessage(error, 'Saved local state is not valid JSON.')],
      warnings: [],
    }
  }

  return normalizeSwingLocalStateSnapshot(parsed, defaults)
}

export function loadSwingLocalState(
  storage: SwingLocalStateStorage | null | undefined,
  defaults: SwingLocalState,
): SwingLocalStateLoadResult {
  if (!storage) {
    return {
      ok: false,
      status: 'unavailable',
      message: 'Local browser storage is unavailable in this environment.',
      errors: ['localStorage is unavailable.'],
      warnings: [],
    }
  }

  try {
    const stored = storage.getItem(SWING_LOCAL_PERSISTENCE_KEY)

    if (stored === null) {
      return {
        ok: false,
        status: 'empty',
        message: 'No saved local cockpit state found.',
        errors: [],
        warnings: [],
      }
    }

    return parseSwingLocalStateSnapshot(stored, defaults)
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: 'Saved local state could not be read.',
      errors: [getErrorMessage(error, 'Saved local state could not be read.')],
      warnings: [],
    }
  }
}

export function saveSwingLocalState(
  storage: SwingLocalStateStorage | null | undefined,
  state: SwingLocalState,
  savedAt = new Date().toISOString(),
): SwingLocalStateSaveResult {
  if (!storage) {
    return {
      ok: false,
      status: 'unavailable',
      message: 'Local browser storage is unavailable in this environment.',
      errors: ['localStorage is unavailable.'],
    }
  }

  try {
    const snapshot = buildSwingLocalStateSnapshot(state, savedAt)
    storage.setItem(
      SWING_LOCAL_PERSISTENCE_KEY,
      serializeSwingLocalState(snapshot),
    )

    return {
      ok: true,
      status: 'saved',
      snapshot,
      message: `Saved local cockpit state at ${snapshot.savedAt}.`,
    }
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: 'Local cockpit state could not be saved.',
      errors: [getErrorMessage(error, 'Local cockpit state could not be saved.')],
    }
  }
}

export function clearSwingLocalState(
  storage: SwingLocalStateStorage | null | undefined,
): SwingLocalStateClearResult {
  if (!storage) {
    return {
      ok: false,
      status: 'unavailable',
      message: 'Local browser storage is unavailable in this environment.',
      errors: ['localStorage is unavailable.'],
    }
  }

  try {
    storage.removeItem(SWING_LOCAL_PERSISTENCE_KEY)

    return {
      ok: true,
      status: 'cleared',
      message: 'Saved local cockpit state was cleared.',
    }
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: 'Saved local cockpit state could not be cleared.',
      errors: [
        getErrorMessage(error, 'Saved local cockpit state could not be cleared.'),
      ],
    }
  }
}

function normalizeSwingLocalStateSnapshot(
  value: unknown,
  defaults: SwingLocalState,
): SwingLocalStateLoadResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isObject(value)) {
    return {
      ok: false,
      status: 'invalid',
      message: 'Saved local state is not an object.',
      errors: ['Saved local state is not an object.'],
      warnings,
    }
  }

  if (value.schemaVersion !== SWING_LOCAL_PERSISTENCE_SCHEMA_VERSION) {
    return {
      ok: false,
      status: 'unsupported',
      message: 'Saved local state uses an unsupported version.',
      errors: [
        `Expected ${SWING_LOCAL_PERSISTENCE_SCHEMA_VERSION}, got ${String(
          value.schemaVersion,
        )}.`,
      ],
      warnings,
    }
  }

  const savedAt = isString(value.savedAt) ? value.savedAt : ''

  if (!isIsoLikeDate(savedAt)) {
    errors.push('savedAt must be an ISO timestamp string.')
  }

  if (!isObject(value.state)) {
    return {
      ok: false,
      status: 'invalid',
      message: 'Saved local state is missing the state object.',
      errors: ['state must be an object.'],
      warnings,
    }
  }

  const state = value.state
  const holdings = normalizeArray(
    state.holdings,
    'holdings',
    isSeedHolding,
    errors,
  )
  const manualLots = normalizeManualLots(state.manualLots, errors)
  const settingsForm = normalizeSettingsForm(
    state.settingsForm,
    defaults.settingsForm,
    errors,
    warnings,
  )
  const cashTargetInput = normalizeOptionalString(
    state.cashTargetInput,
    defaults.cashTargetInput,
    'cashTargetInput',
    errors,
    warnings,
  )
  const researchCards = normalizeArray(
    state.researchCards,
    'researchCards',
    isSeedWatchlistItem,
    errors,
  )
  const selectedResearchSymbol = normalizeOptionalString(
    state.selectedResearchSymbol,
    defaults.selectedResearchSymbol,
    'selectedResearchSymbol',
    errors,
    warnings,
  )
  const researchFilters = normalizeResearchFilters(
    state.researchFilters,
    defaults.researchFilters,
    errors,
    warnings,
  )
  const selectedPlannerSymbol = normalizeOptionalString(
    state.selectedPlannerSymbol,
    defaults.selectedPlannerSymbol,
    'selectedPlannerSymbol',
    errors,
    warnings,
  )
  const scenarioPlannerForms = normalizeScenarioPlannerForms(
    state.scenarioPlannerForms,
    defaults.scenarioPlannerForms,
    errors,
    warnings,
  )
  const payYourselfForm = normalizePayYourselfForm(
    state.payYourselfForm,
    defaults.payYourselfForm,
    errors,
    warnings,
  )
  const journalEntries = normalizeArray(
    state.journalEntries,
    'journalEntries',
    isTradeJournalEntry,
    errors,
  )
  const sellFills = normalizeArray(
    state.sellFills,
    'sellFills',
    isSellFillRecord,
    errors,
  )
  const robinhoodImports = normalizeArray(
    state.robinhoodImports,
    'robinhoodImports',
    isRobinhoodImportBatch,
    errors,
  )
  const robinhoodRows = normalizeRobinhoodRows(state.robinhoodRows, errors)
  const robinhoodHoldingsReview = normalizeRobinhoodHoldingsReview(
    state.robinhoodHoldingsReview,
    defaults.robinhoodHoldingsReview,
    errors,
    warnings,
  )
  const buyingPowerForm = normalizeBuyingPowerForm(
    state.buyingPowerForm,
    defaults.buyingPowerForm,
    errors,
    warnings,
  )

  if (
    !holdings ||
    !manualLots ||
    !researchCards ||
    !journalEntries ||
    !sellFills ||
    !robinhoodImports ||
    !robinhoodRows ||
    errors.length > 0
  ) {
    return {
      ok: false,
      status: 'invalid',
      message: 'Saved local state failed validation and was not loaded.',
      errors,
      warnings,
    }
  }

  return {
    ok: true,
    status: 'ready',
    snapshot: {
      schemaVersion: SWING_LOCAL_PERSISTENCE_SCHEMA_VERSION,
      savedAt,
      state: {
        holdings,
        manualLots,
        settingsForm,
        cashTargetInput,
        researchCards: mergeDefaultResearchCards(
          defaults.researchCards,
          researchCards,
        ),
        selectedResearchSymbol,
        researchFilters,
        selectedPlannerSymbol,
        scenarioPlannerForms,
        payYourselfForm,
        journalEntries,
        sellFills,
        robinhoodImports,
        robinhoodRows,
        robinhoodHoldingsReview,
        buyingPowerForm,
      },
    },
    message: 'Saved local cockpit state loaded.',
    warnings,
  }
}

function mergeDefaultResearchCards(
  defaults: readonly SeedWatchlistItem[],
  cards: readonly SeedWatchlistItem[],
): SeedWatchlistItem[] {
  const seenSymbols = new Set(cards.map((card) => card.symbol))

  return cloneJson([
    ...cards,
    ...defaults.filter((card) => !seenSymbols.has(card.symbol)),
  ])
}

function normalizeArray<T>(
  value: unknown,
  name: string,
  isItem: (item: unknown) => item is T,
  errors: string[],
): T[] | null {
  if (!Array.isArray(value)) {
    errors.push(`${name} must be an array.`)
    return null
  }

  const invalidIndex = value.findIndex((item) => !isItem(item))

  if (invalidIndex !== -1) {
    errors.push(`${name}[${invalidIndex}] is invalid.`)
    return null
  }

  return cloneJson(value as T[])
}

function normalizeManualLots(
  value: unknown,
  errors: string[],
): ManualLotInputs | null {
  if (!isObject(value)) {
    errors.push('manualLots must be an object keyed by symbol.')
    return null
  }

  const entries: ManualLotInputs = {}

  for (const [symbol, lot] of Object.entries(value)) {
    if (
      !isObject(lot) ||
      !isString(lot.shares) ||
      !isString(lot.averageCost)
    ) {
      errors.push(`manualLots.${symbol} must include shares and averageCost.`)
      return null
    }

    entries[normalizeSymbol(symbol)] = {
      shares: lot.shares,
      averageCost: lot.averageCost,
    }
  }

  return entries
}

function normalizeSettingsForm(
  value: unknown,
  defaults: SettingsForm,
  errors: string[],
  warnings: string[],
): SettingsForm {
  if (value === undefined) {
    warnings.push('settingsForm missing; default rules were used.')
    return cloneJson(defaults)
  }

  if (
    !isObject(value) ||
    !isString(value.maxPositionWeightPercent) ||
    !isString(value.alertPositionWeightPercent) ||
    !isString(value.taxReserveRatePercent) ||
    !isBoolean(value.taxReserveEnabled) ||
    !isString(value.cashRunwayDollars) ||
    !isString(value.activeTradingSleeveDollars)
  ) {
    errors.push('settingsForm is invalid.')
    return cloneJson(defaults)
  }

  return {
    maxPositionWeightPercent: value.maxPositionWeightPercent,
    alertPositionWeightPercent: value.alertPositionWeightPercent,
    taxReserveRatePercent: value.taxReserveRatePercent,
    taxReserveEnabled: value.taxReserveEnabled,
    cashRunwayDollars: value.cashRunwayDollars,
    activeTradingSleeveDollars: value.activeTradingSleeveDollars,
  }
}

function normalizeResearchFilters(
  value: unknown,
  defaults: ResearchFiltersForm,
  errors: string[],
  warnings: string[],
): ResearchFiltersForm {
  if (value === undefined) {
    warnings.push('researchFilters missing; default filters were used.')
    return cloneJson(defaults)
  }

  if (
    !isObject(value) ||
    !isString(value.layer) ||
    !RESEARCH_FILTER_LAYERS.has(value.layer) ||
    !isString(value.minimumScore) ||
    !isBoolean(value.holdingsOnly) ||
    !isBoolean(value.needsInputOnly)
  ) {
    errors.push('researchFilters is invalid.')
    return cloneJson(defaults)
  }

  return {
    layer: value.layer as ResearchFiltersForm['layer'],
    minimumScore: value.minimumScore,
    holdingsOnly: value.holdingsOnly,
    needsInputOnly: value.needsInputOnly,
  }
}

function normalizeScenarioPlannerForms(
  value: unknown,
  defaults: ScenarioPlannerFormMap,
  errors: string[],
  warnings: string[],
): ScenarioPlannerFormMap {
  if (value === undefined) {
    warnings.push('scenarioPlannerForms missing; default planner forms were used.')
    return cloneJson(defaults)
  }

  if (!isObject(value)) {
    errors.push('scenarioPlannerForms must be an object keyed by symbol.')
    return cloneJson(defaults)
  }

  const forms: ScenarioPlannerFormMap = {}

  for (const [symbol, rawForm] of Object.entries(value)) {
    if (!isObject(rawForm)) {
      errors.push(`scenarioPlannerForms.${symbol} must be an object.`)
      continue
    }

    const form: Partial<ScenarioPlannerForm> = {}

    for (const field of SCENARIO_PLANNER_FIELDS) {
      const fieldValue = rawForm[field]

      if (fieldValue === undefined) {
        continue
      }

      if (!isString(fieldValue)) {
        errors.push(`scenarioPlannerForms.${symbol}.${field} must be a string.`)
        continue
      }

      form[field] = fieldValue
    }

    forms[normalizeSymbol(symbol)] = form
  }

  return forms
}

function normalizePayYourselfForm(
  value: unknown,
  defaults: PayYourselfForm,
  errors: string[],
  warnings: string[],
): PayYourselfForm {
  if (value === undefined) {
    warnings.push('payYourselfForm missing; default pay-yourself rule was used.')
    return cloneJson(defaults)
  }

  if (
    !isObject(value) ||
    !isBoolean(value.enabled) ||
    !isString(value.percentOfNetAfterReserve)
  ) {
    errors.push('payYourselfForm is invalid.')
    return cloneJson(defaults)
  }

  return {
    enabled: value.enabled,
    percentOfNetAfterReserve: value.percentOfNetAfterReserve,
  }
}

function normalizeBuyingPowerForm(
  value: unknown,
  defaults: BuyingPowerForm,
  errors: string[],
  warnings: string[],
): BuyingPowerForm {
  if (value === undefined) {
    warnings.push('buyingPowerForm missing; default buying-power inputs were used.')
    return cloneJson(defaults)
  }

  if (
    !isObject(value) ||
    !isString(value.startingCash) ||
    !isString(value.manuallyReinvestedCash)
  ) {
    errors.push('buyingPowerForm is invalid.')
    return cloneJson(defaults)
  }

  return {
    startingCash: value.startingCash,
    manuallyReinvestedCash: value.manuallyReinvestedCash,
  }
}

function normalizeOptionalString(
  value: unknown,
  fallback: string,
  name: string,
  errors: string[],
  warnings: string[],
): string {
  if (value === undefined) {
    warnings.push(`${name} missing; default value was used.`)
    return fallback
  }

  if (!isString(value)) {
    errors.push(`${name} must be a string.`)
    return fallback
  }

  return value
}

function normalizeRobinhoodRows(
  value: unknown,
  errors: string[],
): RobinhoodNormalizedRow[] | null {
  if (!Array.isArray(value)) {
    errors.push('robinhoodRows must be an array.')
    return null
  }

  const rows: RobinhoodNormalizedRow[] = []

  for (const [index, item] of value.entries()) {
    const row = normalizeRobinhoodRow(item)

    if (!row) {
      errors.push(`robinhoodRows[${index}] is invalid.`)
      return null
    }

    rows.push(row)
  }

  return cloneJson(rows)
}

function normalizeRobinhoodHoldingsReview(
  value: unknown,
  defaults: RobinhoodHoldingsReviewMap,
  errors: string[],
  warnings: string[],
): RobinhoodHoldingsReviewMap {
  if (value === undefined) {
    warnings.push(
      'robinhoodHoldingsReview missing; default review state was used.',
    )
    return cloneJson(defaults)
  }

  if (!isObject(value)) {
    errors.push('robinhoodHoldingsReview must be an object keyed by symbol.')
    return cloneJson(defaults)
  }

  const review: RobinhoodHoldingsReviewMap = {}

  for (const [symbol, entry] of Object.entries(value)) {
    if (!isRobinhoodHoldingsReviewEntry(entry)) {
      errors.push(`robinhoodHoldingsReview.${symbol} is invalid.`)
      continue
    }

    review[normalizeSymbol(symbol)] = cloneJson(entry)
  }

  return review
}

function isSeedHolding(value: unknown): value is SeedHolding {
  return (
    isObject(value) &&
    isNonEmptyString(value.symbol) &&
    isNonEmptyString(value.name) &&
    isString(value.stackLayer) &&
    isString(value.thesisTag) &&
    isNullableNumber(value.shares) &&
    isNullableNumber(value.averageCost)
  )
}

function isSeedWatchlistItem(value: unknown): value is SeedWatchlistItem {
  return (
    isObject(value) &&
    isNonEmptyString(value.symbol) &&
    isNonEmptyString(value.name) &&
    isString(value.stackLayer) &&
    AI_STACK_LAYER_IDS.has(value.stackLayer) &&
    isString(value.seedType) &&
    SEED_TYPES.has(value.seedType) &&
    isResearchFields(value.research) &&
    isTradeSetupFields(value.tradeSetup)
  )
}

function isResearchFields(value: unknown): value is ResearchFields {
  return (
    isObject(value) &&
    REQUIRED_RESEARCH_FIELDS.every((field) => isString(value[field]))
  )
}

function isTradeSetupFields(value: unknown): value is TradeSetupFields {
  return (
    isObject(value) &&
    REQUIRED_TRADE_SETUP_FIELDS.every((field) => isString(value[field]))
  )
}

function isTradeJournalEntry(value: unknown): value is TradeJournalEntry {
  return (
    isObject(value) &&
    isNonEmptyString(value.id) &&
    isIsoLikeDate(value.createdAt) &&
    isNonEmptyString(value.symbol) &&
    isString(value.name) &&
    (isString(value.ticketId) || value.ticketId === null) &&
    isString(value.source) &&
    JOURNAL_SOURCES.has(value.source) &&
    isString(value.type) &&
    JOURNAL_TYPES.has(value.type as TradeJournalEntryType) &&
    isString(value.status) &&
    JOURNAL_STATUSES.has(value.status as TradeJournalEntryStatus) &&
    isString(value.action) &&
    isNullableNumber(value.shares) &&
    isNumber(value.cashRaised) &&
    isNumber(value.cashSpent) &&
    isNumber(value.realizedProfitLoss) &&
    isNumber(value.taxReserveEstimate) &&
    isNumber(value.payYourselfAmount) &&
    isString(value.notes) &&
    isString(value.taxPrepNotes)
  )
}

function isSellFillRecord(value: unknown): value is SellFillRecord {
  return (
    isObject(value) &&
    isNonEmptyString(value.id) &&
    isString(value.status) &&
    SELL_FILL_STATUSES.has(value.status as SellFillStatus) &&
    isNonEmptyString(value.symbol) &&
    isNullableNumber(value.sharesSold) &&
    isNullableNumber(value.fillPrice) &&
    isNullableNumber(value.averageCost) &&
    isNullableNumber(value.costBasis) &&
    isString(value.filledDate) &&
    isNumber(value.fees) &&
    isString(value.source) &&
    isString(value.reference) &&
    isString(value.notes)
  )
}

function isRobinhoodImportBatch(
  value: unknown,
): value is RobinhoodImportBatch {
  return (
    isObject(value) &&
    isNonEmptyString(value.id) &&
    isString(value.fileName) &&
    isIsoLikeDate(value.importedAt) &&
    isString(value.reportKind) &&
    ROBINHOOD_REPORT_KINDS.has(value.reportKind as RobinhoodCsvReportKind) &&
    isNumber(value.rowCount) &&
    value.source === 'robinhood_csv_file'
  )
}

function normalizeRobinhoodRow(value: unknown): RobinhoodNormalizedRow | null {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.batchId) ||
    !isString(value.reportKind) ||
    !ROBINHOOD_REPORT_KINDS.has(value.reportKind as RobinhoodCsvReportKind) ||
    !isNumber(value.sourceRowIndex) ||
    !isString(value.kind) ||
    !ROBINHOOD_ROW_KINDS.has(value.kind as RobinhoodNormalizedKind) ||
    !isString(value.symbol) ||
    !isString(value.description) ||
    !isString(value.activityType) ||
    !isString(value.tradeDate) ||
    !isString(value.settleDate) ||
    !isNullableNumber(value.quantity) ||
    !isNullableNumber(value.price) ||
    !isNullableNumber(value.averageCost ?? null) ||
    !isNullableNumber(value.amount) ||
    !isNullableNumber(value.proceeds) ||
    !isNullableNumber(value.costBasis) ||
    !isNullableNumber(value.realizedGainLoss) ||
    !isString(value.holdingPeriod) ||
    !ROBINHOOD_HOLDING_PERIODS.has(
      value.holdingPeriod as RobinhoodHoldingPeriod,
    ) ||
    !isNumber(value.washSaleLossDisallowed) ||
    !isNumber(value.fees) ||
    !isString(value.reconciliationStatus) ||
    !ROBINHOOD_RECONCILIATION_STATUSES.has(
      value.reconciliationStatus as RobinhoodReconciliationStatus,
    ) ||
    !isString(value.reviewState) ||
    !ROBINHOOD_REVIEW_STATES.has(value.reviewState as RobinhoodReviewState) ||
    !isStringArray(value.reconciliationNotes) ||
    !isStringRecord(value.raw)
  ) {
    return null
  }

  const checked = value as RobinhoodNormalizedRow & {
    averageCost?: number | null
    fingerprint?: string
  }
  const row: RobinhoodNormalizedRow = {
    id: checked.id,
    fingerprint: isNonEmptyString(checked.fingerprint)
      ? checked.fingerprint
      : '',
    batchId: checked.batchId,
    reportKind: checked.reportKind,
    sourceRowIndex: checked.sourceRowIndex,
    kind: checked.kind,
    symbol: checked.symbol,
    description: checked.description,
    activityType: checked.activityType,
    tradeDate: checked.tradeDate,
    settleDate: checked.settleDate,
    quantity: checked.quantity,
    price: checked.price,
    averageCost: checked.averageCost ?? null,
    amount: checked.amount,
    proceeds: checked.proceeds,
    costBasis: checked.costBasis,
    realizedGainLoss: checked.realizedGainLoss,
    holdingPeriod: checked.holdingPeriod,
    washSaleLossDisallowed: checked.washSaleLossDisallowed,
    fees: checked.fees,
    reconciliationStatus: checked.reconciliationStatus,
    reviewState: checked.reviewState,
    reconciliationNotes: checked.reconciliationNotes,
    raw: checked.raw,
  }
  const fingerprint = row.fingerprint || buildRobinhoodRowFingerprint(row)

  return {
    ...row,
    fingerprint,
    id: row.fingerprint ? row.id : `robinhood-row-${fingerprint}`,
  }
}

function isRobinhoodHoldingsReviewEntry(
  value: unknown,
): value is RobinhoodHoldingsReviewEntry {
  return (
    isObject(value) &&
    isNonEmptyString(value.symbol) &&
    isNonEmptyString(value.fingerprint) &&
    isString(value.decision) &&
    ROBINHOOD_HOLDINGS_REVIEW_DECISIONS.has(
      value.decision as RobinhoodHoldingsReviewDecision,
    ) &&
    isIsoLikeDate(value.updatedAt) &&
    (isIsoLikeDate(value.appliedAt) || value.appliedAt === null) &&
    (value.source === 'current_positions_csv' ||
      value.source === 'account_activity_ledger') &&
    isNullableNumber(value.shares) &&
    isNullableNumber(value.averageCost) &&
    isNullableNumber(value.costBasis) &&
    isStringArray(value.rowIds)
  )
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isObject(value) && Object.values(value).every(isString)
}

function isIsoLikeDate(value: unknown): value is string {
  return isString(value) && !Number.isNaN(Date.parse(value))
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
