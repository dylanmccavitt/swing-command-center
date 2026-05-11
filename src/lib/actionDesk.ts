import type { SeedWatchlistItem } from '../data/seedWatchlist'
import type { ScenarioCandidate } from './cockpit'
import type { PortfolioPosition } from './portfolio'
import type { ProfitCashPlan } from './profitCashPlan'
import type { ResearchCandidateScore } from './researchWatchlist'
import type { BuyingPowerSummary } from './sellFills'

export const ACTION_DESK_DISCLOSURE =
  'Manual decision support only. Use these rows to keep holdings, research, and planning current; they do not recommend buys or sells, place orders, connect to a broker, or provide tax advice.'

export type ActionDeskItemType =
  | 'basis_fix'
  | 'cash_redeploy'
  | 'holding_setup'
  | 'research_import'
  | 'research_queue'
  | 'research_review'
  | 'risk_trim'

export type ActionDeskTone = 'neutral' | 'pos' | 'warn'

export type ActionDeskTargetView =
  | 'cash'
  | 'cockpit'
  | 'import'
  | 'journal'
  | 'planner'
  | 'research'

export type ActionDeskPrimaryAction =
  | 'fix_basis'
  | 'import_result'
  | 'open'
  | 'plan_cash'
  | 'queue_research'
  | 'review_research'
  | 'review_trim'

export type ActionDeskItem = {
  id: string
  type: ActionDeskItemType
  priority: number
  title: string
  detail: string
  symbol: string | null
  valueLabel: string | null
  targetView: ActionDeskTargetView
  primaryAction: ActionDeskPrimaryAction
  primaryLabel: string
  tone: ActionDeskTone
}

export type ActionDesk = {
  items: ActionDeskItem[]
  readyCount: number
  blockedCount: number
  topPriorityLabel: string
  disclosure: typeof ACTION_DESK_DISCLOSURE
}

export type ActionDeskQueueSnapshot = {
  status: string
  updatedAt: string | null
}

export type ActionDeskResearchRunSnapshot = {
  status: string
  updatedAt: string | null
}

export type BuildActionDeskInput = {
  positions: readonly PortfolioPosition[]
  researchScores: readonly ResearchCandidateScore[]
  researchCards: readonly SeedWatchlistItem[]
  topProfitLockScenarios: readonly ScenarioCandidate[]
  buyingPower: BuyingPowerSummary
  profitCashPlan: ProfitCashPlan
  codexQueue: Readonly<Record<string, ActionDeskQueueSnapshot | undefined>>
  researchRuns: Readonly<Record<string, ActionDeskResearchRunSnapshot | undefined>>
  limit?: number
}

const DEFAULT_ACTION_LIMIT = 7

export function buildActionDesk(input: BuildActionDeskInput): ActionDesk {
  const limit = input.limit ?? DEFAULT_ACTION_LIMIT
  const items = [
    ...buildBasisItems(input.buyingPower),
    ...buildCashItems(input.profitCashPlan),
    ...buildHoldingSetupItems(input.positions),
    ...buildRiskTrimItems(input.topProfitLockScenarios),
    ...buildResearchItems(input),
  ]
    .sort(compareActionItems)
    .slice(0, limit)

  const blockedCount = items.filter((item) =>
    item.type === 'basis_fix' || item.type === 'holding_setup',
  ).length
  const readyResearchCount = input.researchScores.filter(
    (score) => score.missingFields.length === 0,
  ).length
  const readyCount =
    input.topProfitLockScenarios.length +
    readyResearchCount +
    (input.profitCashPlan.cashToPlan > 0 ? 1 : 0)

  return {
    items,
    readyCount,
    blockedCount,
    topPriorityLabel: items[0]?.primaryLabel ?? 'Review cockpit',
    disclosure: ACTION_DESK_DISCLOSURE,
  }
}

function buildBasisItems(buyingPower: BuyingPowerSummary): ActionDeskItem[] {
  if (buyingPower.missingInputCount === 0) {
    return []
  }

  return [
    {
      id: 'basis-fix',
      type: 'basis_fix',
      priority: 1_200,
      title: 'Fix missing basis before cash planning',
      detail: `${buyingPower.missingInputCount} filled or accepted sell row needs basis before realized P/L, reserve, and pay-yourself math are reliable.`,
      symbol: null,
      valueLabel: formatCurrency(buyingPower.filledSellProceeds),
      targetView: 'import',
      primaryAction: 'fix_basis',
      primaryLabel: 'Open import',
      tone: 'warn',
    },
  ]
}

function buildCashItems(plan: ProfitCashPlan): ActionDeskItem[] {
  if (plan.cashToPlan <= 0) {
    return []
  }

  return [
    {
      id: 'cash-redeploy',
      type: 'cash_redeploy',
      priority: 920,
      title: 'Plan remaining buying power',
      detail: `${plan.sourceLabel} leaves ${formatCurrency(
        plan.cashToPlan,
      )} to assign to holdings, watchlist ideas, or cash after reserve and pay-yourself buckets.`,
      symbol: null,
      valueLabel: formatCurrency(plan.cashToPlan),
      targetView: 'cash',
      primaryAction: 'plan_cash',
      primaryLabel: 'Open cash plan',
      tone: 'pos',
    },
  ]
}

