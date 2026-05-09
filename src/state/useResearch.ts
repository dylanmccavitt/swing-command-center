import type { CommandCenterState } from './useCommandCenterState'

export function useResearch(state: CommandCenterState) {
  return {
    filters: state.researchFilters,
    groups: state.researchLayerGroups,
    selectedCard: state.selectedResearchCard,
    selectedScore: state.selectedResearchScore,
    queue: state.selectedCodexQueueRecord,
    run: state.selectedResearchRun,
  }
}
