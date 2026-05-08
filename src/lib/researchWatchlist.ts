import { AI_STACK_LAYERS } from '../data/seedWatchlist'
import type {
  AiStackLayerId,
  SeedWatchlistItem,
} from '../data/seedWatchlist'

export type ResearchCandidateScore = {
  symbol: string
  name: string
  stackLayer: AiStackLayerId
  seedType: SeedWatchlistItem['seedType']
  score: number
  maxScore: number
  scorePercent: number
  statusLabel: string
  missingFields: string[]
}

export type ResearchLayerGroup = {
  id: AiStackLayerId
  label: string
  items: SeedWatchlistItem[]
}

export type ResearchCandidateFilters = {
  layer: AiStackLayerId | 'all'
  minimumScore: number
  holdingsOnly: boolean
  needsInputOnly: boolean
}

type ScoreCheck = {
  label: string
  points: number
  isComplete: (card: SeedWatchlistItem) => boolean
}

const SCORE_CHECKS: ScoreCheck[] = [
  {
    label: 'Stock brief',
    points: 15,
    isComplete: (card) => hasText(card.research.thesis),
  },
  {
    label: 'Watch list',
    points: 10,
    isComplete: (card) => hasText(card.research.catalyst),
  },
  {
    label: 'Thesis break',
    points: 15,
    isComplete: (card) => hasText(card.research.invalidation),
  },
  {
    label: 'Risk notes',
    points: 10,
    isComplete: (card) => hasText(card.research.riskNotes),
  },
  {
    label: 'Entry/risk/analyst targets',
    points: 15,
    isComplete: (card) =>
      hasText(card.research.plannedEntry) &&
      hasText(card.research.stop) &&
      hasText(card.research.target),
  },
  {
    label: 'Setup trigger/risk',
    points: 20,
    isComplete: (card) =>
      hasText(card.tradeSetup.entryTrigger) &&
      hasText(card.tradeSetup.stopLevel) &&
      hasText(card.tradeSetup.target) &&
      hasText(card.tradeSetup.maxLoss),
  },
  {
    label: 'Scale-out/time horizon',
    points: 10,
    isComplete: (card) =>
      hasText(card.tradeSetup.plannedScaleOut) &&
      hasText(card.tradeSetup.invalidation) &&
      hasText(card.tradeSetup.timeHorizon),
  },
  {
    label: 'Review date',
    points: 5,
    isComplete: (card) => hasText(card.research.reviewDate),
  },
]

const MAX_SCORE = SCORE_CHECKS.reduce((sum, check) => sum + check.points, 0)

export function buildResearchCandidateScores(
  cards: readonly SeedWatchlistItem[],
): ResearchCandidateScore[] {
  return cards
    .map((card) => {
      const completedChecks = SCORE_CHECKS.filter((check) =>
        check.isComplete(card),
      )
      const score = completedChecks.reduce(
        (sum, check) => sum + check.points,
        0,
      )
      const missingFields = SCORE_CHECKS.filter(
        (check) => !check.isComplete(card),
      ).map((check) => check.label)

      return {
        symbol: card.symbol,
        name: card.name,
        stackLayer: card.stackLayer,
        seedType: card.seedType,
        score,
        maxScore: MAX_SCORE,
        scorePercent: Math.round((score / MAX_SCORE) * 100),
        statusLabel: getScoreStatusLabel(score),
        missingFields,
      }
    })
    .sort(compareCandidateScores)
}

export function groupResearchCardsByLayer(
  cards: readonly SeedWatchlistItem[],
): ResearchLayerGroup[] {
  return AI_STACK_LAYERS.map((layer) => ({
    id: layer.id,
    label: layer.label,
    items: cards.filter((card) => card.stackLayer === layer.id),
  }))
}

export function filterResearchCandidateScores(
  scores: readonly ResearchCandidateScore[],
  filters: ResearchCandidateFilters,
): ResearchCandidateScore[] {
  return scores.filter((score) => {
    if (filters.layer !== 'all' && score.stackLayer !== filters.layer) {
      return false
    }

    if (score.scorePercent < filters.minimumScore) {
      return false
    }

    if (filters.holdingsOnly && score.seedType !== 'current_holding') {
      return false
    }

    if (filters.needsInputOnly && score.missingFields.length === 0) {
      return false
    }

    return true
  })
}

function compareCandidateScores(
  first: ResearchCandidateScore,
  second: ResearchCandidateScore,
): number {
  if (second.scorePercent !== first.scorePercent) {
    return second.scorePercent - first.scorePercent
  }

  if (first.seedType !== second.seedType) {
    return first.seedType === 'current_holding' ? -1 : 1
  }

  return first.symbol.localeCompare(second.symbol)
}

function getScoreStatusLabel(score: number): string {
  const percent = Math.round((score / MAX_SCORE) * 100)

  if (percent >= 80) {
    return 'Manual review ready'
  }

  if (percent >= 55) {
    return 'Setup draft'
  }

  if (percent > 0) {
    return 'Research draft'
  }

  return 'Needs thesis'
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}
