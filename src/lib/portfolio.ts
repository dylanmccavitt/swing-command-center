import type { SeedHolding } from '../data/seedHoldings'

export type PortfolioSeedSummary = {
  totalSymbols: number
  symbols: string[]
  manualLotsNeeded: number
}

export function buildPortfolioSeedSummary(
  holdings: readonly SeedHolding[],
): PortfolioSeedSummary {
  return {
    totalSymbols: holdings.length,
    symbols: holdings.map((holding) => holding.symbol),
    manualLotsNeeded: holdings.filter(
      (holding) => holding.shares === null || holding.averageCost === null,
    ).length,
  }
}
