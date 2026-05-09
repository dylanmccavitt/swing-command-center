import type { AllocationRow } from '../../lib/cockpit'
import { formatCurrency, formatPercent } from '../../state/useCommandCenterState'

export function AllocBar(props: { rows: readonly AllocationRow[] }) {
  if (props.rows.length === 0) {
    return (
      <div className="empty-state">
        <strong>No allocation yet</strong>
        <span>Enter shares and average cost to model position weights.</span>
      </div>
    )
  }

  return (
    <>
      <div className="alloc-bar" aria-hidden="true">
        {props.rows.map((row) => (
          <span
            key={row.symbol}
            style={{ width: `${row.weightPercent}%`, background: row.color }}
          />
        ))}
      </div>
      <div className="alloc-legend">
        {props.rows.map((row) => (
          <div className="item" key={row.symbol}>
            <span className="swatch" style={{ background: row.color }} />
            <span>
              <b>{row.symbol}</b> <span className="muted">{row.name}</span>
            </span>
            <span className="pct">{formatPercent(row.weightPercent)}</span>
            <span className="val">{formatCurrency(row.marketValue)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
