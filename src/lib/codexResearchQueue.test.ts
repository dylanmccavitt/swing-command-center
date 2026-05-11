/// <reference types="node" />

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildManualWatchlistCard, seedWatchlist } from '../data/seedWatchlist'
import { RESEARCH_DRAFT_DISCLOSURE } from './researchProvider'
import {
  applyCodexResearchResultToCard,
  buildCodexResearchDownloadName,
  buildCodexResearchRequest,
  buildCodexResearchRequestPath,
  buildCodexResearchResultPath,
  CODEX_RESEARCH_QUEUE_GUARDRAILS,
  CODEX_RESEARCH_RESULT_SCHEMA_VERSION,
  parseCodexResearchResultJson,
  serializeCodexResearchRequest,
  summarizeCodexResearchSourceMetadata,
  validateCodexResearchResult,
  type CodexResearchResult,
} from './codexResearchQueue'

describe('Codex research queue request creation', () => {
  it('builds a local manual-research request with schema and guardrails', () => {
    const card = seedWatchlist.find((item) => item.symbol === 'NVDA')
    const request = buildCodexResearchRequest(card!, {
      createdAt: new Date('2026-05-07T15:30:00.000Z'),
    })

    expect(request).toMatchObject({
      requestId: 'nvda-2026-05-07t15-30-00-000z',
      symbol: 'NVDA',
      companyName: 'NVIDIA',
      stackLayer: 'gpu_chip_designers',
      layerLabel: 'GPU/chip designers',
      workerPromptPath: 'docs/codex-research-worker.md',
      expectedResultPath:
        'research-queue/results/nvda-2026-05-07t15-30-00-000z.result.json',
    })
    expect(request.currentCard.research.thesis).toContain(
      'core AI accelerator',
    )
    expect(request.requestedOutput.fields).toEqual([
      'thesis',
      'catalyst',
      'invalidation',
      'riskNotes',
      'sourceNotes',
      'plannedEntry',
      'stop',
      'target',
      'reviewDate',
    ])
    expect(request.requestedOutput.sourceMetadata).toEqual([
      'id',
      'type',
      'title',
      'url',
      'publisher',
      'accessedAt',
      'publishedAt',
      'notes',
    ])
    expect(request.guardrails.join(' ')).toContain('do not call OpenAI APIs')
    expect(request.guardrails.join(' ')).toContain('Do not log in to brokerage')
    expect(serializeCodexResearchRequest(request)).not.toMatch(
      /sk-[a-z0-9]|ALPACA_MARKET_DATA_SECRET|OPENAI_API_KEY/i,
    )
  })

  it('uses ignored local request and result artifact paths', () => {
    const requestId = 'nvda-2026-05-07t15-30-00-000z'

    expect(buildCodexResearchRequestPath(requestId)).toBe(
      'research-queue/requests/nvda-2026-05-07t15-30-00-000z.json',
    )
    expect(buildCodexResearchResultPath(requestId)).toBe(
      'research-queue/results/nvda-2026-05-07t15-30-00-000z.result.json',
    )
    expect(buildCodexResearchDownloadName(requestId)).toBe(
      'nvda-2026-05-07t15-30-00-000z.json',
    )
    expect(isIgnoredByGit(buildCodexResearchRequestPath(requestId))).toBe(true)
    expect(isIgnoredByGit(buildCodexResearchResultPath(requestId))).toBe(true)
    expect(isIgnoredByGit('research-queue/requests/.gitkeep')).toBe(false)
    expect(isIgnoredByGit('research-queue/results/.gitkeep')).toBe(false)
  })

  it('builds a daily research desk payload for HIMS and other general tickers', () => {
    const card = seedWatchlist.find((item) => item.symbol === 'HIMS')
    const request = buildCodexResearchRequest(card!, {
      createdAt: new Date('2026-05-11T13:15:00.000Z'),
    })

    expect(request).toMatchObject({
      requestId: 'hims-2026-05-11t13-15-00-000z',
      symbol: 'HIMS',
      companyName: 'Hims & Hers Health',
      stackLayer: 'general_watchlist',
      layerLabel: 'General watchlist',
      researchDesk: {
        mode: 'daily_manual_research_desk',
        subject: 'HIMS · Hims & Hers Health',
        laneLabel: 'General watchlist',
        workerGoal:
          'Produce an importable, source-backed stock brief for any ticker without turning it into a recommendation.',
      },
    })
    expect(request.researchDesk.sourceChecklist.map((item) => item.id)).toEqual([
      'company_primary',
      'filings_or_regulatory',
      'recent_news',
      'analyst_context',
      'sector_or_peer_context',
      'price_setup_context',
    ])
    expect(request.researchDesk.importChecklist.map((item) => item.id)).toEqual([
      'catalyst',
      'invalidation',
      'target_stop_context',
      'review_state',
      'source_metadata',
    ])
    expect(serializeCodexResearchRequest(request)).toContain('any ticker')
    expect(serializeCodexResearchRequest(request)).toContain(
      'HIMS · Hims & Hers Health',
    )
  })

  it('uses path-safe request ids for punctuation tickers', () => {
    const request = buildCodexResearchRequest(
      buildManualWatchlistCard({
        symbol: 'brk.b',
        name: 'Berkshire Hathaway',
        stackLayer: 'general_watchlist',
      }),
      {
        createdAt: new Date('2026-05-11T13:45:00.000Z'),
      },
    )

    expect(request).toMatchObject({
      requestId: 'brk-b-2026-05-11t13-45-00-000z',
      symbol: 'BRK.B',
      companyName: 'Berkshire Hathaway',
      layerLabel: 'General watchlist',
    })
    expect(buildCodexResearchRequestPath(request.requestId)).toBe(
      'research-queue/requests/brk-b-2026-05-11t13-45-00-000z.json',
    )
    expect(request.expectedResultPath).toBe(
      'research-queue/results/brk-b-2026-05-11t13-45-00-000z.result.json',
    )
  })
})

