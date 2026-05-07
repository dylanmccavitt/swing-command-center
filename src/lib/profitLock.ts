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
        'Manual scenario for reducing this position to the selected concentration target.',
      sharesToSell: sharesForTargetWeight(
        position,
        input.portfolioMarketValue,
        targetWeightPercent,
      ),
      unavailableNote: 'Position is already at or below the selected target.',
    },
    ...GAIN_LOCK_PERCENTS.map((percent) => ({
      id: `lock_${percent}_percent_gain` as ProfitLockScenarioId,
      title: `Lock ${percent}% of unrealized gain`,
      description:
        'Manual scenario for realizing a slice of the open gain while leaving the rest of the position intact.',
      sharesToSell: sharesForGainLock(position, percent),
      unavailableNote:
        'This scenario needs a positive unrealized gain per share.',
    })),
    {
      id: 'recover_cost_basis',
      title: 'Recover cost basis',
      description:
        'Manual scenario for raising cash roughly equal to the original cost basis.',
      sharesToSell: sharesForCostBasisRecovery(position),
      unavailableNote: 'Current price is not high enough to recover basis cleanly.',
    },
    {
      id: 'raise_cash_amount',
      title: 'Raise specific cash amount',
      description:
        'Manual scenario for raising the cash target entered in settings.',
      sharesToSell: sharesForCashAmount(position, cashTargetAmount),
      unavailableNote: 'Enter a cash target above $0 to draft this scenario.',
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
      ? 'Scenario only. Review manually before creating any order ticket.'
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
