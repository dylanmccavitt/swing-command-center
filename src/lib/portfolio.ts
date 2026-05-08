export type PortfolioSettings = {
  maxPositionWeightPercent: number
  alertPositionWeightPercent: number
  taxReserveRatePercent: number
  taxReserveEnabled: boolean
  cashRunwayDollars: number
  activeTradingSleeveDollars: number
}

export type PortfolioHoldingInput = {
  symbol: string
  name: string
  stackLayer: string
  thesisTag: string
  shares: number | null
  averageCost: number | null
  currentPrice: number | null
}

export type ConcentrationLevel =
  | 'needs_input'
  | 'within_rules'
  | 'alert'
  | 'over_cap'

export type PortfolioPosition = PortfolioHoldingInput & {
  marketValue: number | null
  costBasis: number | null
  unrealizedGain: number | null
  unrealizedGainPercent: number | null
  weightPercent: number | null
  concentrationLevel: ConcentrationLevel
  concentrationLabel: string
  concentrationDetail: string
  missingFields: string[]
}

export type PortfolioModel = {
  positions: PortfolioPosition[]
  completePositions: PortfolioPosition[]
  totalMarketValue: number
  totalCostBasis: number
  totalUnrealizedGain: number
  completePositionCount: number
  manualLotsNeeded: number
  rules: {
    maxPositionWeightPercent: number
    alertPositionWeightPercent: number
    alertDefinition: string
  }
  settings: PortfolioSettings
}

export type PortfolioSeedSummary = {
  totalSymbols: number
  symbols: string[]
  manualLotsNeeded: number
}

export type PortfolioSeedHolding = {
  symbol: string
  shares: number | null
  averageCost: number | null
}

export const DEFAULT_PORTFOLIO_SETTINGS: PortfolioSettings = {
  maxPositionWeightPercent: 30,
  alertPositionWeightPercent: 25,
  taxReserveRatePercent: 25,
  taxReserveEnabled: true,
  cashRunwayDollars: 0,
  activeTradingSleeveDollars: 0,
}

export function buildPortfolioSeedSummary(
  holdings: readonly PortfolioSeedHolding[],
): PortfolioSeedSummary {
  return {
    totalSymbols: holdings.length,
    symbols: holdings.map((holding) => holding.symbol),
    manualLotsNeeded: holdings.filter(
      (holding) => holding.shares === null || holding.averageCost === null,
    ).length,
  }
}

export function normalizePortfolioSettings(
  settings: Partial<PortfolioSettings> = {},
): PortfolioSettings {
  const maxPositionWeightPercent = normalizePercent(
    settings.maxPositionWeightPercent,
    DEFAULT_PORTFOLIO_SETTINGS.maxPositionWeightPercent,
  )
  const requestedAlertWeightPercent = normalizePercent(
    settings.alertPositionWeightPercent,
    DEFAULT_PORTFOLIO_SETTINGS.alertPositionWeightPercent,
  )

  return {
    maxPositionWeightPercent,
    alertPositionWeightPercent: Math.min(
      requestedAlertWeightPercent,
      maxPositionWeightPercent,
    ),
    taxReserveRatePercent: normalizePercent(
      settings.taxReserveRatePercent,
      DEFAULT_PORTFOLIO_SETTINGS.taxReserveRatePercent,
    ),
    taxReserveEnabled:
      settings.taxReserveEnabled ??
      DEFAULT_PORTFOLIO_SETTINGS.taxReserveEnabled,
    cashRunwayDollars: normalizeNonNegativeAmount(
      settings.cashRunwayDollars,
      DEFAULT_PORTFOLIO_SETTINGS.cashRunwayDollars,
    ),
    activeTradingSleeveDollars: normalizeNonNegativeAmount(
      settings.activeTradingSleeveDollars,
      DEFAULT_PORTFOLIO_SETTINGS.activeTradingSleeveDollars,
    ),
  }
}

export function buildPortfolioModel(
  holdings: readonly PortfolioHoldingInput[],
  settings: Partial<PortfolioSettings> = {},
): PortfolioModel {
  const normalizedSettings = normalizePortfolioSettings(settings)
  const firstPass = holdings.map((holding) => buildPositionBase(holding))
  const totalMarketValue = sumCompleteField(firstPass, 'marketValue')
  const totalCostBasis = sumCompleteField(firstPass, 'costBasis')
  const totalUnrealizedGain = sumCompleteField(firstPass, 'unrealizedGain')
  const positions = firstPass.map((position) =>
    applyPortfolioWeight(position, totalMarketValue, normalizedSettings),
  )
  const completePositions = positions.filter(isCompletePosition)

  return {
    positions,
    completePositions,
    totalMarketValue,
    totalCostBasis,
    totalUnrealizedGain,
    completePositionCount: completePositions.length,
    manualLotsNeeded: positions.filter(
      (position) => position.missingFields.length > 0,
    ).length,
    rules: {
      maxPositionWeightPercent: normalizedSettings.maxPositionWeightPercent,
      alertPositionWeightPercent:
        normalizedSettings.alertPositionWeightPercent,
      alertDefinition: `Warning starts at ${formatRulePercent(
        normalizedSettings.alertPositionWeightPercent,
      )}; trim ideas start at the hard cap of ${formatRulePercent(
        normalizedSettings.maxPositionWeightPercent,
      )}.`,
    },
    settings: normalizedSettings,
  }
}

