import {
  getAiStackLayerLabel,
  type ResearchFields,
  type SeedWatchlistItem,
  type TradeSetupFields,
} from '../data/seedWatchlist'
import {
  RESEARCH_DRAFT_DISCLOSURE,
  type ResearchDraft,
  type ResearchSource,
  type ResearchSourceFreshness,
  type ResearchSourceType,
} from './researchProvider'

export const CODEX_RESEARCH_REQUEST_SCHEMA_VERSION =
  'scc.codexResearchRequest.v1'
export const CODEX_RESEARCH_RESULT_SCHEMA_VERSION =
  'scc.codexResearchResult.v1'
export const CODEX_RESEARCH_QUEUE_ROOT = 'research-queue'
export const CODEX_RESEARCH_REQUEST_DIR = `${CODEX_RESEARCH_QUEUE_ROOT}/requests`
export const CODEX_RESEARCH_RESULT_DIR = `${CODEX_RESEARCH_QUEUE_ROOT}/results`
export const CODEX_RESEARCH_WORKER_DOC =
  'docs/codex-research-worker.md'

export const CODEX_RESEARCH_QUEUE_GUARDRAILS = [
  'Use browser, Chrome, ChatGPT, or Deep Research manually; do not call OpenAI APIs from this app.',
  'Do not include API keys, brokerage credentials, account numbers, private holdings, or copied paywalled article text.',
  'Do not log in to brokerage accounts, scrape brokerage data, place orders, or automate trading.',
  'Return a short stock brief for manual review only. Report analyst ratings, target prices, and option strike context from sources; do not make your own rating or buy/sell instructions.',
  'Use source URLs, accessed timestamps, and short source notes so the user can verify every claim.',
] as const

export type CodexResearchRequestedField =
  | 'thesis'
  | 'catalyst'
  | 'invalidation'
  | 'riskNotes'
  | 'sourceNotes'
  | 'plannedEntry'
  | 'stop'
  | 'target'
  | 'reviewDate'

export type CodexResearchRequest = {
  schemaVersion: typeof CODEX_RESEARCH_REQUEST_SCHEMA_VERSION
  requestId: string
  createdAt: string
  symbol: string
  companyName: string
  stackLayer: SeedWatchlistItem['stackLayer']
  layerLabel: string
  currentCard: {
    research: ResearchFields
    tradeSetup: TradeSetupFields
  }
  researchDesk: CodexResearchDeskContext
  requestedOutput: {
    schemaVersion: typeof CODEX_RESEARCH_RESULT_SCHEMA_VERSION
    fields: CodexResearchRequestedField[]
    sourceMetadata: CodexResearchSourceMetadataField[]
  }
  guardrails: string[]
  workerPromptPath: typeof CODEX_RESEARCH_WORKER_DOC
  expectedResultPath: string
  disclosure: typeof RESEARCH_DRAFT_DISCLOSURE
}

export type CodexResearchSourceMetadataField =
  | 'id'
  | 'type'
  | 'title'
  | 'url'
  | 'publisher'
  | 'accessedAt'
  | 'publishedAt'
  | 'notes'

export type CodexResearchSourceChecklistId =
  | 'company_primary'
  | 'filings_or_regulatory'
  | 'recent_news'
  | 'analyst_context'
  | 'sector_or_peer_context'
  | 'price_setup_context'

export type CodexResearchImportChecklistId =
  | 'catalyst'
  | 'invalidation'
  | 'target_stop_context'
  | 'review_state'
  | 'source_metadata'

export type CodexResearchChecklistItem<TId extends string> = {
  id: TId
  label: string
  required: boolean
  notes: string
}

export type CodexResearchDeskContext = {
  mode: 'daily_manual_research_desk'
  subject: string
  laneLabel: string
  workerGoal: string
  sourceChecklist: CodexResearchChecklistItem<CodexResearchSourceChecklistId>[]
  importChecklist: CodexResearchChecklistItem<CodexResearchImportChecklistId>[]
}

