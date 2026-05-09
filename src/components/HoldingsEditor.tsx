import { AI_STACK_LAYERS } from '../data/seedWatchlist'
import {
  Field,
  FieldRow,
  Ledger,
  Panel,
  PanelHead,
} from './primitives'
import type { CommandCenterState } from '../state/useCommandCenterState'
import { formatCurrency } from '../state/useCommandCenterState'

export function HoldingsEditor(props: { state: CommandCenterState }) {
  return (
    <Panel>
      <PanelHead
        kicker="holdings"
        title="Manual lots"
        pill={`${props.state.portfolioModel.completePositionCount}/${props.state.holdings.length} modeled`}
      />
      <form className="holding-form" onSubmit={props.state.actions.addHolding}>
        <FieldRow>
          <Field
            label="Holding symbol"
            value={props.state.holdingForm.symbol}
            onChange={(value) => props.state.actions.updateHoldingForm('symbol', value)}
          />
          <Field
            label="Name"
            value={props.state.holdingForm.name}
            onChange={(value) => props.state.actions.updateHoldingForm('name', value)}
          />
        </FieldRow>
        <FieldRow>
          <Field
            label="Holding shares"
            type="number"
            value={props.state.holdingForm.shares}
            onChange={(value) => props.state.actions.updateHoldingForm('shares', value)}
          />
          <Field
            label="Holding avg cost"
            type="number"
            value={props.state.holdingForm.averageCost}
            onChange={(value) =>
              props.state.actions.updateHoldingForm('averageCost', value)
            }
          />
        </FieldRow>
        <Field label="Layer">
          <select
            value={props.state.holdingForm.stackLayer}
            onChange={(event) =>
              props.state.actions.updateHoldingForm('stackLayer', event.target.value)
            }
          >
            {AI_STACK_LAYERS.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="actions">
          <button className="btn primary" type="submit">
            Add holding
          </button>
        </div>
      </form>

      <div className="dash-rule" />
      <Ledger
        columns="90px 1fr 110px 110px 110px 90px"
        headers={[
          'symbol',
          'name',
          <div className="num" key="shares">shares</div>,
          <div className="num" key="avg">avg cost</div>,
          <div className="num" key="value">value</div>,
          <div className="num" key="actions">actions</div>,
        ]}
        rows={props.state.holdings.map((holding) => {
          const lot = props.state.manualLots[holding.symbol] ?? {
            shares: '',
            averageCost: '',
          }
          const position = props.state.portfolioModel.positions.find(
            (item) => item.symbol === holding.symbol,
          )

          return {
            id: holding.symbol,
            cells: [
              <button
                className="tag"
                key="symbol"
                type="button"
                onClick={() => props.state.actions.selectPlannerSymbol(holding.symbol)}
              >
                {holding.symbol}
              </button>,
              <div key="name">
                <b>{holding.name}</b>
                <div className="muted small">{holding.stackLayer}</div>
              </div>,
              <input
                aria-label={`${holding.symbol} shares`}
                className="ledger-input num"
                key="shares"
                type="number"
                value={lot.shares}
                onChange={(event) =>
                  props.state.actions.updateManualLot(
                    holding.symbol,
                    'shares',
                    event.target.value,
                  )
                }
              />,
              <input
                aria-label={`${holding.symbol} average cost`}
                className="ledger-input num"
                key="avg"
                type="number"
                value={lot.averageCost}
                onChange={(event) =>
                  props.state.actions.updateManualLot(
                    holding.symbol,
                    'averageCost',
                    event.target.value,
                  )
                }
              />,
              <div className="num" key="value">
                {formatCurrency(position?.marketValue ?? null)}
              </div>,
              <button
                className="btn ghost"
                key="remove"
                type="button"
                onClick={() => props.state.actions.removeHolding(holding.symbol)}
              >
                Remove
              </button>,
            ],
          }
        })}
      />
    </Panel>
  )
}
