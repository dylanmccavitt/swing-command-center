import type { CommandCenterState } from './useCommandCenterState'

export function useWatchlist(state: CommandCenterState) {
  return {
    movementRows: state.movementRows,
    researchCards: state.researchCards,
    researchScores: state.researchScores,
  }
}
