/// <reference types="node" />

import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { seedWatchlist } from '../data/seedWatchlist'
import { RESEARCH_DRAFT_DISCLOSURE } from './researchProvider'
import {
  buildCodexResearchDownloadName,
  buildCodexResearchRequest,
  buildCodexResearchRequestPath,
  buildCodexResearchResultPath,
  CODEX_RESEARCH_QUEUE_GUARDRAILS,
  CODEX_RESEARCH_RESULT_SCHEMA_VERSION,
  parseCodexResearchResultJson,
  serializeCodexResearchRequest,
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

  it('keeps queue instructions framed as manual research, not recommendations', () => {
    const guardrailCopy = CODEX_RESEARCH_QUEUE_GUARDRAILS.join(' ')

    expect(guardrailCopy).toContain('manual review only')
    expect(guardrailCopy).toContain('analyst ratings')
    expect(guardrailCopy).toContain('do not call OpenAI APIs')
    expect(guardrailCopy).toContain('Do not log in to brokerage accounts')
    expect(guardrailCopy).toContain('buy/sell instructions')
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
