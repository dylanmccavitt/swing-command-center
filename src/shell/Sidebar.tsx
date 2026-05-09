import type { CommandCenterState } from '../state/useCommandCenterState'
import { VIEW_LABELS, type ViewKey } from '../hooks/useViewSwitcher'

export function Sidebar(props: {
  state: CommandCenterState
  view: ViewKey
  onView: (view: ViewKey) => void
}) {
  const holdings = props.state.portfolioModel.positions.slice(0, 8)
  const watchlist = props.state.researchScores
    .filter((score) => !props.state.holdings.some((holding) => holding.symbol === score.symbol))
    .slice(0, 8)

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">workspace</div>
        <ul className="nav">
          {(Object.keys(VIEW_LABELS) as ViewKey[]).map((view, index) => (
            <li key={view}>
              <button
                className={`nav-item ${props.view === view ? 'active' : ''}`}
                type="button"
                onClick={() => props.onView(view)}
              >
                <span>
                  <span className="glyph">▸</span> {VIEW_LABELS[view]}
                </span>
                <span className="count">⌘{index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">holdings</div>
        <ul className="nav">
          {holdings.length === 0 ? (
            <li className="nav-item">
              <span>
                <span className="glyph">·</span> none
              </span>
              <span className="count">0</span>
            </li>
          ) : (
            holdings.map((holding) => (
              <li key={holding.symbol}>
                <button
                  className="nav-item"
                  type="button"
                  onClick={() => {
                    props.state.actions.selectPlannerSymbol(holding.symbol)
                    props.onView('planner')
                  }}
                >
                  <span>
                    <span className="glyph">·</span> {holding.symbol}
                  </span>
                  <span className="count">
                    {holding.unrealizedGainPercent === null
                      ? '·'
                      : `${holding.unrealizedGainPercent >= 0 ? '+' : ''}${holding.unrealizedGainPercent.toFixed(1)}%`}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">watchlist</div>
        <ul className="nav">
          {watchlist.map((score) => (
            <li key={score.symbol}>
              <button
                className="nav-item"
                type="button"
                onClick={() => {
                  props.state.actions.setSelectedResearchSymbol(score.symbol)
                  props.onView('research')
                }}
              >
                <span>
                  <span className="glyph">·</span> {score.symbol}
                </span>
                <span className="count">{score.scorePercent}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-footer">
        <div className="row">
          <span>feed</span>
          <b>{props.state.marketStatus.toLowerCase()}</b>
        </div>
        <div className="row">
          <span>last sync</span>
          <b>{props.state.marketTimestamp}</b>
        </div>
        <div className="row">
          <span>local-only</span>
          <b>yes</b>
        </div>
      </div>
    </aside>
  )
}