export function isCompletePosition(
  position: PortfolioPosition,
): position is PortfolioPosition & {
  shares: number
  averageCost: number
  currentPrice: number
  marketValue: number
  costBasis: number
  unrealizedGain: number
  unrealizedGainPercent: number
  weightPercent: number
} {
  return (
    position.missingFields.length === 0 &&
    position.shares !== null &&
    position.averageCost !== null &&
    position.currentPrice !== null &&
    position.marketValue !== null &&
    position.costBasis !== null &&
    position.unrealizedGain !== null &&
    position.unrealizedGainPercent !== null &&
    position.weightPercent !== null
  )
}

function buildPositionBase(holding: PortfolioHoldingInput): PortfolioPosition {
  const missingFields = getMissingFields(holding)

  if (missingFields.length > 0) {
    return {
      ...holding,
      marketValue: null,
      costBasis: null,
      unrealizedGain: null,
      unrealizedGainPercent: null,
      weightPercent: null,
      concentrationLevel: 'needs_input',
      concentrationLabel: 'Needs details',
      concentrationDetail: `Add ${missingFields.join(
        ', ',
      )} before position-size or gain-lock math runs.`,
      missingFields,
    }
  }

  const shares = holding.shares as number
  const averageCost = holding.averageCost as number
  const currentPrice = holding.currentPrice as number
  const marketValue = shares * currentPrice
  const costBasis = shares * averageCost
  const unrealizedGain = marketValue - costBasis
  const unrealizedGainPercent =
    costBasis > 0 ? (unrealizedGain / costBasis) * 100 : null

  return {
    ...holding,
    marketValue,
    costBasis,
    unrealizedGain,
    unrealizedGainPercent,
    weightPercent: null,
    concentrationLevel: 'needs_input',
    concentrationLabel: 'Needs portfolio total',
    concentrationDetail:
      'Complete at least one position before concentration math runs.',
    missingFields,
  }
}

function applyPortfolioWeight(
  position: PortfolioPosition,
  totalMarketValue: number,
  settings: PortfolioSettings,
): PortfolioPosition {
  if (!isPositionValued(position) || totalMarketValue <= 0) {
    return position
  }

  const weightPercent = (position.marketValue / totalMarketValue) * 100

  if (weightPercent >= settings.maxPositionWeightPercent) {
    return {
      ...position,
      weightPercent,
      concentrationLevel: 'over_cap',
      concentrationLabel: 'Trim idea',
      concentrationDetail: `${formatRulePercent(
        weightPercent,
      )} is at or above the ${formatRulePercent(
        settings.maxPositionWeightPercent,
      )} hard cap.`,
    }
  }

  if (weightPercent >= settings.alertPositionWeightPercent) {
    return {
      ...position,
      weightPercent,
      concentrationLevel: 'alert',
      concentrationLabel: 'Warning',
      concentrationDetail: `${formatRulePercent(
        weightPercent,
      )} is above the ${formatRulePercent(
        settings.alertPositionWeightPercent,
      )} warning level.`,
    }
  }

  return {
    ...position,
    weightPercent,
    concentrationLevel: 'within_rules',
    concentrationLabel: 'Within rules',
    concentrationDetail: `${formatRulePercent(
      weightPercent,
    )} is below the alert level.`,
  }
}

function getMissingFields(holding: PortfolioHoldingInput): string[] {
  const missingFields: string[] = []

  if (!isPositiveNumber(holding.shares)) {
    missingFields.push('shares')
  }

  if (!isNonNegativeNumber(holding.averageCost)) {
    missingFields.push('average cost')
  }

  if (!isPositiveNumber(holding.currentPrice)) {
    missingFields.push('current price')
  }

  return missingFields
}

function isPositionValued(position: PortfolioPosition): position is
  PortfolioPosition & {
    marketValue: number
  } {
  return typeof position.marketValue === 'number'
}

function sumCompleteField(
  positions: readonly PortfolioPosition[],
  field: 'marketValue' | 'costBasis' | 'unrealizedGain',
): number {
  return positions.reduce((sum, position) => {
    const value = position[field]

    return typeof value === 'number' ? sum + value : sum
  }, 0)
}

function normalizePercent(value: number | undefined, fallback: number): number {
  if (!isPositiveNumber(value)) {
    return fallback
  }

  return Math.min(value, 100)
}

function normalizeNonNegativeAmount(
  value: number | undefined,
  fallback: number,
): number {
  return isNonNegativeNumber(value) ? value : fallback
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isNonNegativeNumber(
  value: number | null | undefined,
): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function formatRulePercent(value: number): string {
  return `${trimTrailingZeros(value)}%`
}

function trimTrailingZeros(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}