describe('Codex research result validation', () => {
  it('validates and normalizes imported draft fields and source metadata', () => {
    const result = validateCodexResearchResult(buildValidResult(), {
      expectedRequestId: 'nvda-2026-05-07t15-30-00-000z',
      expectedSymbol: 'nvda',
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      return
    }

    expect(result.result.fields).toMatchObject({
        thesis:
        'NVIDIA remains a manual-review accelerator stock brief with data-center demand to verify.',
      plannedEntry:
        'Source context only: compare current price with the latest close and recent support before drafting an entry.',
      stop:
        'Source context only: use invalidation and support levels for manual risk planning.',
      target:
        'Source context only: analyst target range was reviewed but no app target is assigned.',
      sourceNotes:
        'Analyst context: consensus target range reviewed from public analyst summary; not an app rating.\nNVIDIA IR: FY26 Q1 materials reviewed for data-center and margin commentary.\nSEC filing: 10-Q reviewed for export-control and supply-chain risk language.',
      reviewDate: '2026-05-14',
    })
    expect(result.draft).toMatchObject({
      symbol: 'NVDA',
      reviewState: 'needs_review',
      sourceCount: 3,
      disclosure: RESEARCH_DRAFT_DISCLOSURE,
    })
    expect(result.sources[0]).toMatchObject({
      symbol: 'NVDA',
      type: 'investor_relations',
      title: 'NVIDIA investor presentation',
      url: 'https://investor.nvidia.com/events-and-presentations/',
      freshness: 'fresh',
    })
    expect(summarizeCodexResearchSourceMetadata(result.sources)).toMatchObject({
      total: 3,
      fresh: 3,
      stale: 0,
      latestAccessedAt: '2026-05-07T15:59:00.000Z',
      typeCounts: {
        analyst_context: 1,
        investor_relations: 1,
        sec_filings: 1,
      },
    })
  })

  it('parses result JSON and reports invalid schema, source, and recommendation copy', () => {
    const parsed = parseCodexResearchResultJson(
      JSON.stringify({
        ...buildValidResult(),
        schemaVersion: 'wrong',
        fields: {
          ...buildValidResult().fields,
          thesis: 'Buy now because the upside is guaranteed.',
          reviewDate: 'not-a-date',
        },
        sources: [
          {
            id: 'bad',
            type: 'blog',
            title: '',
            url: 'not-a-url',
            publisher: '',
            accessedAt: 'not-a-date',
            publishedAt: 42,
            notes: '',
          },
        ],
      }),
      {
        expectedRequestId: 'other-request',
        expectedSymbol: 'AAPL',
      },
    )

    expect(parsed.ok).toBe(false)

    if (parsed.ok) {
      return
    }

    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        `schemaVersion must be ${CODEX_RESEARCH_RESULT_SCHEMA_VERSION}.`,
        'Result requestId does not match the queued request.',
        'Result symbol does not match the selected card.',
        'fields.reviewDate must be a YYYY-MM-DD date.',
        'sources[0].type must be one of recent_news, investor_relations, sec_filings, earnings_call, sector_context, analyst_context.',
        'sources[0].url must be a valid http(s) URL.',
        'sources[0].accessedAt must be a valid ISO timestamp.',
        'publishedAt must be a string or null.',
        'Result contains direct recommendation, buy/sell instruction, or guaranteed-outcome copy.',
      ]),
    )
  })

  it('rejects duplicate source ids and direct entry, stop, or app target instructions', () => {
    const parsed = validateCodexResearchResult({
      ...buildValidResult(),
      fields: {
        ...buildValidResult().fields,
        plannedEntry: 'You should enter near the next pullback.',
        stop: 'Set a stop at the prior swing low.',
        target: 'Our app target is 25% above the last close.',
      },
      sources: buildValidResult().sources.map((source) => ({
        ...source,
        id: 'same source',
      })),
    })

    expect(parsed.ok).toBe(false)

    if (parsed.ok) {
      return
    }

    expect(parsed.errors).toEqual(
      expect.arrayContaining([
        'sources[1].id duplicates another source id after normalization.',
        'sources[2].id duplicates another source id after normalization.',
        'Result contains direct recommendation, buy/sell instruction, or guaranteed-outcome copy.',
      ]),
    )
  })

  it('keeps queue instructions framed as manual research, not recommendations', () => {
    const guardrailCopy = CODEX_RESEARCH_QUEUE_GUARDRAILS.join(' ')

    expect(guardrailCopy).toContain('manual review only')
    expect(guardrailCopy).toContain('analyst ratings')
    expect(guardrailCopy).toContain('do not call OpenAI APIs')
    expect(guardrailCopy).toContain('Do not log in to brokerage accounts')
    expect(guardrailCopy).toContain('buy/sell instructions')
  })

  it('builds an import update that preserves the card and requires review', () => {
    const card = seedWatchlist.find((item) => item.symbol === 'HIMS')!
    const validation = validateCodexResearchResult(
      {
        ...buildValidResult(),
        requestId: 'hims-2026-05-11t13-15-00-000z',
        symbol: 'HIMS',
        companyName: 'Hims & Hers Health',
        fields: {
          ...buildValidResult().fields,
          thesis:
            'HIMS remains a manual-review consumer health brief with growth quality to verify.',
          target:
            'Source context only: compare source-reported analyst target range with current valuation.',
          stop:
            'Source context only: use regulatory and margin invalidation levels for manual risk planning.',
          sourceNotes:
            'HIMS IR: quarterly materials reviewed for subscriber and margin commentary.\nAnalyst context: public target range reviewed as source context only.',
        },
      },
      {
        expectedRequestId: 'hims-2026-05-11t13-15-00-000z',
        expectedSymbol: 'HIMS',
      },
    )

    expect(validation.ok).toBe(true)

    if (!validation.ok) {
      return
    }

    const update = applyCodexResearchResultToCard(card, validation)

    expect(update.card).toMatchObject({
      symbol: 'HIMS',
      name: 'Hims & Hers Health',
      stackLayer: 'general_watchlist',
      tradeSetup: card.tradeSetup,
      research: {
        thesis:
          'HIMS remains a manual-review consumer health brief with growth quality to verify.',
        target:
          'Source context only: compare source-reported analyst target range with current valuation.',
        stop:
          'Source context only: use regulatory and margin invalidation levels for manual risk planning.',
      },
    })
    expect(update.reviewState).toBe('needs_review')
    expect(update.sourceSummary.total).toBe(3)
    expect(update.message).toContain(
      'Imported 3 sources for HIMS. Review catalyst, invalidation, target, stop, and source notes before using the card.',
    )
  })
})

