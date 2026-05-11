import type { ChangeEvent } from 'react'
import { Hint, KV } from '../primitives'
import type { CommandCenterState } from '../../state/useCommandCenterState'
import { getCodexQueueStatusLabel } from '../../state/useCommandCenterState'
import { getAiStackLayerLabel } from '../../data/seedWatchlist'
import {
  CODEX_RESEARCH_IMPORT_CHECKLIST,
  CODEX_RESEARCH_SOURCE_CHECKLIST,
  summarizeCodexResearchSourceMetadata,
} from '../../lib/codexResearchQueue'

export function CodexQueue(props: { state: CommandCenterState }) {
  const card = props.state.selectedResearchCard
  const record = props.state.selectedCodexQueueRecord
  const run = props.state.selectedResearchRun
  const sourceSummary = summarizeCodexResearchSourceMetadata(run.sources)

  function importResult(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (card && file) {
      void props.state.actions.importCodexResearchResult(card.symbol, file)
    }
  }

  if (!card) {
    return (
      <div className="empty-state">
        <strong>No selected symbol</strong>
        <span>Select a research card before creating a Codex queue file.</span>
      </div>
    )
  }

  const sourceChecklist =
    record.request?.researchDesk.sourceChecklist ?? CODEX_RESEARCH_SOURCE_CHECKLIST
  const importChecklist =
    record.request?.researchDesk.importChecklist ?? CODEX_RESEARCH_IMPORT_CHECKLIST
  const sourceSummaryText =
    sourceSummary.total > 0
      ? `${sourceSummary.total} sources · ${sourceSummary.fresh} fresh · ${sourceSummary.stale} stale`
      : 'none imported'

  return (
    <>
      <Hint>
        Queue files are local JSON only. The app does not call OpenAI APIs,
        use API keys, or spend API tokens.
      </Hint>
      <div className="queue-desk">
        <div className="queue-desk-head">
          <div>
            <div className="kicker">daily research desk</div>
            <strong>{card.symbol} · {card.name}</strong>
          </div>
          <span className="card-status draft">
            {record.request?.researchDesk.laneLabel ??
              getAiStackLayerLabel(card.stackLayer)}
          </span>
        </div>
        <div className="queue-metrics">
          <KV label="status" value={getCodexQueueStatusLabel(record.status)} />
          <KV label="sources" value={sourceSummaryText} />
          <KV label="updated" value={record.updatedAt ?? 'not queued'} />
        </div>
      </div>
      <div className="actions" style={{ marginBottom: 14 }}>
        <button
          className="btn primary"
          type="button"
          onClick={() => props.state.actions.queueCodexResearchRequest(card)}
        >
          Create request
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => props.state.actions.markCodexResultMissing(card.symbol)}
        >
          Check result
        </button>
        <label className="btn">
          Import result
          <input
            accept="application/json,.json"
            style={{ display: 'none' }}
            type="file"
            onChange={importResult}
          />
        </label>
      </div>
      <KV label="request" value={record.requestPath ?? 'none'} />
      <KV label="result" value={record.resultPath ?? 'none'} />
      <div className="hint">{record.message}</div>
      <div className="checklist-grid" aria-label="Source checklist">
        {sourceChecklist.map((item) => (
          <div className="check-item" key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.notes}</span>
            </div>
            <span className="card-status draft">
              {item.required ? 'required' : 'context'}
            </span>
          </div>
        ))}
      </div>
      <div className="checklist-grid compact" aria-label="Import checklist">
        {importChecklist.map((item) => (
          <div className="check-item" key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.notes}</span>
            </div>
          </div>
        ))}
      </div>
      {record.errors.length > 0 ? (
        <ul className="small muted">
          {record.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