export type CodexResearchResultSource = {
  id: string
  type: ResearchSourceType
  title: string
  url: string
  publisher: string
  accessedAt: string
  publishedAt: string | null
  notes: string
}

export type CodexResearchResultFields = Pick<
  ResearchFields,
  | 'thesis'
  | 'catalyst'
  | 'invalidation'
  | 'riskNotes'
  | 'sourceNotes'
  | 'plannedEntry'
  | 'stop'
  | 'target'
  | 'reviewDate'
>

export type CodexResearchResult = {
  schemaVersion: typeof CODEX_RESEARCH_RESULT_SCHEMA_VERSION
  requestId: string
  symbol: string
  companyName: string
  draftedAt: string
  reviewState: 'needs_review'
  disclosure: typeof RESEARCH_DRAFT_DISCLOSURE
  fields: CodexResearchResultFields
  sources: CodexResearchResultSource[]
}

export type CodexResearchValidationResult =
  | {
      ok: true
      result: CodexResearchResult
      draft: ResearchDraft
      sources: ResearchSource[]
    }
  | {
      ok: false
      errors: string[]
    }

export type CodexResearchResultValidationOptions = {
  expectedRequestId?: string
  expectedSymbol?: string
}

export type CodexResearchSourceMetadataSummary = {
  total: number
  fresh: number
  stale: number
  latestAccessedAt: string | null
  typeCounts: Partial<Record<ResearchSourceType, number>>
}

type ValidCodexResearchValidation = Extract<
  CodexResearchValidationResult,
  { ok: true }
>

export type CodexResearchImportUpdate = {
  card: SeedWatchlistItem
  reviewState: 'needs_review'
  sourceSummary: CodexResearchSourceMetadataSummary
  updatedFields: CodexResearchRequestedField[]
  message: string
}

