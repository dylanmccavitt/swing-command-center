export type TabItem<T extends string> = {
  key: T
  label: string
  count?: number | string
}

export function Tabs<T extends string>(props: {
  tabs: readonly TabItem<T>[]
  active: T
  onChange: (key: T) => void
  ariaLabel: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={props.ariaLabel}>
      {props.tabs.map((tab) => (
        <button
          aria-selected={props.active === tab.key}
          className={`tab ${props.active === tab.key ? 'active' : ''}`}
          key={tab.key}
          role="tab"
          type="button"
          onClick={() => props.onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
