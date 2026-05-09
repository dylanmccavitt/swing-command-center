import type { CommandCenterState } from './useCommandCenterState'

export function useRobinhoodImport(state: CommandCenterState) {
  return {
    imports: state.robinhoodImports,
    message: state.robinhoodImportMessage,
    rows: state.robinhoodRows,
    taxPlanning: state.robinhoodTaxPlanning,
    updateReviewState: state.actions.updateRobinhoodReviewState,
  }
}
