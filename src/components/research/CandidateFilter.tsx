import { AI_STACK_LAYERS } from '../../data/seedWatchlist'
import { Checkbox, Field, RowList } from '../primitives'
import type { CommandCenterState } from '../../state/useCommandCenterState'

export function CandidateFilter(props: { state: CommandCenterState }) {
  return (
    <>
      <Field label="Layer">
        <select
          value={props.state.researchFilters.layer}
          onChange={(event) =>
            props.state.actions.updateResearchFilter('layer', event.target.value)
          }
        >
          <option value="all">All layers</option>
          {AI_STACK_LAYERS.map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Min score"
        type="number"
        value={props.state.researchFilters.minimumScore}
        onChange={(value) =>
          props.state.actions.updateResearchFilter('minimumScore', value)
        }
      />
      <Checkbox
        checked={props.state.researchFilters.holdingsOnly}
        label="Holdings only"
        onChange={(checked) =>
          props.state.actions.updateResearchFilter('holdingsOnly', checked)
        }
      />
      <Checkbox
        checked={props.state.researchFilters.needsInputOnly}
        label="Needs input"
        onChange={(checked) =>
          props.state.actions.updateResearchFilter('needsInputOnly', checked)
        }
      />
      <div className="dash-rule" />
      <div className="muted small">
        Scores count completed checklist fields only. They do not score
        attractiveness, probability, or expected return.
      </div>
      <div className="dash-rule" />
      <RowList
        items={props.state.filteredResearchScores.slice(0, 6).map((score) => ({
          id: score.symbol,
          index: String(score.scorePercent),
          title: score.symbol,
          desc: `${AI_STACK_LAYERS.find((layer) => layer.id === score.stackLayer)?.label ?? score.stackLayer} · ${score.statusLabel}`,
          delta: `${score.missingFields.length} open`,
          onClick: () => props.state.actions.setSelectedResearchSymbol(score.symbol),
        }))}
      />
    </>
  )
}
