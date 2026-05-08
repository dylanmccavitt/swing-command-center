export const SCENARIO_PLANNER_DISCLOSURE =
  'Manual scenario for review only. Not a recommendation, guaranteed outcome, order ticket, tax advice, or buy/sell instruction.'

export type ScenarioPlannerQuoteState =
  | 'fresh'
  | 'stale'
  | 'mock'
  | 'manual'
  | 'missing'

export type ScenarioPlannerInput = {
  symbol: string
  name: string
  sourceLabel: string
  currentPrice: number | null
  averageCost: number | null
  shares: number | null
  maxLossDollars: number | null
  desiredRiskReward: number | null
  targetGainPercent: number | null
  trimPercent: number | null
  supportPrice: number | null
  stopLimitBufferPercent: number | null
  timeHorizon: string
  quoteState: ScenarioPlannerQuoteState
}

export type ScenarioPlannerIssue = {
  code:
    | 'missing_current_price'
    | 'missing_average_cost'
    | 'missing_shares'
    | 'missing_stop_basis'
    | 'missing_risk_reward'
    | 'missing_target_gain'
    | 'missing_trim_percent'
    | 'missing_market_data'
    | 'stale_market_data'
    | 'mock_market_data'
    | 'invalid_risk_reward'
    | 'invalid_trim_percent'
    | 'invalid_stop_level'
  severity: 'missing' | 'warning' | 'invalid'
  message: string
}

export type ScenarioPlannerMetric = {
  value: number | null
  reason: string
}

export type StopLimitMetric = {
  stop: number | null
  limit: number | null
  bufferPercent: number
  note: string
  reason: string
}

export type TargetStopScenario = {
  symbol: string
  name: string
  sourceLabel: string
  status: 'ready' | 'missing_input' | 'invalid'
  disclosure: string
  issues: ScenarioPlannerIssue[]
  plannedEntry: ScenarioPlannerMetric
  stopLevel: ScenarioPlannerMetric
  stopLimit: StopLimitMetric
  firstTarget: ScenarioPlannerMetric
  stretchTarget: ScenarioPlannerMetric
  trimShares: ScenarioPlannerMetric
  estimatedProceeds: ScenarioPlannerMetric
  estimatedGainLoss: ScenarioPlannerMetric
  remainingShares: ScenarioPlannerMetric
  remainingPositionValue: ScenarioPlannerMetric
  timeHorizon: string
}

const DEFAULT_STOP_LIMIT_BUFFER_PERCENT = 0.5
const MAX_STOP_LIMIT_BUFFER_PERCENT = 20

