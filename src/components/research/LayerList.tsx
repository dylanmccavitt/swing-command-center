import type { CommandCenterState } from '../../state/useCommandCenterState'

export function LayerList(props: {
  state: CommandCenterState
  onSelect: (symbol: string) => void
}) {
  return (
    <>
      {props.state.researchLayerGroups.map((group) => (
        <div className="layer" key={group.id}>
          <div className="layer-head">
            <span>{group.label}</span>
            <span className="ct">{group.items.length}</span>
          </div>
          <div className="layer-tags">
            {group.items.map((item) => {
              const score = props.state.researchScoreBySymbol.get(item.symbol)
              const active = props.state.selectedResearchSymbol === item.symbol

              return (
                <button
                  className={`tag ${active ? 'active' : ''}`}
                  key={item.symbol}
                  type="button"
                  onClick={() => props.onSelect(item.symbol)}
                >
                  {item.symbol}
                  <span className="score">{score?.scorePercent ?? 0}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
