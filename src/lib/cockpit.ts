import type { ProfitLockTicket } from './profitLock'
import { buildProfitLockTickets } from './profitLock'
import type { PortfolioModel, PortfolioPosition } from './portfolio'
import { isCompletePosition } from './portfolio'

export type ScenarioCandidate = ProfitLockTicket & {
  symbol: string
  positionName: string
  concentrationLevel: PortfolioPosition['concentrationLevel']
  rankScore: number
}

export type ConcentrationSummary = {
  state: 'needs_input' | 'within_rules' | 'alert' | 'over_cap'
  label: string
  detail: string
  atRiskCount: number
  needsInputCount: number
  maxWeightPercent: number | null
}

export type CashRunwaySummary = {
  targetAmount: number
  bestScenarioNetCash: number
  shortfallAmount: number | null
  label: string
  detail: string
}

export type AllocationRow = {
  symbol: string
  name: string
  marketValue: number
  weightPercent: number
  color: string
}

export type GainRow = {
  symbol: string
  name: string
  unrealizedGain: number
  unrealizedGainPercent: number
  marketValue: number
  color: string
}

export type ConcentrationRow = {
  symbol: string
  label: string
  weightPercent: number | null
  concentrationLevel: PortfolioPosition['concentrationLevel']
  detail: string
  color: string
}

const SYMBOL_COLORS: Record<string, string> = {
  AAPL: '#246b57',
  GOOG: '#234f8e',
  NVDA: '#8a6b21',
  IREN: '#9a3f35',
  AMD: '#6f4b8b',
  TSM: '#2f6f8f',
  MU: '#586b2e',
  ASML: '#755c33',
  SNPS: '#5c4c93',
  ANET: '#2d7373',
  VRT: '#7c6f2a',
  CEG: '#8c4f4f',
}

export function buildTopProfitLockScenarios(input: {
  model: PortfolioModel
  cashTargetAmount: number
  limit?: number
}): ScenarioCandidate[] {
  const limit = input.limit ?? 3
  const candidates = input.model.completePositions.flatMap((position) =>
    buildProfitLockTickets({
      position,
      portfolioMarketValue: input.model.totalMarketValue,
      settings: input.model.settings,
      targetWeightPercent: input.model.settings.maxPositionWeightPercent,
      cashTargetAmount: input.cashTargetAmount,
    }).map((ticket) => ({
      ...ticket,
      symbol: position.symbol,
      positionName: position.name,
      concentrationLevel: position.concentrationLevel,
      rankScore: getScenarioRankScore(position, ticket),
    })),
  )

  return candidates
    .filter((ticket) => ticket.status === 'ready')
    .sort((first, second) => {
      if (second.rankScore !== first.rankScore) {
        return second.rankScore - first.rankScore
      }

      if (second.estimatedNetCash !== first.estimatedNetCash) {
        return second.estimatedNetCash - first.estimatedNetCash
      }

      return `${first.symbol}-${first.title}`.localeCompare(
        `${second.symbol}-${second.title}`,
      )
    })
    .slice(0, limit)
}

export function summarizeConcentrationRisk(
  model: PortfolioModel,
): ConcentrationSummary {
  const needsInputCount = model.positions.filter(
    (position) => position.concentrationLevel === 'needs_input',
  ).length
  const overCapPositions = model.completePositions.filter(
    (position) => position.concentrationLevel === 'over_cap',
  )
  const alertPositions = model.completePositions.filter(
    (position) => position.concentrationLevel === 'alert',
  )
  const maxWeightPercent = model.completePositions.reduce<number | null>(
    (currentMax, position) => {
      if (!isCompletePosition(position)) {
        return currentMax
      }

      return currentMax === null
        ? position.weightPercent
        : Math.max(currentMax, position.weightPercent)
    },
    null,
  )

  if (model.completePositionCount === 0) {
    return {
      state: 'needs_input',
      label: 'Needs details',
      detail: `Add shares and average cost for ${needsInputCount} positions before using risk numbers.`,
      atRiskCount: 0,
      needsInputCount,
      maxWeightPercent,
    }
  }

  if (overCapPositions.length > 0) {
    return {
      state: 'over_cap',
      label: 'Too big',
      detail: `${overCapPositions.length} position ${
        overCapPositions.length === 1 ? 'is' : 'are'
      } at or above the ${formatCompactPercent(
        model.settings.maxPositionWeightPercent,
      )} hard cap.`,
      atRiskCount: overCapPositions.length,
      needsInputCount,
      maxWeightPercent,
    }
  }

  if (alertPositions.length > 0) {
    return {
      state: 'alert',
      label: 'Warning',
      detail: `${alertPositions.length} position ${
        alertPositions.length === 1 ? 'is' : 'are'
      } above the ${formatCompactPercent(
        model.settings.alertPositionWeightPercent,
      )} warning level.`,
      atRiskCount: alertPositions.length,
      needsInputCount,
      maxWeightPercent,
    }
  }

  return {
    state: 'within_rules',
    label: 'Within rules',
    detail:
      needsInputCount > 0
        ? `${model.completePositionCount} positions have shares and cost; ${needsInputCount} still need details.`
        : 'Modeled positions are below the alert threshold.',
    atRiskCount: 0,
    needsInputCount,
    maxWeightPercent,
  }
}