export function buildTargetStopScenario(
  input: ScenarioPlannerInput,
): TargetStopScenario {
  const issues = getScenarioIssues(input)
  const currentPrice = positiveNumberOrNull(input.currentPrice)
  const averageCost = positiveNumberOrNull(input.averageCost)
  const shares = positiveNumberOrNull(input.shares)
  const desiredRiskReward = positiveNumberOrNull(input.desiredRiskReward)
  const targetGainPercent = positiveNumberOrNull(input.targetGainPercent)
  const trimPercent = positiveNumberOrNull(input.trimPercent)
  const supportPrice = positiveNumberOrNull(input.supportPrice)
  const maxLossDollars = positiveNumberOrNull(input.maxLossDollars)
  const stopLimitBufferPercent = normalizeStopLimitBuffer(
    input.stopLimitBufferPercent,
  )
  const stopLevel = getStopLevel({
    currentPrice,
    maxLossDollars,
    shares,
    supportPrice,
  })
  const riskPerShare =
    currentPrice !== null && stopLevel.value !== null
      ? currentPrice - stopLevel.value
      : null
  const firstTarget =
    currentPrice !== null &&
    riskPerShare !== null &&
    riskPerShare > 0 &&
    desiredRiskReward !== null
      ? currentPrice + riskPerShare * desiredRiskReward
      : null
  const stretchTarget =
    currentPrice !== null &&
    riskPerShare !== null &&
    riskPerShare > 0 &&
    desiredRiskReward !== null &&
    targetGainPercent !== null
      ? getStretchTarget({
          currentPrice,
          desiredRiskReward,
          firstTarget,
          riskPerShare,
          targetGainPercent,
        })
      : null
  const trimShares =
    shares !== null && trimPercent !== null
      ? shares * (clamp(trimPercent, 0, 100) / 100)
      : null
  const estimatedProceeds =
    trimShares !== null && firstTarget !== null ? trimShares * firstTarget : null
  const estimatedGainLoss =
    trimShares !== null && firstTarget !== null && averageCost !== null
      ? trimShares * (firstTarget - averageCost)
      : null
  const remainingShares =
    shares !== null && trimShares !== null ? shares - trimShares : null
  const remainingPositionValue =
    remainingShares !== null && firstTarget !== null
      ? remainingShares * firstTarget
      : null
  const stopLimitPrice =
    stopLevel.value !== null
      ? stopLevel.value * (1 - stopLimitBufferPercent / 100)
      : null

  return {
    symbol: input.symbol,
    name: input.name,
    sourceLabel: input.sourceLabel,
    status: getScenarioStatus(issues),
    disclosure: SCENARIO_PLANNER_DISCLOSURE,
    issues,
    plannedEntry: {
      value: currentPrice,
      reason:
        input.quoteState === 'manual'
          ? 'Uses the manually edited current price as the planning entry.'
          : 'Uses the editable current market price as the planning entry.',
    },
    stopLevel,
    stopLimit: {
      stop: stopLevel.value,
      limit: stopLimitPrice,
      bufferPercent: stopLimitBufferPercent,
      note:
        stopLevel.value !== null && stopLimitPrice !== null
          ? `Manual stop-limit note: trigger at stop, example limit ${formatMoney(
              stopLimitPrice,
            )} using a ${formatPercent(
              stopLimitBufferPercent,
            )} buffer below the stop. Limit orders can miss fills.`
          : 'Enter a valid stop before drafting a stop-limit buffer note.',
      reason:
        'Limit buffer is applied below the stop trigger for a long-position review scenario.',
    },
    firstTarget: {
      value: firstTarget,
      reason:
        riskPerShare !== null && desiredRiskReward !== null
          ? `${formatNumber(desiredRiskReward)}R target from ${formatMoney(
              riskPerShare,
            )} risk per share.`
          : 'Enter a valid stop and risk/reward multiple to calculate the first target.',
    },
    stretchTarget: {
      value: stretchTarget,
      reason:
        stretchTarget !== null && currentPrice !== null && firstTarget !== null
          ? getStretchTargetReason({
              currentPrice,
              desiredRiskReward,
              firstTarget,
              riskPerShare,
              targetGainPercent,
            })
          : 'Enter a target gain percent to calculate the stretch target.',
    },
    trimShares: {
      value: trimShares,
      reason:
        shares !== null && trimPercent !== null
          ? `${formatPercent(trimPercent)} trim of ${formatNumber(
              shares,
            )} shares.`
          : 'Enter shares and trim percent to calculate trim size.',
    },
    estimatedProceeds: {
      value: estimatedProceeds,
      reason:
        trimShares !== null && firstTarget !== null
          ? 'Trim shares multiplied by the first target level.'
          : 'Needs trim shares and first target.',
    },
    estimatedGainLoss: {
      value: estimatedGainLoss,
      reason:
        estimatedGainLoss !== null
          ? 'Trim shares multiplied by first target minus average cost.'
          : 'Average cost is required before gain/loss can be estimated.',
    },
    remainingShares: {
      value: remainingShares,
      reason:
        remainingShares !== null
          ? 'Current shares minus planned trim shares.'
          : 'Needs shares and trim percent.',
    },
    remainingPositionValue: {
      value: remainingPositionValue,
      reason:
        remainingPositionValue !== null
          ? 'Remaining shares valued at the first target scenario level.'
          : 'Needs remaining shares and first target.',
    },
    timeHorizon: input.timeHorizon.trim() || 'Not set',
  }
}

