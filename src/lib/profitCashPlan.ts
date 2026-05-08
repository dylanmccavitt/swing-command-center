import type { PortfolioPosition } from './portfolio'
import type { ResearchCandidateScore } from './researchWatchlist'
import type { BuyingPowerSummary } from './sellFills'
import type { RealizedProfitSummary } from './tradeJournal'

export const PROFIT_CASH_PLAN_DISCLOSURE =
  'Manual planning only. This uses filled-sell buying power when provided. It does not recommend buys or sells, move money automatically, connect to a broker, or provide tax advice.'

export type ProfitCashCandidateKind = 'current_holding' | 'watchlist' | 'cash'

export type ProfitCashCandidate = {
  id: string
  kind: ProfitCashCandidateKind
  symbol: string
  name: string
  label: string
  currentPrice: number | null
  estimatedShares: number | null
  researchScorePercent: number | null
  statusLabel: string
  reason: string
  nextStep: string
}

export type ProfitCashPlan = {
  profitAfterReserve: number
  startingCash: number
  filledSellProceeds: number
  reserveSetAside: number
  payYourselfAmount: number
  manuallyReinvestedCash: number
  cashToPlan: number
  sourceLabel: string
  candidates: ProfitCashCandidate[]
  disclosure: string
}

export function buildProfitCashPlan(input: {
  summary?: RealizedProfitSummary
  buyingPower?: BuyingPowerSummary
  positions: readonly PortfolioPosition[]
  researchScores: readonly ResearchCandidateScore[]
  quotesBySymbol?: ReadonlyMap<string, { price: number | null } | undefined>
  watchlistLimit?: number
}): ProfitCashPlan {
  const cashSource = buildCashSource(input.summary, input.buyingPower)
  const { cashToPlan, payYourselfAmount, profitAfterReserve } = cashSource
  const scoreBySymbol = new Map(
    input.researchScores.map((score) => [score.symbol, score]),
  )
  const holdingSymbols = new Set(
    input.positions.map((position) => position.symbol),
  )
  const holdingCandidates = input.positions.map((position) =>
    buildHoldingCandidate({
      cashToPlan,
      position,
      score: scoreBySymbol.get(position.symbol) ?? null,
    }),
  )
  const watchlistLimit = input.watchlistLimit ?? 6
  const watchlistCandidates = input.researchScores
    .filter((score) => !holdingSymbols.has(score.symbol))
    .slice(0, watchlistLimit)
    .map((score) =>
      buildWatchlistCandidate({
        cashToPlan,
        price: input.quotesBySymbol?.get(score.symbol)?.price ?? null,
        score,
      }),
    )

  return {
    profitAfterReserve,
    startingCash: cashSource.startingCash,
    filledSellProceeds: cashSource.filledSellProceeds,
    reserveSetAside: cashSource.reserveSetAside,
    payYourselfAmount,
    manuallyReinvestedCash: cashSource.manuallyReinvestedCash,
    cashToPlan,
    sourceLabel: cashSource.sourceLabel,
    candidates: [
      ...holdingCandidates,
      ...watchlistCandidates,
      buildCashCandidate(cashToPlan),
    ],
    disclosure: PROFIT_CASH_PLAN_DISCLOSURE,
  }
}

function buildCashSource(
  summary: RealizedProfitSummary | undefined,
  buyingPower: BuyingPowerSummary | undefined,
): {
  profitAfterReserve: number
  startingCash: number
  filledSellProceeds: number
  reserveSetAside: number
  payYourselfAmount: number
  manuallyReinvestedCash: number
  cashToPlan: number
  sourceLabel: string
} {
  if (buyingPower) {
    const cashBeforePayYourself = Math.max(
      0,
      buyingPower.startingCash +
        buyingPower.filledSellProceeds -
        buyingPower.taxReserveSetAside,
    )

    return {
      profitAfterReserve: cashBeforePayYourself,
      startingCash: buyingPower.startingCash,
      filledSellProceeds: buyingPower.filledSellProceeds,
      reserveSetAside: buyingPower.taxReserveSetAside,
      payYourselfAmount: buyingPower.payYourselfSetAside,
      manuallyReinvestedCash: buyingPower.manuallyReinvestedCash,
      cashToPlan: buyingPower.remainingCashAvailable,
      sourceLabel: 'Filled sell buying power',
    }
  }

  const profitAfterReserve = positiveAmount(summary?.profitAfterReserve ?? 0)
  const payYourselfAmount = Math.min(
    profitAfterReserve,
    positiveAmount(summary?.recommendedPayYourselfAmount ?? 0),
  )

  return {
    profitAfterReserve,
    startingCash: 0,
    filledSellProceeds: 0,
    reserveSetAside: positiveAmount(summary?.taxReserveEstimate ?? 0),
    payYourselfAmount,
    manuallyReinvestedCash: 0,
    cashToPlan: Math.max(0, profitAfterReserve - payYourselfAmount),
    sourceLabel: 'Journal profit summary',
  }
}

function buildHoldingCandidate(input: {
  cashToPlan: number
  position: PortfolioPosition
  score: ResearchCandidateScore | null
}): ProfitCashCandidate {
  const { position } = input
  const isOversized =
    position.concentrationLevel === 'over_cap' ||
    position.concentrationLevel === 'alert'

  return {
    id: `${position.symbol}-current-holding`,
    kind: 'current_holding',
    symbol: position.symbol,
    name: position.name,
    label: 'Current holding',
    currentPrice: positiveNumberOrNull(position.currentPrice),
    estimatedShares: estimateShares(
      input.cashToPlan,
      positiveNumberOrNull(position.currentPrice),
    ),
    researchScorePercent: input.score?.scorePercent ?? null,
    statusLabel: position.concentrationLabel,
    reason: isOversized
      ? 'Already near or over your size rule. Use this row as a risk check before putting profit cash back here.'
      : 'Already in your holdings. Review whether adding more keeps the position inside your size rules.',
    nextStep:
      'Open the research card, check the setup and invalidation, then decide manually where the cash goes.',
  }
}

function buildWatchlistCandidate(input: {
  cashToPlan: number
  price: number | null
  score: ResearchCandidateScore
}): ProfitCashCandidate {
  return {
    id: `${input.score.symbol}-watchlist`,
    kind: 'watchlist',
    symbol: input.score.symbol,
    name: input.score.name,
    label: 'Research idea',
    currentPrice: positiveNumberOrNull(input.price),
    estimatedShares: estimateShares(input.cashToPlan, input.price),
    researchScorePercent: input.score.scorePercent,
    statusLabel: input.score.statusLabel,
    reason:
      'On your research list. Source notes, entry, stop, target, and max loss need to be clear before using profit cash.',
    nextStep:
      'Run or import research, then fill the trade setup fields before turning this into a checklist.',
  }
}

function buildCashCandidate(cashToPlan: number): ProfitCashCandidate {
  return {
    id: 'cash-parking',
    kind: 'cash',
    symbol: 'CASH',
    name: 'Keep cash available',
    label: 'Cash',
    currentPrice: null,
    estimatedShares: null,
    researchScorePercent: null,
    statusLabel: cashToPlan > 0 ? 'Available' : 'No profit cash yet',
    reason:
      'Cash can stay unassigned when no setup is clear or when you want room for a better entry later.',
    nextStep:
      'Write a quick note in the journal if you leave the money unassigned.',
  }
}

function estimateShares(cashToPlan: number, price: number | null): number | null {
  if (cashToPlan <= 0 || price === null || price <= 0) {
    return null
  }

  return cashToPlan / price
}

function positiveNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function positiveAmount(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}
