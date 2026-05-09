import type { CommandCenterState } from './useCommandCenterState'

export function useHoldings(state: CommandCenterState) {
  return {
    holdings: state.holdings,
    manualLots: state.manualLots,
    positions: state.portfolioModel.positions,
    actions: {
      addHolding: state.actions.addHolding,
      removeHolding: state.actions.removeHolding,
      updateManualLot: state.actions.updateManualLot,
    },
  }
}
