import { useEffect, useMemo, useRef, useState } from 'react'
import { CommandPalette } from './components/CommandPalette'
import { useHotkeys } from './hooks/useHotkeys'
import { useTheme } from './hooks/useTheme'
import { useViewSwitcher } from './hooks/useViewSwitcher'
import { Sidebar } from './shell/Sidebar'
import { StatusBar } from './shell/StatusBar'
import { Titlebar } from './shell/Titlebar'
import { useCommandCenterState } from './state/useCommandCenterState'
import { CashPlan } from './views/CashPlan'
import { Cockpit } from './views/Cockpit'
import { Import } from './views/Import'
import { Journal } from './views/Journal'
import { Planner } from './views/Planner'
import { Research } from './views/Research'

function App() {
  const state = useCommandCenterState()
  const { theme, toggleTheme } = useTheme()
  const { view, switchView } = useViewSwitcher()
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const hotkeys = useMemo(
    () => ({
      onCommandPalette: () => setIsCommandOpen(true),
      onNewTicket: () => {
        const ticket = state.manualTradeTickets[0]
        if (ticket) {
          state.actions.addJournalEntryFromTicket(ticket, 'planned')
          switchView('journal')
        }
      },
      onView: switchView,
    }),
    [state.manualTradeTickets, state.actions, switchView],
  )

  useHotkeys(hotkeys)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [view])

  return (
    <div className="app">
      <Titlebar
        breadcrumb="swing-command-center — manual swing cockpit"
        marketStatus={state.marketStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <Sidebar state={state} view={view} onView={switchView} />
      <main className="main">
        <div className="content" ref={contentRef}>
          {state.isMarketLoading || state.errorMessage ? (
            <div className="view-state">
              <b>{state.errorMessage ? 'error' : 'loading'}</b>
              <span>
                {state.errorMessage ?? 'Loading local market data snapshot.'}
              </span>
            </div>
          ) : null}
          {view === 'cockpit' ? (
            <Cockpit state={state} onView={switchView} />
          ) : null}
          {view === 'research' ? <Research state={state} /> : null}
          {view === 'planner' ? <Planner state={state} /> : null}
          {view === 'journal' ? <Journal state={state} /> : null}
          {view === 'cash' ? <CashPlan state={state} /> : null}
          {view === 'import' ? <Import state={state} /> : null}
        </div>
        <StatusBar state={state} />
      </main>
      <CommandPalette
        open={isCommandOpen}
        state={state}
        onClose={() => setIsCommandOpen(false)}
        onView={switchView}
      />
    </div>
  )
}

export default App