const REQUESTED_FIELDS: CodexResearchRequestedField[] = [
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

const SOURCE_METADATA_FIELDS: CodexResearchSourceMetadataField[] = [
  'id',
  'type',
  'title',
  'url',
  'publisher',
  'accessedAt',
  'publishedAt',
  'notes',
]

const RESEARCH_SOURCE_TYPES: ResearchSourceType[] = [
  'recent_news',
  'investor_relations',
  'sec_filings',
  'earnings_call',
  'sector_context',
  'analyst_context',
]

export const CODEX_RESEARCH_SOURCE_CHECKLIST: CodexResearchChecklistItem<CodexResearchSourceChecklistId>[] =
  [
    {
      id: 'company_primary',
      label: 'Company primary source',
      required: true,
      notes:
        'Use investor relations, shareholder letters, presentations, earnings releases, or company news pages when available.',
    },
    {
      id: 'filings_or_regulatory',
      label: 'Filing or regulatory source',
      required: true,
      notes:
        'Use SEC filings or relevant regulatory material. For HIMS/general healthcare names, include policy or platform risk when sourced.',
    },
    {
      id: 'recent_news',
      label: 'Recent news',
      required: true,
      notes:
        'Check current public news for catalysts, guidance changes, product updates, or risk events.',
    },
    {
      id: 'analyst_context',
      label: 'Analyst context',
      required: false,
      notes:
        'Report source-stated ratings, target-price ranges, revisions, and dates without creating an app rating.',
    },
    {
      id: 'sector_or_peer_context',
      label: 'Sector or peer context',
      required: false,
      notes:
        'Use relevant industry, peer, macro, or category context instead of assuming the ticker is part of the AI stack.',
    },
    {
      id: 'price_setup_context',
      label: 'Price setup context',
      required: false,
      notes:
        'Use source-reported price context, moving averages, support/resistance, or option strike context only as review inputs.',
    },
  ]

export const CODEX_RESEARCH_IMPORT_CHECKLIST: CodexResearchChecklistItem<CodexResearchImportChecklistId>[] =
  [
    {
      id: 'catalyst',
      label: 'Catalyst',
      required: true,
      notes: 'Concrete events or data points to review next.',
    },
    {
      id: 'invalidation',
      label: 'Invalidation',
      required: true,
      notes: 'What would force a thesis rewrite or make the setup unusable.',
    },
    {
      id: 'target_stop_context',
      label: 'Target and stop context',
      required: true,
      notes:
        'Source-backed target, stop, entry, and risk context without buy/sell instructions.',
    },
    {
      id: 'review_state',
      label: 'Review state',
      required: true,
      notes: 'Imported files must remain needs_review until the user marks them reviewed.',
    },
    {
      id: 'source_metadata',
      label: 'Source metadata',
      required: true,
      notes: 'Every claim should map back to a URL, publisher, accessed timestamp, and note.',
    },
  ]

const PROHIBITED_RECOMMENDATION_PATTERNS = [
  /\b(buy|sell)\s+(now|shares?|the stock|this stock|this name)\b/i,
  /\b(recommend|recommendation)\s+(buying|selling|a buy|a sell|buy|sell)\b/i,
  /\byou\s+should\s+(buy|sell|enter|exit|trim|short|add|reduce)\b/i,
  /\b(set|place)\s+(a\s+)?(stop|stop-loss)\b/i,
  /\b(our|my|the app)\s+target\b/i,
  /\b(guaranteed|risk-free)\b/i,
  /\b(will definitely|cannot lose|sure thing)\b/i,
]

export function buildCodexResearchRequest(
  card: SeedWatchlistItem,
  options: { createdAt?: Date } = {},
): CodexResearchRequest {
  const createdAt = options.createdAt ?? new Date()
  const normalizedSymbol = normalizeSymbol(card.symbol)
  const requestId = buildRequestId(normalizedSymbol, createdAt)

  return {
    schemaVersion: CODEX_RESEARCH_REQUEST_SCHEMA_VERSION,
    requestId,
    createdAt: createdAt.toISOString(),
    symbol: normalizedSymbol,
    companyName: normalizeText(card.name),
    stackLayer: card.stackLayer,
    layerLabel: getAiStackLayerLabel(card.stackLayer),
    currentCard: {
      research: { ...card.research },
      tradeSetup: { ...card.tradeSetup },
    },
    researchDesk: buildCodexResearchDeskContext(card),
    requestedOutput: {
      schemaVersion: CODEX_RESEARCH_RESULT_SCHEMA_VERSION,
      fields: REQUESTED_FIELDS,
      sourceMetadata: SOURCE_METADATA_FIELDS,
    },
    guardrails: [...CODEX_RESEARCH_QUEUE_GUARDRAILS],
    workerPromptPath: CODEX_RESEARCH_WORKER_DOC,
    expectedResultPath: buildCodexResearchResultPath(requestId),
    disclosure: RESEARCH_DRAFT_DISCLOSURE,
  }
}

export function serializeCodexResearchRequest(
  request: CodexResearchRequest,
): string {
  return `${JSON.stringify(request, null, 2)}\n`
}

export function buildCodexResearchDeskContext(
  card: SeedWatchlistItem,
): CodexResearchDeskContext {
  const symbol = normalizeSymbol(card.symbol)
  const companyName = normalizeText(card.name) || symbol

  return {
    mode: 'daily_manual_research_desk',
    subject: `${symbol} · ${companyName}`,
    laneLabel: getAiStackLayerLabel(card.stackLayer),
    workerGoal:
      'Produce an importable, source-backed stock brief for any ticker without turning it into a recommendation.',
    sourceChecklist: CODEX_RESEARCH_SOURCE_CHECKLIST.map((item) => ({ ...item })),
    importChecklist: CODEX_RESEARCH_IMPORT_CHECKLIST.map((item) => ({ ...item })),
  }
}

export function buildCodexResearchRequestPath(requestId: string): string {
  return `${CODEX_RESEARCH_REQUEST_DIR}/${requestId}.json`
}

export function buildCodexResearchResultPath(requestId: string): string {
  return `${CODEX_RESEARCH_RESULT_DIR}/${requestId}.result.json`
}

export function buildCodexResearchDownloadName(requestId: string): string {
  return `${requestId}.json`
}

export function summarizeCodexResearchSourceMetadata(
  sources: readonly ResearchSource[],
): CodexResearchSourceMetadataSummary {
  const typeCounts: Partial<Record<ResearchSourceType, number>> = {}
  let fresh = 0
  let stale = 0
  let latestAccessedAt: string | null = null

  for (const source of sources) {
    typeCounts[source.type] = (typeCounts[source.type] ?? 0) + 1

    if (source.freshness === 'stale') {
      stale += 1
    } else {
      fresh += 1
    }

    if (
      !latestAccessedAt ||
      new Date(source.retrievedAt).getTime() >
        new Date(latestAccessedAt).getTime()
    ) {
      latestAccessedAt = source.retrievedAt
    }
  }

  return {
    total: sources.length,
    fresh,
    stale,
    latestAccessedAt,
    typeCounts,
  }
}

export function applyCodexResearchResultToCard(
  card: SeedWatchlistItem,
  validation: ValidCodexResearchValidation,
): CodexResearchImportUpdate {
  const updatedFields = REQUESTED_FIELDS.filter(
    (field) => validation.draft.fields[field].length > 0,
  )
  const sourceSummary = summarizeCodexResearchSourceMetadata(validation.sources)

  return {
    card: {
      ...card,
      research: {
        ...card.research,
        ...validation.draft.fields,
      },
    },
    reviewState: validation.draft.reviewState,
    sourceSummary,
    updatedFields,
    message: `Imported ${sourceSummary.total} ${pluralize(
      'source',
      sourceSummary.total,
    )} for ${validation.result.symbol}. Review catalyst, invalidation, target, stop, and source notes before using the card.`,
  }
}

export function parseCodexResearchResultJson(
  jsonText: string,
  options: CodexResearchResultValidationOptions = {},
): CodexResearchValidationResult {
  try {
    return validateCodexResearchResult(JSON.parse(jsonText), options)
  } catch {
    return {
      ok: false,
      errors: ['Result file is not valid JSON.'],
    }
  }
}

export function validateCodexResearchResult(
  value: unknown,
  options: CodexResearchResultValidationOptions = {},
): CodexResearchValidationResult {
  const errors: string[] = []

  if (!isRecord(value)) {
    return {
      ok: false,
      errors: ['Result must be a JSON object.'],
    }
  }

  const schemaVersion = readString(value, 'schemaVersion', errors)
  const requestId = readString(value, 'requestId', errors)
  const symbol = normalizeSymbol(readString(value, 'symbol', errors))
  const companyName = normalizeText(readString(value, 'companyName', errors))
  const draftedAt = normalizeIsoTimestamp(
    readString(value, 'draftedAt', errors),
    'draftedAt',
    errors,
  )
  const reviewState = readString(value, 'reviewState', errors)
  const disclosure = normalizeText(readString(value, 'disclosure', errors))

  if (schemaVersion !== CODEX_RESEARCH_RESULT_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${CODEX_RESEARCH_RESULT_SCHEMA_VERSION}.`,
    )
  }

  if (
    options.expectedRequestId &&
    requestId &&
    requestId !== options.expectedRequestId
  ) {
    errors.push('Result requestId does not match the queued request.')
  }

  if (
    options.expectedSymbol &&
    symbol &&
    symbol !== normalizeSymbol(options.expectedSymbol)
  ) {
    errors.push('Result symbol does not match the selected card.')
  }

  if (reviewState !== 'needs_review') {
    errors.push('reviewState must be needs_review.')
  }

  if (disclosure !== RESEARCH_DRAFT_DISCLOSURE) {
    errors.push('disclosure must use the standard manual-review language.')
  }

  const fields = validateResultFields(value.fields, draftedAt, errors)
  const sources = validateResultSources(value.sources, errors)
  const recommendationText = [
    fields.thesis,
    fields.catalyst,
    fields.invalidation,
    fields.riskNotes,
    fields.sourceNotes,
    fields.plannedEntry,
    fields.stop,
    fields.target,
  ].join('\n')

  if (containsProhibitedRecommendationCopy(recommendationText)) {
    errors.push(
      'Result contains direct recommendation, buy/sell instruction, or guaranteed-outcome copy.',
    )
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const result: CodexResearchResult = {
    schemaVersion: CODEX_RESEARCH_RESULT_SCHEMA_VERSION,
    requestId,
    symbol,
    companyName,
    draftedAt,
    reviewState: 'needs_review',
    disclosure: RESEARCH_DRAFT_DISCLOSURE,
    fields,
    sources,
  }

  return {
    ok: true,
    result,
    draft: buildResearchDraftFromCodexResult(result),
    sources: mapCodexSourcesToResearchSources(result),
  }
}

function buildResearchDraftFromCodexResult(
  result: CodexResearchResult,
): ResearchDraft {
  return {
    symbol: result.symbol,
    draftedAt: result.draftedAt,
    sourceCount: result.sources.length,
    reviewState: 'needs_review',
    fields: result.fields,
    disclosure: RESEARCH_DRAFT_DISCLOSURE,
  }
}

function mapCodexSourcesToResearchSources(
  result: CodexResearchResult,
): ResearchSource[] {
  return result.sources.map((source) => {
    const observedAt = source.publishedAt ?? source.accessedAt

    return {
      id: `${result.symbol}-${source.id}`,
      symbol: result.symbol,
      type: source.type,
      title: source.title,
      url: source.url,
      summary: `${source.publisher}: ${source.notes}`,
      observedAt,
      retrievedAt: source.accessedAt,
      freshness: getSourceFreshness(observedAt, source.accessedAt),
    }
  })
}

function validateResultFields(
  value: unknown,
  draftedAt: string,
  errors: string[],
): CodexResearchResultFields {
  if (!isRecord(value)) {
    errors.push('fields must be an object.')

    return {
      thesis: '',
      catalyst: '',
      invalidation: '',
      riskNotes: '',
      sourceNotes: '',
      plannedEntry: '',
      stop: '',
      target: '',
      reviewDate: normalizeReviewDate('', draftedAt, errors),
    }
  }

  const fields = {
    thesis: normalizeText(readString(value, 'thesis', errors)),
    catalyst: normalizeText(readString(value, 'catalyst', errors)),
    invalidation: normalizeText(readString(value, 'invalidation', errors)),
    riskNotes: normalizeText(readString(value, 'riskNotes', errors)),
    sourceNotes: normalizeMultilineText(readString(value, 'sourceNotes', errors)),
    plannedEntry: normalizeText(readString(value, 'plannedEntry', errors)),
    stop: normalizeText(readString(value, 'stop', errors)),
    target: normalizeText(readString(value, 'target', errors)),
    reviewDate: normalizeReviewDate(
      readString(value, 'reviewDate', errors),
      draftedAt,
      errors,
    ),
  }

  for (const field of REQUESTED_FIELDS) {
    if (fields[field].length === 0) {
      errors.push(`fields.${field} is required.`)
    }
  }

  return fields
}

function validateResultSources(
  value: unknown,
  errors: string[],
): CodexResearchResultSource[] {
  if (!Array.isArray(value)) {
    errors.push('sources must be an array.')
    return []
  }

  if (value.length === 0) {
    errors.push('sources must include at least one source.')
  }

  const sources = value.map((source, index) => {
    if (!isRecord(source)) {
      errors.push(`sources[${index}] must be an object.`)

      return buildEmptySource(index)
    }

    const id = normalizeSourceId(readString(source, 'id', errors), index)
    const type = normalizeSourceType(readString(source, 'type', errors), index, errors)
    const title = normalizeText(readString(source, 'title', errors))
    const url = normalizeUrl(readString(source, 'url', errors), index, errors)
    const publisher = normalizeText(readString(source, 'publisher', errors))
    const accessedAt = normalizeIsoTimestamp(
      readString(source, 'accessedAt', errors),
      `sources[${index}].accessedAt`,
      errors,
    )
    const publishedAt = normalizeOptionalIsoTimestamp(
      readNullableString(source, 'publishedAt', errors),
      `sources[${index}].publishedAt`,
      errors,
    )
    const notes = normalizeText(readString(source, 'notes', errors))

    if (title.length === 0) {
      errors.push(`sources[${index}].title is required.`)
    }

    if (publisher.length === 0) {
      errors.push(`sources[${index}].publisher is required.`)
    }

    if (notes.length === 0) {
      errors.push(`sources[${index}].notes is required.`)
    }

    return {
      id,
      type,
      title,
      url,
      publisher,
      accessedAt,
      publishedAt,
      notes,
    }
  })
  const seenIds = new Set<string>()

  sources.forEach((source, index) => {
    if (seenIds.has(source.id)) {
      errors.push(
        `sources[${index}].id duplicates another source id after normalization.`,
      )
      return
    }

    seenIds.add(source.id)
  })

  return sources
}

function readString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
): string {
  const value = record[key]

  if (typeof value !== 'string') {
    errors.push(`${key} must be a string.`)
    return ''
  }

  return value
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
  errors: string[],
): string | null {
  const value = record[key]

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    errors.push(`${key} must be a string or null.`)
    return null
  }

  return value
}

function normalizeSourceType(
  value: string,
  index: number,
  errors: string[],
): ResearchSourceType {
  if (RESEARCH_SOURCE_TYPES.includes(value as ResearchSourceType)) {
    return value as ResearchSourceType
  }

  errors.push(
    `sources[${index}].type must be one of ${RESEARCH_SOURCE_TYPES.join(', ')}.`,
  )
  return 'recent_news'
}

function normalizeUrl(value: string, index: number, errors: string[]): string {
  const normalized = normalizeText(value)

  try {
    const parsed = new URL(normalized)

    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString()
    }
  } catch {
    // handled below
  }

  errors.push(`sources[${index}].url must be a valid http(s) URL.`)
  return normalized
}

function normalizeIsoTimestamp(
  value: string,
  label: string,
  errors: string[],
): string {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${label} must be a valid ISO timestamp.`)
    return new Date(0).toISOString()
  }

  return parsed.toISOString()
}

