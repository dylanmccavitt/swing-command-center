import { AI_STACK_LAYERS } from '../../data/seedWatchlist'
import type { CommandCenterState } from '../../state/useCommandCenterState'
import { Field, FieldRow } from '../primitives'

export function TickerTracker(props: { state: CommandCenterState }) {
  return (
    <form className="holding-form" onSubmit={props.state.actions.addResearchTicker}>
      <FieldRow>
        <Field
          label="Track symbol"
          value={props.state.researchTickerForm.symbol}
          onChange={(value) =>
            props.state.actions.updateResearchTickerForm('symbol', value)
          }
        />
        <Field
          label="Name"
          value={props.state.researchTickerForm.name}
          onChange={(value) =>
            props.state.actions.updateResearchTickerForm('name', value)
          }
        />
      </FieldRow>
      <Field label="Research lane">
        <select
          value={props.state.researchTickerForm.stackLayer}
          onChange={(event) =>
            props.state.actions.updateResearchTickerForm(
              'stackLayer',
              event.target.value,
            )
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
          Track ticker
        </button>
      </div>
    </form>
  )
}
