import { PROFIT_CASH_PLAN_DISCLOSURE } from '../lib/profitCashPlan'
import {
  Checkbox,
  Field,
  FieldRow,
  Hint,
  Panel,
  PanelHead,
  SectionDivider,
} from '../components/primitives'
import type { CommandCenterState } from '../state/useCommandCenterState'
import { formatCurrency, formatSignedCurrency } from '../state/useCommandCenterState'

export function CashPlan(props: { state: CommandCenterState }) {
  const plan = props.state.profitCashPlan
  const reservePercent = props.state.portfolioModel.settings.taxReserveRatePercent
  const payPercent = props.state.payYourselfRule.percentOfNetAfterReserve
  const redeployPercent = Math.max(0, 100 - reservePercent - payPercent)

  return (
    <section className="view" data-view="cash">
      <div className="page-head">
        <div>
          <div className="kicker">— profit cash plan</div>
          <h1 className="page-title">Cash plan</h1>
          <div className="breadcrumbs">
            workspace<span className="sep">/</span>cash plan
          </div>
        </div>
        <div className="actions">
          <button className="btn" type="button">
            Adjust splits
          </button>
          <button className="btn primary" type="button">
            Save plan
          </button>
        </div>
      </div>

      <div className="cash-plan">
        <CashCell
          label="realized"
          sub={`${props.state.realizedProfitSummary.realizedEntryCount} executed entries`}
          value={formatSignedCurrency(plan.profitAfterReserve + plan.reserveSetAside)}
          positive
        />
        <CashCell
          label="reserve"
          percent={reservePercent}
          sub={`${reservePercent}% set-aside`}
          value={formatCurrency(plan.reserveSetAside)}
        />
        <CashCell
          label="pay myself"
          percent={payPercent}
          sub={`${payPercent}% draw`}
          value={formatCurrency(plan.payYourselfAmount)}
        />
        <CashCell
          label="redeploy"
          percent={redeployPercent}
          sub="to next manual ticket"
          value={formatCurrency(plan.cashToPlan)}
        />
      </div>

      <SectionDivider label="allocation rules" meta="edit splits below" />
      <div className="split-2">
        <Panel>
          <PanelHead kicker="splits" title="Distribution" />
          <FieldRow>
            <Field
              label="Reserve %"
              type="number"
              value={String(reservePercent)}
              onChange={(value) =>
                props.state.actions.updateSetting('taxReserveRatePercent', value)
              }
            />
            <Field
              label="Pay myself %"
              type="number"
              value={props.state.payYourselfForm.percentOfNetAfterReserve}
              onChange={(value) =>
                props.state.actions.updatePayYourselfRule(
                  'percentOfNetAfterReserve',
                  value,
                )
              }
            />
          </FieldRow>
          <FieldRow>
            <Field label="Redeploy %" value={String(redeployPercent)} />
            <Field
              label="Floor reserve"
              value={props.state.buyingPowerForm.startingCash}
              onChange={(value) =>
                props.state.actions.updateBuyingPowerForm('startingCash', value)
              }
            />
          </FieldRow>
          <Checkbox
            checked={props.state.concentrationSummary.state === 'over_cap'}
            label="Skip redeploy when concentration over cap"
            onChange={() => undefined}
          />
          <Checkbox
            checked={props.state.payYourselfForm.enabled}
            label="Roll pay-yourself into separate cash bucket"
            onChange={(checked) =>
              props.state.actions.updatePayYourselfRule('enabled', checked)
            }
          />
        </Panel>
        <Panel>
          <PanelHead kicker="notes" title="Rationale" />
          <Hint>{PROFIT_CASH_PLAN_DISCLOSURE}</Hint>
          <ul className="small muted" style={{ paddingLeft: 18 }}>
            <li>Reserve grows the runway target before redeploy.</li>
            <li>Pay myself rolls to a separate cash bucket monthly.</li>
            <li>Redeploy returns to the next manual ticket.</li>
          </ul>
        </Panel>
      </div>
    </section>
  )
}

function CashCell(props: {
  label: string
  value: string
  sub: string
  percent?: number
  positive?: boolean
}) {
  return (
    <div className="cash-cell">
      <div className="label">{props.label}</div>
      <div className={`val ${props.positive ? 'pos' : ''}`}>{props.value}</div>
      {props.percent !== undefined ? (
        <div className="alloc-bar" style={{ marginTop: 8 }}>
          <span style={{ width: `${Math.min(props.percent, 100)}%`, background: 'var(--accent)' }} />
          <span style={{ flex: 1, background: 'var(--bg-3)' }} />
        </div>
      ) : null}
      <div className="muted small" style={{ marginTop: 6 }}>
        {props.sub}
      </div>
    </div>
  )
}
