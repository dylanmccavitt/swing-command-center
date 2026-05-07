import { describe, expect, it } from 'vitest'
import { AI_STACK_LAYERS, seedWatchlist } from '../data/seedWatchlist'
import type { SeedWatchlistItem } from '../data/seedWatchlist'
import {
  buildResearchCandidateScores,
  filterResearchCandidateScores,
  groupResearchCardsByLayer,
} from './researchWatchlist'

describe('AI stack research watchlist', () => {
  it('seeds current holdings and every required AI-stack layer', () => {
    const symbols = seedWatchlist.map((item) => item.symbol)
    const seededLayers = new Set(seedWatchlist.map((item) => item.stackLayer))

    expect(symbols).toEqual(
      expect.arrayContaining(['AAPL', 'GOOG', 'NVDA', 'IREN']),
    )
    expect(Array.from(seededLayers).sort()).toEqual(
      AI_STACK_LAYERS.map((layer) => layer.id).sort(),
    )
  })

  it('groups cards in the fixed AI-stack layer order', () => {
    const groups = groupResearchCardsByLayer(seedWatchlist)

    expect(groups.map((group) => group.label)).toEqual([
      'Hyperscalers',
      'GPU/chip designers',
      'Foundries',
      'Memory',
      'Semiconductor equipment',
      'EDA/IP',
      'Networking',
      'Power/cooling',
      'Data centers',
      'Energy',
    ])
    expect(groups.every((group) => group.items.length > 0)).toBe(true)
  })

  it('scores field completeness instead of generating recommendations', () => {
    const draft = buildCard({
      thesis: 'Watch if the setup becomes defined.',
      catalyst: '',
      invalidation: '',
      riskNotes: '',
    })
    const ready = buildCard({
      symbol: 'READY',
      thesis: 'Manual thesis',
      catalyst: 'Manual catalyst',
      invalidation: 'Manual invalidation',
      riskNotes: 'Manual risk notes',
      plannedEntry: 'Above prior day high',
      stop: 'Below support',
      target: 'Prior range high',
      reviewDate: '2026-05-15',
      entryTrigger: 'Breakout with volume',
      stopLevel: '$100',
      setupTarget: '$120',
      maxLoss: '$250',
      plannedScaleOut: 'Half at first target',
      setupInvalidation: 'Close below support',
      timeHorizon: '2-4 weeks',
    })

    const scores = buildResearchCandidateScores([draft, ready])

    expect(scores[0]).toMatchObject({
      symbol: 'READY',
      scorePercent: 100,
      statusLabel: 'Manual review ready',
      missingFields: [],
    })
    expect(scores[1].symbol).toBe('DRAFT')
    expect(scores[1].scorePercent).toBeLessThan(55)
    expect(scores[1].missingFields).toContain('Setup trigger/risk')
  })

  it('filters scores by layer, holding status, minimum score, and missing input', () => {
    const scores = buildResearchCandidateScores([
      buildCard({
        symbol: 'HOLD',
        seedType: 'current_holding',
        stackLayer: 'hyperscalers',
        thesis: 'Holding thesis',
      }),
      buildCard({
        symbol: 'GPUX',
        seedType: 'placeholder',
        stackLayer: 'gpu_chip_designers',
        thesis: 'GPU thesis',
        catalyst: 'Catalyst',
        invalidation: 'Invalidation',
        riskNotes: 'Risk',
        plannedEntry: 'Entry',
        stop: 'Stop',
        target: 'Target',
        reviewDate: '2026-05-15',
        entryTrigger: 'Trigger',
        stopLevel: '$10',
        setupTarget: '$12',
        maxLoss: '$100',
        plannedScaleOut: 'Scale',
        setupInvalidation: 'Break',
        timeHorizon: '1 month',
      }),
    ])

    expect(
      filterResearchCandidateScores(scores, {
        layer: 'gpu_chip_designers',
        minimumScore: 80,
        holdingsOnly: false,
        needsInputOnly: false,
      }).map((score) => score.symbol),
    ).toEqual(['GPUX'])
    expect(
      filterResearchCandidateScores(scores, {
        layer: 'all',
        minimumScore: 0,
        holdingsOnly: true,
        needsInputOnly: true,
      }).map((score) => score.symbol),
    ).toEqual(['HOLD'])
  })
})

function buildCard(
  overrides: Partial<
    {
      symbol: string
      seedType: SeedWatchlistItem['seedType']
      stackLayer: SeedWatchlistItem['stackLayer']
      thesis: string
      catalyst: string
      invalidation: string
      riskNotes: string
      plannedEntry: string
      stop: string
      target: string
      reviewDate: string
      entryTrigger: string
      stopLevel: string
      setupTarget: string
      maxLoss: string
      plannedScaleOut: string
      setupInvalidation: string
      timeHorizon: string
    }
  > = {},
): SeedWatchlistItem {
  return {
    symbol: overrides.symbol ?? 'DRAFT',
    name: overrides.symbol ?? 'Draft',
    stackLayer: overrides.stackLayer ?? 'hyperscalers',
    seedType: overrides.seedType ?? 'placeholder',
    research: {
      thesis: overrides.thesis ?? '',
      catalyst: overrides.catalyst ?? '',
      invalidation: overrides.invalidation ?? '',
      riskNotes: overrides.riskNotes ?? '',
      plannedEntry: overrides.plannedEntry ?? '',
      stop: overrides.stop ?? '',
      target: overrides.target ?? '',
      reviewDate: overrides.reviewDate ?? '',
    },
    tradeSetup: {
      entryTrigger: overrides.entryTrigger ?? '',
      stopLevel: overrides.stopLevel ?? '',
      target: overrides.setupTarget ?? '',
      maxLoss: overrides.maxLoss ?? '',
      plannedScaleOut: overrides.plannedScaleOut ?? '',
      invalidation: overrides.setupInvalidation ?? '',
      timeHorizon: overrides.timeHorizon ?? '',
    },
  }
}