function normalizeOptionalIsoTimestamp(
  value: string | null,
  label: string,
  errors: string[],
): string | null {
  if (value === null || value.trim().length === 0) {
    return null
  }

  return normalizeIsoTimestamp(value, label, errors)
}

function normalizeReviewDate(
  value: string,
  draftedAt: string,
  errors: string[],
): string {
  const parsed = new Date(`${value}T00:00:00.000Z`)

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  errors.push('fields.reviewDate must be a YYYY-MM-DD date.')
  const fallback = new Date(draftedAt)
  fallback.setUTCDate(fallback.getUTCDate() + 7)
  return fallback.toISOString().slice(0, 10)
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeMultilineText(value: string): string {
  return value
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .join('\n')
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function normalizeSourceId(value: string, index: number): string {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `source-${index + 1}`
}

function buildRequestId(symbol: string, createdAt: Date): string {
  const pathSafeSymbol = symbol
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${pathSafeSymbol || 'symbol'}-${createdAt
    .toISOString()
    .replace(/[:.]/g, '-')
    .toLowerCase()}`
}

function buildEmptySource(index: number): CodexResearchResultSource {
  return {
    id: `source-${index + 1}`,
    type: 'recent_news',
    title: '',
    url: '',
    publisher: '',
    accessedAt: new Date(0).toISOString(),
    publishedAt: null,
    notes: '',
  }
}

function getSourceFreshness(
  observedAt: string,
  accessedAt: string,
): ResearchSourceFreshness {
  const observed = new Date(observedAt)
  const accessed = new Date(accessedAt)
  const staleAfterMs = 7 * 24 * 60 * 60 * 1000

  return accessed.getTime() - observed.getTime() > staleAfterMs
    ? 'stale'
    : 'fresh'
}

function containsProhibitedRecommendationCopy(value: string): boolean {
  return PROHIBITED_RECOMMENDATION_PATTERNS.some((pattern) =>
    pattern.test(value),
  )
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