export function summarizeCashRunway(
  model: PortfolioModel,
  topScenarios: readonly ScenarioCandidate[],
): CashRunwaySummary {
  const targetAmount = model.settings.cashRunwayDollars
  const bestScenarioNetCash = topScenarios.reduce(
    (best, ticket) => Math.max(best, ticket.estimatedNetCash),
    0,
  )

  if (targetAmount <= 0) {
    return {
      targetAmount,
      bestScenarioNetCash,
      shortfallAmount: null,
      label: 'No target',
      detail:
        bestScenarioNetCash > 0
          ? 'Cash ideas are ready, but the cash goal is set to $0.'
          : 'Set a cash goal to compare trim ideas.',
    }
  }

  if (bestScenarioNetCash <= 0) {
    return {
      targetAmount,
      bestScenarioNetCash,
      shortfallAmount: targetAmount,
      label: 'Needs details',
      detail: 'Add shares and cost first so cash ideas can be compared.',
    }
  }

  if (bestScenarioNetCash >= targetAmount) {
    return {
      targetAmount,
      bestScenarioNetCash,
      shortfallAmount: 0,
      label: 'Covered',
      detail: 'The best cash idea covers the cash goal.',
    }
  }

  return {
    targetAmount,
    bestScenarioNetCash,
    shortfallAmount: targetAmount - bestScenarioNetCash,
    label: 'Short',
    detail: 'The best cash idea is still below the cash goal.',
  }
}

export function buildAllocationRows(model: PortfolioModel): AllocationRow[] {
  return model.completePositions
    .filter(isCompletePosition)
    .map((position) => ({
      symbol: position.symbol,
      name: position.name,
      marketValue: position.marketValue,
      weightPercent: position.weightPercent,
      color: getSymbolColor(position.symbol),
    }))
    .sort((first, second) => second.marketValue - first.marketValue)
}

export function buildGainRows(model: PortfolioModel): GainRow[] {
  return model.completePositions
    .filter(isCompletePosition)
    .map((position) => ({
      symbol: position.symbol,
      name: position.name,
      unrealizedGain: position.unrealizedGain,
      unrealizedGainPercent: position.unrealizedGainPercent,
      marketValue: position.marketValue,
      color: getSymbolColor(position.symbol),
    }))
    .sort((first, second) => second.unrealizedGain - first.unrealizedGain)
}

export function buildConcentrationRows(
  model: PortfolioModel,
): ConcentrationRow[] {
  return model.positions.map((position) => ({
    symbol: position.symbol,
    label: position.concentrationLabel,
    weightPercent: position.weightPercent,
    concentrationLevel: position.concentrationLevel,
    detail: position.concentrationDetail,
    color: getSymbolColor(position.symbol),
  }))
}

export function getSymbolColor(symbol: string): string {
  return SYMBOL_COLORS[symbol] ?? '#53615a'
}

function getScenarioRankScore(
  position: PortfolioPosition,
  ticket: ProfitLockTicket,
): number {
  const concentrationScore =
    position.concentrationLevel === 'over_cap'
      ? 1_000_000
      : position.concentrationLevel === 'alert'
        ? 500_000
        : 0
  const scenarioScore =
    ticket.id === 'trim_to_target_weight'
      ? 75_000
      : ticket.id === 'recover_cost_basis'
        ? 40_000
        : ticket.id === 'raise_cash_amount'
          ? 30_000
          : 10_000

  return concentrationScore + scenarioScore + ticket.estimatedNetCash
}

function formatCompactPercent(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`
}
