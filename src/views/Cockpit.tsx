import {
  AllocBar,
  Card,
  Hint,
  KV,
  Panel,
  PanelHead,
  RowList,
  SectionDivider,
  Sparkbar,
  Stat,
} from '../components/primitives'
import type { CommandCenterState } from '../state/useCommandCenterState'
import {
  formatCurrency,
  formatShares,
  formatSignedCurrency,
  formatSignedPercent,
} from '../state/useCommandCenterState'

export function Cockpit(props: { state: CommandCenterState }) {
  const { state } = props
  const modeledMeta = `${state.portfolioModel.completePositionCount}/${state.summary.totalSymbols} modeled · ${state.portfolioModel.manualLotsNeeded} need lots`
  const scenarioMeta = `${state.topProfitLockScenarios.length} ready · ${state.movementRows.length} symbols`
  const concentrationSub = `${state.concentrationSummary.atRiskCount} positions >= ${state.portfolioModel.settings.maxPositionWeightPercent}% hard cap`
  const concentrationTone =
    state.concentrationSummary.state === 'over_cap'
      ? 'warn'
      : state.concentrationSummary.state === 'within_rules'
        ? 'pos'
        : 'neutral'
  const movementOrder = new Map(
    ['AAPL', 'GOOG', 'NVDA', 'IREN', 'AMD', 'TSM', 'ASML', 'SNPS', 'ANET', 'VRT', 'CEG', 'MU'].map(
      (symbol, index) => [symbol, index],
    ),
  )
  const orderedMovementRows = [...state.movementRows].sort(
    (left, right) =>
      (movementOrder.get(left.symbol) ?? Number.MAX_SAFE_INTEGER) -
      (movementOrder.get(right.symbol) ?? Number.MAX_SAFE_INTEGER),
  )
  const describeScenario = (scenario: (typeof state.topProfitLockScenarios)[number]) => {
    if (scenario.title.includes('Trim to')) return 'reduce to concentration cap'
    if (scenario.title.includes('Recover cost basis')) return 'raise cash to original basis'
    return scenario.description
  }

  return (
    <section className="view" data-view="cockpit">
      <div className="page-head">
        <div>
          <div className="kicker">— manual swing cockpit</div>
          <h1 className="page-title">Swing Command Center</h1>
          <div className="breadcrumbs">
            workspace<span className="sep">/</span>cockpit
            <span className="sep">/</span>overview
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={state.actions.exportTradeJournal}>
            Export
          </button>
          <button className="btn" type="button" onClick={() => window.location.reload()}>
            Refresh quotes
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              const ticket = state.manualTradeTickets[0]
              if (ticket) state.actions.addJournalEntryFromTicket(ticket, 'planned')
            }}
          >
            + New ticket
          </button>
        </div>
      </div>

      <SectionDivider label="portfolio" meta={modeledMeta} />
      <div className="stats">
        <Stat
          label="portfolio value"
          sub={`${state.portfolioModel.completePositionCount}/${state.summary.totalSymbols} holdings modeled`}
          value={formatCurrency(state.portfolioModel.totalMarketValue)}
        />
        <Stat
          label="unrealized gain"
          sub={`${formatCurrency(state.portfolioModel.totalCostBasis)} cost basis`}
          tone={state.portfolioModel.totalUnrealizedGain >= 0 ? 'pos' : 'neg'}
          value={formatSignedCurrency(state.portfolioModel.totalUnrealizedGain)}
        />
        <Stat
          label="cash · runway"
          sub="covers current runway target"
          value={formatCurrency(state.cashRunwaySummary.targetAmount)}
        />
        <Stat
          label="concentration"
          sub={concentrationSub}
          tone={concentrationTone}
          value={state.concentrationSummary.state === 'over_cap' ? 'Over cap' : state.concentrationSummary.label}
        />
      </div>

      <SectionDivider label="scenarios · allocation · watchlist" meta={scenarioMeta} />
      <div className="split-3">
        <Panel>
          <PanelHead
            kicker="profit-lock"
            title="Top manual scenarios"
            pill={`${state.topProfitLockScenarios.length} ready`}
          />
          <RowList
            items={state.topProfitLockScenarios.map((scenario, index) => ({
              id: `${scenario.symbol}-${scenario.id}`,
              index: String(index + 1).padStart(2, '0'),
              title: `${scenario.symbol} · ${scenario.title}`,
              desc: `${scenario.positionName} — ${describeScenario(scenario)}`,
              value: formatCurrency(scenario.estimatedNetCash),
              delta: '+lock',
              tone: 'pos',
              onClick: () => state.actions.selectPlannerSymbol(scenario.symbol),
            }))}
          />
        </Panel>

        <Panel>
          <PanelHead
            kicker="allocation"
            title="Modeled weight"
            pill={formatCurrency(state.portfolioModel.totalMarketValue)}
          />
          <AllocBar rows={state.allocationRows} />
          <div className="dash-rule" />
          <Hint variant={state.concentrationSummary.state === 'over_cap' ? 'warn' : undefined}>
            {state.concentrationSummary.detail}
          </Hint>
        </Panel>

        <Panel>
          <PanelHead
            kicker="watchlist"
            title="Session movement"
            pill={`${state.movementRows.length} symbols`}
          />
          <RowList
            items={orderedMovementRows.slice(0, 12).map((row) => ({
              id: row.symbol,
              title: row.symbol,
              desc: row.layer,
              right: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Sparkbar delta={row.changePercent} />
                  <div>
                    <div className="price">{formatCurrency(row.price)}</div>
                    <div
                      className={`delta ${
                        (row.changePercent ?? 0) >= 0 ? 'pos' : 'neg'
                      }`}
                    >
                      {formatSignedPercent(row.changePercent)}
                    </div>
                  </div>
                </div>
              ),
              onClick: () => {
                state.actions.setSelectedResearchSymbol(row.symbol)
              },
            }))}
          />
        </Panel>
      </div>

      <SectionDivider
        label="manual tickets"
        meta={`${state.manualTradeTickets.length} checklist-ready`}
      />
      <div className="cards">
        {state.manualTradeTickets.length === 0 ? (
          <div className="empty-state">
            <strong>No manual tickets</strong>
            <span>Complete a holding lot or research setup to draft tickets.</span>
          </div>
        ) : (
          state.manualTradeTickets.slice(0, 6).map((ticket) => (
            <Card key={ticket.id}>
              <div className="card-head">
                <span className="card-status ready">checklist ready</span>
                <span className="muted small">
                  {formatShares(ticket.estimatedShares)} sh
                </span>
              </div>
              <h3>
                {ticket.symbol} · {ticket.action}
              </h3>
              <KV label="action" value={ticket.action} />
              <KV label="raised" value={formatCurrency(ticket.estimatedCashRaised)} />
              <KV
                label="realized"
                tone={ticket.estimatedRealizedGain >= 0 ? 'pos' : 'neg'}
                value={formatSignedCurrency(ticket.estimatedRealizedGain)}
              />
              <KV label="reserve" value={formatCurrency(ticket.taxReserveEstimate)} />
              <div className="reason">{ticket.reason}</div>
              <div className="actions">
                {(['planned', 'executed', 'mistake', 'result'] as const).map((status) => (
                  <button
                    className="btn"
                    key={status}
                    type="button"
                    onClick={() => state.actions.addJournalEntryFromTicket(ticket, status)}
                  >
                    {status === 'planned'
                      ? 'Plan'
                      : status === 'executed'
                        ? 'Executed'
                        : status === 'mistake'
                          ? 'Mistake'
                          : 'Result'}
                  </button>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
