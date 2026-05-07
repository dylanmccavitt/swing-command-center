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
  'Return research drafts for manual review only; do not write guaranteed outcomes, ratings, or buy/sell instructions.',
  'Use source URLs, accessed timestamps, and short source notes so the user can verify every claim.',
] as const

export type CodexResearchRequestedField =
  | 'thesis'
  | 'catalyst'
  | 'invalidation'
  | 'riskNotes'
  | 'sourceNotes'
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

const REQUESTED_FIELDS: CodexResearchRequestedField[] = [
  'thesis',
  'catalyst',
  'invalidation',
  'riskNotes',
  'sourceNotes',
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
]

const PROHIBITED_RECOMMENDATION_PATTERNS = [
  /\b(buy|sell)\s+(now|shares?|the stock|this stock|this name)\b/i,
  /\b(strong buy|strong sell|price target|guaranteed|risk-free)\b/i,
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

export function buildCodexResearchRequestPath(requestId: string): string {
  return `${CODEX_RESEARCH_REQUEST_DIR}/${requestId}.json`
}

export function buildCodexResearchResultPath(requestId: string): string {
  return `${CODEX_RESEARCH_RESULT_DIR}/${requestId}.result.json`
}

export function buildCodexResearchDownloadName(requestId: string): string {
  return `${requestId}.json`
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
  ].join('\n')

  if (containsProhibitedRecommendationCopy(recommendationText)) {
    errors.push(
      'Result contains recommendation, buy/sell, guaranteed-outcome, or rating-style copy.',
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
      reviewDate: normalizeReviewDate('', draftedAt, errors),
    }
  }

  const fields = {
    thesis: normalizeText(readString(value, 'thesis', errors)),
    catalyst: normalizeText(readString(value, 'catalyst', errors)),
    invalidation: normalizeText(readString(value, 'invalidation', errors)),
    riskNotes: normalizeText(readString(value, 'riskNotes', errors)),
    sourceNotes: normalizeMultilineText(readString(value, 'sourceNotes', errors)),
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

  return value.map((source, index) => {
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
  return `${symbol.toLowerCase()}-${createdAt
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
