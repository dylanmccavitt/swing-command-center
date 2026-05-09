import { useMemo, useState } from 'react'
import type { CommandCenterState } from '../state/useCommandCenterState'
import type { ViewKey } from '../hooks/useViewSwitcher'
import { VIEW_LABELS, VIEW_ORDER } from '../hooks/useViewSwitcher'

type Command = {
  id: string
  group: string
  label: string
  detail: string
  run: () => void
}

export function CommandPalette(props: {
  open: boolean
  state: CommandCenterState
  onClose: () => void
  onView: (view: ViewKey) => void
}) {
  const [query, setQuery] = useState('')
  const commands = useMemo<Command[]>(() => {
    const viewCommands = VIEW_ORDER.map((view, index) => ({
      id: `view-${view}`,
      group: 'view',
      label: VIEW_LABELS[view],
      detail: `Open with ⌘${index + 1}`,
      run: () => props.onView(view),
    }))
    const holdingCommands = props.state.holdings.map((holding) => ({
      id: `holding-${holding.symbol}`,
      group: 'holding',
      label: holding.symbol,
      detail: holding.name,
      run: () => {
        props.state.actions.selectPlannerSymbol(holding.symbol)
        props.onView('planner')
      },
    }))

    return [...viewCommands, ...holdingCommands]
  }, [props])
  const filtered = commands.filter((command) => {
    const haystack = `${command.group} ${command.label} ${command.detail}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  if (!props.open) {
    return null
  }

  return (
    <div
      aria-label="Command palette"
      aria-modal="true"
      className="command-overlay"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          props.onClose()
        }
      }}
    >
      <div className="command-palette">
        <input
          autoFocus
          placeholder="Search views and holdings"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              props.onClose()
            }
            if (event.key === 'Enter' && filtered[0]) {
              filtered[0].run()
              props.onClose()
            }
          }}
        />
        <div className="command-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <strong>No command found</strong>
              <span>Try a view name, ticker, or holding name.</span>
            </div>
          ) : (
            filtered.map((command, index) => (
              <button
                className={`command-item ${index === 0 ? 'active' : ''}`}
                key={command.id}
                type="button"
                onClick={() => {
                  command.run()
                  props.onClose()
                }}
              >
                <span className="muted small">{command.group}</span>
                <span>{command.label}</span>
                <span className="muted small">{command.detail}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
