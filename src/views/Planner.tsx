import { useMemo, useState } from 'react'
import { SCENARIO_PLANNER_DISCLOSURE } from '../lib/scenarioPlanner'
import { HoldingsEditor } from '../components/HoldingsEditor'
import {
  Field,
  FieldRow,
  Hint,
  KV,
  Panel,
  PanelHead,
} from '../components/primitives'
import type { CommandCenterState } from '../state/useCommandCenterState'
import {
  formatCurrency,
  formatPercent,
  formatShares,
  formatSignedCurrency,
  getScenarioPlannerStatusLabel,
} from '../state/useCommandCenterState'

const ACTIONS = [
  'Trim to weight',
  'Recover cost basis',
  'Lock % of gain',
  'Raise specific cash',
]

export function Planner(props: { state: CommandCenterState }) {
  const [action, setAction] = useState(ACTIONS[0])
  const [reason, setReason] = useState('')
  const card = props.state.selectedPlannerCard
  const scenario = props.state.targetStopScenario
  const ticket = props.state.manualTradeTickets[0]
  const profitLockTicket = props.state.profitLockTickets[0]
  const invalidation = useMemo(
    () => card?.tradeSetup.invalidation || card?.research.invalidation || '',
    [card],
  )

  return (
    <section className="view" data-view="planner">
      <div className="page-head">
        <div>
          <div className="kicker">— plan builder</div>
          <h1 className="page-title">Planner</h1>
          <div className="breadcrumbs">
            workspace<span className="sep">/</span>planner
          </div>
        </div>
        <div className="actions">
          <button
            className="btn"
            type="button"
            onClick={() => props.state.actions.setCashTargetInput('1000')}
          >
            Reset draft
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              if (ticket) props.state.actions.addJournalEntryFromTicket(ticket, 'planned')
            }}
          >
            Save plan
          </button>
        </div>
      </div>

      <div className="split-2">
        <Panel>
          <PanelHead kicker="inputs" title="Manual entry" />
          <FieldRow>
            <Field label="Symbol">
              <select
                value={props.state.selectedPlannerSymbol}
                onChange={(event) =>
                  props.state.actions.selectPlannerSymbol(event.target.value)
                }
              >
                {props.state.researchCards.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol} · {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Action">
              <select value={action} onChange={(event) => setAction(event.target.value)}>
                {ACTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field
              label="Shares"
              type="number"
              value={props.state.scenarioPlannerFields.shares}
              onChange={(value) =>
                props.state.actions.updateScenarioPlannerField('shares', value)
              }
            />
            <Field
              label="Avg cost"
              type="number"
              value={props.state.scenarioPlannerFields.averageCost}
              onChange={(value) =>
                props.state.actions.updateScenarioPlannerField('averageCost', value)
              }
            />
          </FieldRow>
          <FieldRow>
            <Field
              label="Target weight"
              type="number"
              value={String(props.state.portfolioModel.settings.maxPositionWeightPercent)}
              onChange={(value) =>
                props.state.actions.updateSetting('maxPositionWeightPercent', value)
              }
            />
            <Field
              label="Reserve %"
              type="number"
              value={String(props.state.portfolioModel.settings.taxReserveRatePercent)}
              onChange={(value) =>
                props.state.actions.updateSetting('taxReserveRatePercent', value)
              }
            />
          </FieldRow>
          <Field
            label="Reason"
            textarea
            value={reason || ticket?.reason || ''}
            onChange={setReason}
          />
          <Field
            label="Invalidation"
            textarea
            value={invalidation}
            onChange={(value) => {
              if (card) {
                props.state.actions.updateTradeSetupField(
                  card.symbol,
                  'invalidation',
                  value,
                )
              }
            }}
          />
        </Panel>

        <Panel>
          <PanelHead
            kicker="preview"
            title="Plan output"
            pill={getScenarioPlannerStatusLabel(scenario.status)}
          />
          <KV label="action" value={action} />
          <KV label="shares to sell" value={formatShares(scenario.trimShares.value)} />
          <KV label="est. raise" value={formatCurrency(scenario.estimatedProceeds.value)} />
          <KV
            label="est. cost basis"
            value={formatCurrency(
              ticket
                ? ticket.estimatedCashRaised - ticket.estimatedRealizedGain
                : null,
            )}
          />
          <KV
            label="est. realized"
            tone={(scenario.estimatedGainLoss.value ?? 0) >= 0 ? 'pos' : 'neg'}
            value={formatSignedCurrency(scenario.estimatedGainLoss.value)}
          />
          <KV label="reserve set-aside" value={formatCurrency(ticket?.taxReserveEstimate)} />
          <KV
            label="remaining weight"
            value={formatPercent(profitLockTicket?.remainingWeightPercent)}
          />
          <div className="dash-rule" />
          <Hint>{SCENARIO_PLANNER_DISCLOSURE}</Hint>
          {scenario.issues.length > 0 ? (
            <ul className="small muted" style={{ paddingLeft: 18 }}>
              {scenario.issues.map((issue) => (
                <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          ) : (
            <ul className="small muted" style={{ paddingLeft: 18 }}>
              <li>Verify current quote, shares, and avg cost manually before acting.</li>
              <li>Review reserve estimate and cash target before entering anything in Robinhood.</li>
              <li>Record the actual fill, realized P/L, and tax-prep notes after execution.</li>
            </ul>
          )}
          <div className="actions" style={{ marginTop: 12 }}>
            <button
              className="btn"
              type="button"
              onClick={() => {
                if (ticket) props.state.actions.addJournalEntryFromTicket(ticket, 'planned')
              }}
            >
              Save as draft
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                if (ticket) props.state.actions.addJournalEntryFromTicket(ticket, 'planned')
              }}
            >
              Convert to ticket
            </button>
          </div>
        </Panel>
      </div>

      <div className="standalone-panel">
        <HoldingsEditor state={props.state} />
      </div>
    </section>
  )
}