function buildHoldingSetupItems(
  positions: readonly PortfolioPosition[],
): ActionDeskItem[] {
  return positions
    .filter((position) => position.missingFields.length > 0)
    .slice(0, 3)
    .map((position, index) => ({
      id: `holding-setup-${position.symbol}`,
      type: 'holding_setup' as const,
      priority: 860 - index,
      title: `Add lot details for ${position.symbol}`,
      detail: `${position.symbol} needs ${position.missingFields.join(
        ', ',
      )} before position sizing, P/L, trim, and re-entry planning can run.`,
      symbol: position.symbol,
      valueLabel: null,
      targetView: 'planner' as const,
      primaryAction: 'open' as const,
      primaryLabel: 'Open planner',
      tone: 'warn' as const,
    }))
}

function buildRiskTrimItems(
  scenarios: readonly ScenarioCandidate[],
): ActionDeskItem[] {
  const seenSymbols = new Set<string>()
  const items: ActionDeskItem[] = []

  for (const scenario of scenarios) {
    if (seenSymbols.has(scenario.symbol)) {
      continue
    }

    if (
      scenario.concentrationLevel !== 'over_cap' &&
      scenario.concentrationLevel !== 'alert'
    ) {
      continue
    }

    seenSymbols.add(scenario.symbol)
    items.push({
      id: `risk-trim-${scenario.symbol}`,
      type: 'risk_trim',
      priority: scenario.concentrationLevel === 'over_cap' ? 820 : 760,
      title: `Review ${scenario.symbol} trim scenario`,
      detail: `${scenario.positionName} is flagged for concentration. Use the planner to review cash raised, reserve, and remaining weight manually.`,
      symbol: scenario.symbol,
      valueLabel: formatCurrency(scenario.estimatedNetCash),
      targetView: 'planner',
      primaryAction: 'review_trim',
      primaryLabel: 'Review scenario',
      tone: 'warn',
    })
  }

  return items.slice(0, 2)
}

function buildResearchItems(input: BuildActionDeskInput): ActionDeskItem[] {
  const cardBySymbol = new Map(
    input.researchCards.map((card) => [card.symbol, card]),
  )
  const scores = [...input.researchScores]
    .filter((score) => score.scorePercent < 80)
    .sort(compareResearchGaps)
  const items: ActionDeskItem[] = []

  for (const score of scores) {
    const card = cardBySymbol.get(score.symbol)

    if (!card) {
      continue
    }

    items.push(
      buildResearchItem({
        card,
        queue: input.codexQueue[score.symbol],
        run: input.researchRuns[score.symbol],
        score,
      }),
    )

    if (items.length >= 3) {
      break
    }
  }

  return items
}

function buildResearchItem(input: {
  card: SeedWatchlistItem
  queue: ActionDeskQueueSnapshot | undefined
  run: ActionDeskResearchRunSnapshot | undefined
  score: ResearchCandidateScore
}): ActionDeskItem {
  const symbol = input.score.symbol
  const isHolding = input.score.seedType === 'current_holding'
  const basePriority = isHolding ? 740 : 640

  if (input.run?.status === 'needs_review' || input.run?.status === 'stale_source') {
    return {
      id: `research-review-${symbol}`,
      type: 'research_review',
      priority: basePriority + 35,
      title: `Review imported research for ${symbol}`,
      detail: `${symbol} has drafted notes waiting for source review before you use the setup fields.`,
      symbol,
      valueLabel: `${input.score.scorePercent}%`,
      targetView: 'research',
      primaryAction: 'review_research',
      primaryLabel: 'Review card',
      tone: 'warn',
    }
  }

  if (
    input.queue?.status === 'pending' ||
    input.queue?.status === 'missing_result' ||
    input.queue?.status === 'invalid_result'
  ) {
    return {
      id: `research-import-${symbol}`,
      type: 'research_import',
      priority: basePriority + 25,
      title: `Import Codex result for ${symbol}`,
      detail: `${symbol} has a queued research request. Import the validated result JSON so the card can be reviewed.`,
      symbol,
      valueLabel: `${input.score.scorePercent}%`,
      targetView: 'research',
      primaryAction: 'import_result',
      primaryLabel: 'Import result',
      tone: input.queue.status === 'invalid_result' ? 'warn' : 'neutral',
    }
  }

  return {
    id: `research-queue-${symbol}`,
    type: 'research_queue',
    priority: basePriority,
    title: `Queue Codex research for ${symbol}`,
    detail: `${symbol} is missing ${input.score.missingFields
      .slice(0, 3)
      .join(', ')}. Create a source-backed request, then import the result for manual review.`,
    symbol,
    valueLabel: `${input.score.scorePercent}%`,
    targetView: 'research',
    primaryAction: 'queue_research',
    primaryLabel: 'Queue research',
    tone: 'neutral',
  }
}

function compareActionItems(first: ActionDeskItem, second: ActionDeskItem): number {
  if (second.priority !== first.priority) {
    return second.priority - first.priority
  }

  return `${first.symbol ?? ''}-${first.id}`.localeCompare(
    `${second.symbol ?? ''}-${second.id}`,
  )
}

function compareResearchGaps(
  first: ResearchCandidateScore,
  second: ResearchCandidateScore,
): number {
  if (first.seedType !== second.seedType) {
    return first.seedType === 'current_holding' ? -1 : 1
  }

  if (first.scorePercent !== second.scorePercent) {
    return first.scorePercent - second.scorePercent
  }

  return first.symbol.localeCompare(second.symbol)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value)
}
