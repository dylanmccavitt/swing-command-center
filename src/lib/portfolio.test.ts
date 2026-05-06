import { describe, expect, it } from 'vitest'
import { seedHoldings } from '../data/seedHoldings'
import { buildPortfolioSeedSummary } from './portfolio'

describe('portfolio seed summary', () => {
  it('keeps the bootstrap holdings limited to the known current symbols', () => {
    const summary = buildPortfolioSeedSummary(seedHoldings)

    expect(summary.symbols).toEqual(['AAPL', 'GOOG', 'NVDA', 'IREN'])
    expect(summary.totalSymbols).toBe(4)
  })

  it('does not invent manual lot details for seeded holdings', () => {
    const summary = buildPortfolioSeedSummary(seedHoldings)

    expect(summary.manualLotsNeeded).toBe(4)
  })
})