function buildValidResult(): CodexResearchResult {
  return {
    schemaVersion: CODEX_RESEARCH_RESULT_SCHEMA_VERSION,
    requestId: 'nvda-2026-05-07t15-30-00-000z',
    symbol: ' nvda ',
    companyName: 'NVIDIA',
    draftedAt: '2026-05-07T16:00:00.000Z',
    reviewState: 'needs_review',
    disclosure: RESEARCH_DRAFT_DISCLOSURE,
    fields: {
      thesis:
        'NVIDIA remains a manual-review accelerator stock brief with data-center demand to verify.',
      catalyst:
        'Check data-center revenue, Blackwell supply commentary, and customer concentration in sourced materials.',
      invalidation:
        'Rework the thesis if filings or earnings commentary show demand pull-forward or margin pressure.',
      riskNotes:
        'Export controls, supply constraints, and elevated expectations need source-by-source review.',
      sourceNotes:
        'Analyst context: consensus target range reviewed from public analyst summary; not an app rating.\nNVIDIA IR: FY26 Q1 materials reviewed for data-center and margin commentary.\nSEC filing: 10-Q reviewed for export-control and supply-chain risk language.',
      plannedEntry:
        'Source context only: compare current price with the latest close and recent support before drafting an entry.',
      stop:
        'Source context only: use invalidation and support levels for manual risk planning.',
      target:
        'Source context only: analyst target range was reviewed but no app target is assigned.',
      reviewDate: '2026-05-14',
    },
    sources: [
      {
        id: 'ir',
        type: 'investor_relations',
        title: 'NVIDIA investor presentation',
        url: 'https://investor.nvidia.com/events-and-presentations/',
        publisher: 'NVIDIA Investor Relations',
        accessedAt: '2026-05-07T15:55:00.000Z',
        publishedAt: '2026-05-07T13:00:00.000Z',
        notes: 'Reviewed investor materials for data-center and margin commentary.',
      },
      {
        id: '10-q',
        type: 'sec_filings',
        title: 'NVIDIA 10-Q',
        url: 'https://www.sec.gov/edgar/search/#/q=NVDA',
        publisher: 'SEC EDGAR',
        accessedAt: '2026-05-07T15:58:00.000Z',
        publishedAt: null,
        notes: 'Checked filing search for export-control and supply-chain risk language.',
      },
      {
        id: 'analyst-targets',
        type: 'analyst_context',
        title: 'NVIDIA analyst target summary',
        url: 'https://www.nasdaq.com/market-activity/stocks/nvda/analyst-research',
        publisher: 'Nasdaq',
        accessedAt: '2026-05-07T15:59:00.000Z',
        publishedAt: null,
        notes:
          'Reviewed public analyst target context as source-reported data only.',
      },
    ],
  }
}

function isIgnoredByGit(path: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', path], {
      cwd: repoRoot,
      stdio: 'ignore',
    })

    return true
  } catch {
    return false
  }
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