function getScenarioIssues(
  input: ScenarioPlannerInput,
): ScenarioPlannerIssue[] {
  const issues: ScenarioPlannerIssue[] = []
  const currentPrice = positiveNumberOrNull(input.currentPrice)
  const shares = positiveNumberOrNull(input.shares)
  const supportPrice = positiveNumberOrNull(input.supportPrice)
  const maxLossDollars = positiveNumberOrNull(input.maxLossDollars)

  if (input.quoteState === 'missing') {
    issues.push({
      code: 'missing_market_data',
      severity: 'missing',
      message:
        'Market data is missing for this symbol; enter a manual current price before reviewing levels.',
    })
  }

  if (input.quoteState === 'stale') {
    issues.push({
      code: 'stale_market_data',
      severity: 'warning',
      message:
        'Current price is based on stale or delayed market data; refresh or edit it manually.',
    })
  }

  if (input.quoteState === 'mock') {
    issues.push({
      code: 'mock_market_data',
      severity: 'warning',
      message:
        'Current price is using mock market data; treat the levels as layout-only until price is verified.',
    })
  }

  if (currentPrice === null) {
    issues.push({
      code: 'missing_current_price',
      severity: 'missing',
      message: 'Current price is required for planned entry and target math.',
    })
  }

  if (positiveNumberOrNull(input.averageCost) === null) {
    issues.push({
      code: 'missing_average_cost',
      severity: 'missing',
      message: 'Average cost is required for estimated gain/loss.',
    })
  }

  if (shares === null) {
    issues.push({
      code: 'missing_shares',
      severity: 'missing',
      message: 'Shares are required for trim size, proceeds, and remaining position.',
    })
  }

  if (supportPrice === null && maxLossDollars === null) {
    issues.push({
      code: 'missing_stop_basis',
      severity: 'missing',
      message:
        'Enter either a support/reference price or max loss dollars to calculate the stop level.',
    })
  }

  if (input.desiredRiskReward !== null && input.desiredRiskReward <= 0) {
    issues.push({
      code: 'invalid_risk_reward',
      severity: 'invalid',
      message: 'Desired risk/reward must be greater than 0.',
    })
  } else if (positiveNumberOrNull(input.desiredRiskReward) === null) {
    issues.push({
      code: 'missing_risk_reward',
      severity: 'missing',
      message: 'Desired risk/reward is required for the first target.',
    })
  }

  if (positiveNumberOrNull(input.targetGainPercent) === null) {
    issues.push({
      code: 'missing_target_gain',
      severity: 'missing',
      message: 'Target gain percent is required for the stretch target.',
    })
  }

  if (input.trimPercent !== null && input.trimPercent <= 0) {
    issues.push({
      code: 'invalid_trim_percent',
      severity: 'invalid',
      message: 'Trim percent must be greater than 0.',
    })
  } else if (positiveNumberOrNull(input.trimPercent) === null) {
    issues.push({
      code: 'missing_trim_percent',
      severity: 'missing',
      message: 'Trim percent is required for trim size and proceeds.',
    })
  }

  if (
    currentPrice !== null &&
    supportPrice !== null &&
    supportPrice >= currentPrice
  ) {
    issues.push({
      code: 'invalid_stop_level',
      severity: 'invalid',
      message:
        'Stop level for a long-position scenario must be below planned entry.',
    })
  }

  if (
    currentPrice !== null &&
    supportPrice === null &&
    maxLossDollars !== null &&
    shares !== null &&
    currentPrice - maxLossDollars / shares <= 0
  ) {
    issues.push({
      code: 'invalid_stop_level',
      severity: 'invalid',
      message:
        'Max loss dollars creates a stop at or below $0. Lower the risk budget or add a support price.',
    })
  }

  return issues
}

function getStopLevel(input: {
  currentPrice: number | null
  maxLossDollars: number | null
  shares: number | null
  supportPrice: number | null
}): ScenarioPlannerMetric {
  if (
    input.currentPrice !== null &&
    input.supportPrice !== null &&
    input.supportPrice < input.currentPrice
  ) {
    return {
      value: input.supportPrice,
      reason:
        'Uses the manual support/reference price because it is below planned entry.',
    }
  }

  if (
    input.currentPrice !== null &&
    input.maxLossDollars !== null &&
    input.shares !== null
  ) {
    const stopLevel = input.currentPrice - input.maxLossDollars / input.shares

    if (stopLevel > 0 && stopLevel < input.currentPrice) {
      return {
        value: stopLevel,
        reason: `${formatMoney(
          input.maxLossDollars,
        )} risk budget divided by ${formatNumber(
          input.shares,
        )} shares, subtracted from entry.`,
      }
    }
  }

  return {
    value: null,
    reason:
      'Needs a support/reference price below entry or a valid max-loss budget.',
  }
}

function getStretchTarget(input: {
  currentPrice: number
  desiredRiskReward: number
  firstTarget: number | null
  riskPerShare: number
  targetGainPercent: number
}): number {
  const gainPercentTarget =
    input.currentPrice * (1 + input.targetGainPercent / 100)

  if (input.firstTarget !== null && gainPercentTarget > input.firstTarget) {
    return gainPercentTarget
  }

  return input.currentPrice + input.riskPerShare * (input.desiredRiskReward + 1)
}

function getStretchTargetReason(input: {
  currentPrice: number
  desiredRiskReward: number | null
  firstTarget: number
  riskPerShare: number | null
  targetGainPercent: number | null
}): string {
  if (input.targetGainPercent === null || input.riskPerShare === null) {
    return 'Needs target gain percent and risk per share.'
  }

  const gainPercentTarget =
    input.currentPrice * (1 + input.targetGainPercent / 100)

  if (gainPercentTarget > input.firstTarget) {
    return `${formatPercent(
      input.targetGainPercent,
    )} gain target from planned entry.`
  }

  return `${formatNumber(
    (input.desiredRiskReward ?? 0) + 1,
  )}R stretch because the gain-percent target is below the first target.`
}

function getScenarioStatus(
  issues: readonly ScenarioPlannerIssue[],
): TargetStopScenario['status'] {
  if (issues.some((issue) => issue.severity === 'invalid')) {
    return 'invalid'
  }

  if (issues.some((issue) => issue.severity === 'missing')) {
    return 'missing_input'
  }

  return 'ready'
}

function normalizeStopLimitBuffer(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return DEFAULT_STOP_LIMIT_BUFFER_PERCENT
  }

  return clamp(value, 0, MAX_STOP_LIMIT_BUFFER_PERCENT)
}

function positiveNumberOrNull(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}

function formatMoney(value: number): string {
  return `$${formatNumber(value)}`
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(value)
}
