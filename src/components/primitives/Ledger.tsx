import type { CSSProperties, ReactNode } from 'react'

export type LedgerRow = {
  id: string
  cells: ReactNode[]
}

export function Ledger(props: {
  headers: readonly ReactNode[]
  rows: readonly LedgerRow[]
  columns?: string
}) {
  const style = props.columns
    ? ({ '--ledger-columns': props.columns } as CSSProperties)
    : undefined

  if (props.rows.length === 0) {
    return (
      <div className="ledger" style={style}>
        <div className="ledger-row head">
          {props.headers.map((header, index) => (
            <div key={index}>{header}</div>
          ))}
        </div>
        <div className="empty-state">
          <strong>No ledger rows</strong>
          <span>Rows appear here after a ticket, fill, or import is added.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="ledger" style={style}>
      <div className="ledger-row head">
        {props.headers.map((header, index) => (
          <div key={index}>{header}</div>
        ))}
      </div>
      {props.rows.map((row) => (
        <div className="ledger-row" key={row.id}>
          {row.cells.map((cell, index) => (
            <div key={index}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  )
}
