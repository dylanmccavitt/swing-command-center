import type { CommandCenterState } from './useCommandCenterState'

export function useSellFills(state: CommandCenterState) {
  return {
    buyingPowerSummary: state.buyingPowerSummary,
    rows: state.sellFillRows,
    sellFills: state.sellFills,
  }
}
