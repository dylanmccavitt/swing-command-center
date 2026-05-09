import { formatSignedCurrency } from '../state/useCommandCenterState'
import type { CommandCenterState } from '../state/useCommandCenterState'

export function StatusBar(props: { state: CommandCenterState }) {
  return (
    <div className="statusbar">
      <span className="item">
        <b>cmd</b> +K · search
      </span>
      <span className="item">
        <b>⌘1-6</b> switch view
      </span>
      <span className="item">
        <b>g j</b> jump to journal
      </span>
      <span className="item">
        <b>g r</b> jump to research
      </span>
      <span className="item">
        <b>n</b> new ticket
      </span>
      <span className="right item">
        {props.state.journalEntries.length} entries · 2026 ytd realized{' '}
        <b style={{ color: 'var(--green)' }}>
          {formatSignedCurrency(
            props.state.realizedProfitSummary.netRealizedTradingProfit,
          )}
        </b>
      </span>
    </div>
  )
}
