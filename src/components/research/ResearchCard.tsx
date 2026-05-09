import { getAiStackLayerLabel } from '../../data/seedWatchlist'
import {
  Field,
  FieldRow,
  Hint,
  KV,
  ScoreBar,
} from '../primitives'
import type { CommandCenterState } from '../../state/useCommandCenterState'
import { RESEARCH_DRAFT_DISCLOSURE } from '../../lib/researchProvider'

export function ResearchCard(props: { state: CommandCenterState }) {
  const card = props.state.selectedResearchCard
  const score = props.state.selectedResearchScore

  if (!card) {
    return (
      <div className="empty-state">
        <strong>No research card</strong>
        <span>Add a holding or watchlist card before drafting research.</span>
      </div>
    )
  }

  return (
    <>
      <KV
        label="layer"
        value={`${getAiStackLayerLabel(card.stackLayer)} · ${
          card.seedType === 'current_holding' ? 'current holding' : 'watchlist'
        }`}
      />
      <ScoreBar
        score={score?.scorePercent ?? 0}
        openFields={score?.missingFields.length ?? 0}
      />
      <Hint>
        Manual checklist only. Source-reported analyst targets and setup levels
        are <b>context</b>, not trade instructions.
      </Hint>
      <div className="actions" style={{ marginBottom: 14 }}>
        <button
          className="btn"
          type="button"
          onClick={() => void props.state.actions.runResearchForSymbols([card.symbol])}
        >
          Run research
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => props.state.actions.runResearchForLayer(card.stackLayer)}
        >
          Run layer
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => props.state.actions.markResearchReviewed(card.symbol)}
        >
          Mark reviewed
        </button>
      </div>
      <div className="dash-rule" />
      <Field
        label="Thesis"
        textarea
        placeholder="One- or two-line summary of why this name is on the list."
        value={card.research.thesis}
        onChange={(value) =>
          props.state.actions.updateResearchField(card.symbol, 'thesis', value)
        }
      />
      <FieldRow>
        <Field
          label="Setup target"
          value={card.research.target}
          onChange={(value) =>
            props.state.actions.updateResearchField(card.symbol, 'target', value)
          }
        />
        <Field
          label="Invalidation"
          value={card.research.invalidation}
          onChange={(value) =>
            props.state.actions.updateResearchField(
              card.symbol,
              'invalidation',
              value,
            )
          }
        />
      </FieldRow>
      <FieldRow>
        <Field
          label="Catalyst window"
          value={card.research.catalyst}
          onChange={(value) =>
            props.state.actions.updateResearchField(card.symbol, 'catalyst', value)
          }
        />
        <Field
          label="Source"
          value={card.research.sourceNotes}
          onChange={(value) =>
            props.state.actions.updateResearchField(
              card.symbol,
              'sourceNotes',
              value,
            )
          }
        />
      </FieldRow>
      <Hint variant="warn">{RESEARCH_DRAFT_DISCLOSURE}</Hint>
    </>
  )
}
