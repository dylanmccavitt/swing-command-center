import type { PortfolioPosition, PortfolioSettings } from './portfolio'
import { isCompletePosition, normalizePortfolioSettings } from './portfolio'

export type ProfitLockScenarioId =
  | 'trim_to_target_weight'
  | 'lock_10_percent_gain'
  | 'lock_20_percent_gain'
  | 'lock_25_percent_gain'
  | 'recover_cost_basis'
  | 'raise_cash_amount'

export type ProfitLockTicket = {
  id: ProfitLockScenarioId
  title: string
  description: string
  status: 'ready' | 'not_applicable'
  note: string
  sharesToSell: number
  estimatedProceeds: number
  estimatedRealizedGain: number
  estimatedTaxReserve: number
  estimatedNetCash: number
  remainingShares: number
  remainingMarketValue: number
  remainingWeightPercent: number | null
}

export type ProfitLockPlannerInput = {
  position: PortfolioPosition | null
  portfolioMarketValue: number
  settings: Partial<PortfolioSettings>
  targetWeightPercent?: number
  cashTargetAmount?: number
}

type TicketDefinition = {
  id: ProfitLockScenarioId
  title: string
  description: string
  sharesToSell: number
  unavailableNote: string
}

const GAIN_LOCK_PERCENTS = [10, 20, 25] as const

export function buildProfitLockTickets(
  input: ProfitLockPlannerInput,
): ProfitLockTicket[] {
  if (!input.position || !isCompletePosition(input.position)) {
    return []
  }

  const settings = normalizePortfolioSettings(input.settings)
  const targetWeightPercent =
    input.targetWeightPercent ?? settings.maxPositionWeightPercent
  const cashTargetAmount = normalizeAmount(input.cashTargetAmount)
  const position = input.position
  const definitions: TicketDefinition[] = [
    {
      id: 'trim_to_target_weight',
      title: `Trim to ${formatPercent(targetWeightPercent)} weight`,
      description:
        'Shows how many shares to sell to get this holding closer to the target size.',
      sharesToSell: sharesForTargetWeight(
        position,
        input.portfolioMarketValue,
        targetWeightPercent,
      ),
      unavailableNote: 'This holding is already at or below that target.',
    },
    ...GAIN_LOCK_PERCENTS.map((percent) => ({
      id: `lock_${percent}_percent_gain` as ProfitLockScenarioId,
      title: `Take ${percent}% of open gain`,
      description:
        'Shows a small trim that turns part of the open gain into cash while keeping the rest.',
      sharesToSell: sharesForGainLock(position, percent),
      unavailableNote: 'Needs a positive open gain per share.',
    })),
    {
      id: 'recover_cost_basis',
      title: 'Recover cost basis',
      description:
        'Shows a trim that could pull back roughly your original cost.',
      sharesToSell: sharesForCostBasisRecovery(position),
      unavailableNote: 'The current price is not high enough to recover cost cleanly.',
    },
    {
      id: 'raise_cash_amount',
      title: 'Raise cash goal',
      description: 'Shows how many shares could raise the cash goal in settings.',
      sharesToSell: sharesForCashAmount(position, cashTargetAmount),
      unavailableNote: 'Set a cash goal above $0 to show this idea.',
    },
  ]

  return definitions.map((definition) =>
    buildTicket({
      definition,
      position,
      portfolioMarketValue: input.portfolioMarketValue,
      settings,
    }),
  )
}

export function estimateTaxReserve(
  realizedGain: number,
  settings: Partial<PortfolioSettings>,
): number {
  const normalizedSettings = normalizePortfolioSettings(settings)

  if (!normalizedSettings.taxReserveEnabled || realizedGain <= 0) {
    return 0
  }

  return realizedGain * (normalizedSettings.taxReserveRatePercent / 100)
}

function buildTicket(input: {
  definition: TicketDefinition
  position: PortfolioPosition & {
    shares: number
    averageCost: number
    currentPrice: number
    marketValue: number
  }
  portfolioMarketValue: number
  settings: PortfolioSettings
}): ProfitLockTicket {
  const sharesToSell = clamp(input.definition.sharesToSell, 0, input.position.shares)
  const estimatedProceeds = sharesToSell * input.position.currentPrice
  const estimatedRealizedGain =
    sharesToSell * (input.position.currentPrice - input.position.averageCost)
  const estimatedTaxReserve = estimateTaxReserve(
    estimatedRealizedGain,
    input.settings,
  )
  const remainingShares = input.position.shares - sharesToSell
  const remainingMarketValue = remainingShares * input.position.currentPrice
  const remainingWeightPercent =
    input.portfolioMarketValue > 0
      ? (remainingMarketValue / input.portfolioMarketValue) * 100
      : null
  const isReady = sharesToSell > 0

  return {
    id: input.definition.id,
    title: input.definition.title,
    description: input.definition.description,
    status: isReady ? 'ready' : 'not_applicable',
    note: isReady
      ? 'Planning math only. Review it yourself before creating any order.'
      : input.definition.unavailableNote,
    sharesToSell,
    estimatedProceeds,
    estimatedRealizedGain,
    estimatedTaxReserve,
    estimatedNetCash: estimatedProceeds - estimatedTaxReserve,
    remainingShares,
    remainingMarketValue,
    remainingWeightPercent,
  }
}

function sharesForTargetWeight(
  position: PortfolioPosition & {
    shares: number
    currentPrice: number
    marketValue: number
  },
  portfolioMarketValue: number,
  targetWeightPercent: number,
): number {
  if (portfolioMarketValue <= 0 || targetWeightPercent <= 0) {
    return 0
  }

  const targetPositionValue = portfolioMarketValue * (targetWeightPercent / 100)
  const saleValue = position.marketValue - targetPositionValue

  return saleValue > 0 ? saleValue / position.currentPrice : 0
}

function sharesForGainLock(
  position: PortfolioPosition & {
    averageCost: number
    currentPrice: number
    unrealizedGain: number
  },
  lockPercent: number,
): number {
  const gainPerShare = position.currentPrice - position.averageCost

  if (gainPerShare <= 0 || position.unrealizedGain <= 0) {
    return 0
  }

  return (position.unrealizedGain * (lockPercent / 100)) / gainPerShare
}

function sharesForCostBasisRecovery(
  position: PortfolioPosition & {
    averageCost: number
    currentPrice: number
    costBasis: number
  },
): number {
  if (position.currentPrice <= position.averageCost) {
    return 0
  }

  return position.costBasis / position.currentPrice
}

function sharesForCashAmount(
  position: PortfolioPosition & {
    currentPrice: number
  },
  cashTargetAmount: number,
): number {
  return cashTargetAmount > 0 ? cashTargetAmount / position.currentPrice : 0
}

function normalizeAmount(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`
}
