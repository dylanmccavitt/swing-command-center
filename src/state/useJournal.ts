import type { CommandCenterState } from './useCommandCenterState'

export function useJournal(state: CommandCenterState) {
  return {
    entries: state.journalEntries,
    realizedProfitSummary: state.realizedProfitSummary,
    actions: {
      addJournalEntryFromTicket: state.actions.addJournalEntryFromTicket,
      exportTradeJournal: state.actions.exportTradeJournal,
      updateJournalEntry: state.actions.updateJournalEntry,
    },
  }
}
