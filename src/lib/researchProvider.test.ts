import { describe, expect, it } from 'vitest'
import { seedWatchlist } from '../data/seedWatchlist'
import {
  buildResearchDraftFromBundle,
  createCuratedResearchProvider,
  normalizeResearchDraft,
  RESEARCH_DRAFT_DISCLOSURE,
} from './researchProvider'
import type { ResearchDraft } from './researchProvider'

describe('research provider boundary', () => {
  it('loads transparent source context through a typed provider', async () => {
    const provider = createCuratedResearchProvider({
      cards: seedWatchlist,
      now: () => new Date('2026-05-07T14:00:00.000Z'),
      sourceObservedAt: () => new Date('2026-05-07T13:30:00.000Z'),
    })

    const [bundle] = await provider.loadResearchContext(['nvda'])

    expect(provider.name).toBe('curated_ai_stack')
    expect(bundle).toMatchObject({
      symbol: 'NVDA',
      name: 'NVIDIA',
      layerLabel: 'GPU/chip designers',
      status: 'ready',
      warning: null,
    })
    expect(bundle.sources.map((source) => source.type)).toEqual([
      'recent_news',
      'investor_relations',
      'sec_filings',
      'earnings_call',
      'sector_context',
    ])
  })

  it('keeps source metadata visible and marks stale source sets', async () => {
    const provider = createCuratedResearchProvider({
      cards: seedWatchlist,
      now: () => new Date('2026-05-07T14:00:00.000Z'),
      sourceObservedAt: () => new Date('2026-05-03T14:00:00.000Z'),
      staleAfterMs: 24 * 60 * 60 * 1000,
    })

    const [bundle] = await provider.loadResearchContext(['AAPL'])

    expect(bundle.status).toBe('stale_source')
    expect(bundle.sources.every((source) => source.freshness === 'stale')).toBe(
      true,
    )
    expect(bundle.sources[0]).toMatchObject({
      retrievedAt: '2026-05-07T14:00:00.000Z',
      observedAt: '2026-05-03T14:00:00.000Z',
    })
    expect(bundle.sources.every((source) => source.url.startsWith('https://')))
      .toBe(true)
  })

  it('returns an empty-source state when no source catalog exists', async () => {
    const provider = createCuratedResearchProvider({
      cards: seedWatchlist,
      now: () => new Date('2026-05-07T14:00:00.000Z'),
    })

    const [bundle] = await provider.loadResearchContext(['ZZZZ'])

    expect(bundle).toMatchObject({
      symbol: 'ZZZZ',
      status: 'empty_source',
      sources: [],
      warning: 'No transparent sources are configured for this symbol.',
    })
  })
})

describe('research draft normalization', () => {
  it('drafts editable research fields without trade instructions', async () => {
    const provider = createCuratedResearchProvider({
      cards: seedWatchlist,
      now: () => new Date('2026-05-07T14:00:00.000Z'),
    })
    const [bundle] = await provider.loadResearchContext(['VRT'])
    const draft = buildResearchDraftFromBundle(bundle)

    expect(draft).not.toBeNull()
    expect(draft?.reviewState).toBe('needs_review')
    expect(draft?.fields.reviewDate).toBe('2026-05-14')
    expect(draft?.fields.thesis).toContain('Review whether Vertiv remains')
    expect(draft?.fields.sourceNotes).toContain(
      'AI-drafted, needs review',
    )
    expect(draft?.fields.sourceNotes).toContain('https://')
    expect(draft?.fields.sourceNotes).not.toMatch(/\b(Buy|Sell)\b/)
  })

  it('normalizes draft fields and repairs invalid review dates', () => {
    const normalized = normalizeResearchDraft({
      symbol: ' nvda ',
      draftedAt: '2026-05-07T14:00:00.000Z',
      sourceCount: 1,
      reviewState: 'needs_review',
      disclosure: '',
      fields: {
        thesis: '  Confirm   the thesis  ',
        catalyst: ' Catalyst\ncheck ',
        invalidation: '  ',
        riskNotes: 'Risk   notes',
        sourceNotes: ' News: source  \n\n  Filing: source ',
        plannedEntry: '  Source entry   context ',
        stop: ' Risk   level ',
        target: ' Analyst   targets ',
        reviewDate: 'not-a-date',
      },
    } satisfies ResearchDraft)

    expect(normalized.symbol).toBe('NVDA')
    expect(normalized.fields).toMatchObject({
      thesis: 'Confirm the thesis',
      catalyst: 'Catalyst check',
      invalidation: '',
      riskNotes: 'Risk notes',
      sourceNotes: 'News: source\nFiling: source',
      plannedEntry: 'Source entry context',
      stop: 'Risk level',
      target: 'Analyst targets',
      reviewDate: '2026-05-14',
    })
    expect(normalized.disclosure).toBe(RESEARCH_DRAFT_DISCLOSURE)
  })

  it('uses explicit non-recommendation copy', () => {
    expect(RESEARCH_DRAFT_DISCLOSURE).toContain('manual review')
    expect(RESEARCH_DRAFT_DISCLOSURE).toContain('Not a recommendation')
    expect(RESEARCH_DRAFT_DISCLOSURE).toContain('buy/sell instruction')
    expect(RESEARCH_DRAFT_DISCLOSURE).toContain('guaranteed outcome')
  })
})
