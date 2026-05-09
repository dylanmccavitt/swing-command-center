import type { ReactNode } from 'react'

export type RowListItem = {
  id: string
  index?: string
  title: ReactNode
  desc?: ReactNode
  value?: ReactNode
  delta?: ReactNode
  tone?: 'pos' | 'neg' | 'neutral'
  right?: ReactNode
  onClick?: () => void
}

export function RowList(props: { items: readonly RowListItem[] }) {
  if (props.items.length === 0) {
    return (
      <div className="empty-state">
        <strong>No rows</strong>
        <span>Nothing is ready for this panel yet.</span>
      </div>
    )
  }

  return (
    <div className="row-list">
      {props.items.map((item) => {
        const content = (
          <>
            <div className="idx">{item.index ?? ''}</div>
            <div>
              <div className="ticker">{item.title}</div>
              {item.desc ? <div className="desc">{item.desc}</div> : null}
            </div>
            {item.right ?? (
              <div>
                <div className="price">{item.value}</div>
                {item.delta ? (
                  <div className={`delta ${item.tone ?? ''}`}>{item.delta}</div>
                ) : null}
              </div>
            )}
          </>
        )

        return item.onClick ? (
          <button
            className="row clickable"
            key={item.id}
            type="button"
            onClick={item.onClick}
          >
            {content}
          </button>
        ) : (
          <div className="row" key={item.id}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
