import type { CommandCenterState } from './useCommandCenterState'

export function useScenarios(state: CommandCenterState) {
  return {
    manualTradeTickets: state.manualTradeTickets,
    profitLockTickets: state.profitLockTickets,
    targetStopScenario: state.targetStopScenario,
    topProfitLockScenarios: state.topProfitLockScenarios,
  }
}
