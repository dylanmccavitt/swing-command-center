import { getAiStackLayerLabel } from '../../data/seedWatchlist'
import {
  Field,
  FieldRow,
  Hint,
  KV,
  ScoreBar,
} from '../primitives'
import type { CommandCenterState } from '../../state/useCommandCenterState'
import { formatCurrency } from '../../state/useCommandCenterState'
import { RESEARCH_DRAFT_DISCLOSURE } from '../../lib/researchProvider'
import { summarizeCodexResearchSourceMetadata } from '../../lib/codexResearchQueue'

export function ResearchCard(props: { state: CommandCenterState }) {
  const card = props.state.selectedResearchCard
  const score = props.state.selectedResearchScore
  const quote = card ? props.state.quotesBySymbol.get(card.symbol) : undefined
  const run = props.state.selectedResearchRun
  const sourceSummary = summarizeCodexResearchSourceMetadata(run.sources)

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
      <KV
        label="live quote"
        value={
          quote
            ? `${formatCurrency(quote.price)} · ${quote.source.toUpperCase()}`
            : 'waiting for Alpaca'
        }
      />
      <KV
        label="review"
        value={
          run.updatedAt
            ? `${run.status.replaceAll('_', ' ')} · ${run.updatedAt}`
            : run.status.replaceAll('_', ' ')
        }
      />
      <KV
        label="sources"
        value={
          sourceSummary.total > 0
            ? `${sourceSummary.total} · ${sourceSummary.fresh} fresh · ${sourceSummary.stale} stale`
            : 'not imported'
        }
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
      <div className="field-stack">
        <Field
          label="Catalyst"
          textarea
          placeholder="Events, filings, earnings, news, or setup context to review next."
          value={card.research.catalyst}
          onChange={(value) =>
            props.state.actions.updateResearchField(card.symbol, 'catalyst', value)
          }
        />
        <Field
          label="Invalidation"
          textarea
          placeholder="What would force a thesis rewrite or make the setup unusable."
          value={card.research.invalidation}
          onChange={(value) =>
            props.state.actions.updateResearchField(
              card.symbol,
              'invalidation',
              value,
            )
          }
        />
        <Field
          label="Risk notes"
          textarea
          placeholder="Sourced risks, unknowns, valuation pressure, execution risk, or policy exposure."
          value={card.research.riskNotes}
          onChange={(value) =>
            props.state.actions.updateResearchField(
              card.symbol,
              'riskNotes',
              value,
            )
          }
        />
      </div>
      <FieldRow>
        <Field
          label="Planned entry context"
          value={card.research.plannedEntry}
          onChange={(value) =>
            props.state.actions.updateResearchField(
              card.symbol,
              'plannedEntry',
              value,
            )
          }
        />
        <Field
          label="Stop context"
          value={card.research.stop}
          onChange={(value) =>
            props.state.actions.updateResearchField(card.symbol, 'stop', value)
          }
        />
      </FieldRow>
      <FieldRow>
        <Field
          label="Target context"
          value={card.research.target}
          onChange={(value) =>
            props.state.actions.updateResearchField(card.symbol, 'target', value)
          }
        />
        <Field
          label="Review date"
          type="date"
          value={card.research.reviewDate}
          onChange={(value) =>
            props.state.actions.updateResearchField(
              card.symbol,
              'reviewDate',
              value,
            )
          }
        />
      </FieldRow>
      <Field
        label="Source notes"
        textarea
        placeholder="URLs, publisher notes, analyst target/rating context, and unavailable data notes."
        value={card.research.sourceNotes}
        onChange={(value) =>
          props.state.actions.updateResearchField(
            card.symbol,
            'sourceNotes',
            value,
          )
        }
      />
      {run.sources.length > 0 ? (
        <div className="source-list" aria-label="Imported sources">
          {run.sources.map((source) => (
            <a
              className="source-row"
              href={source.url}
              key={source.id}
              rel="noreferrer"
              target="_blank"
            >
              <span>
                <strong>{source.title}</strong>
                <small>{source.summary}</small>
              </span>
              <span className="card-status draft">{source.freshness}</span>
            </a>
          ))}
        </div>
      ) : null}
      <Hint variant="warn">{RESEARCH_DRAFT_DISCLOSURE}</Hint>
    </>
  )
}
