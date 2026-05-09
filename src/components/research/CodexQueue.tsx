import type { ChangeEvent } from 'react'
import { Hint, KV } from '../primitives'
import type { CommandCenterState } from '../../state/useCommandCenterState'
import { getCodexQueueStatusLabel } from '../../state/useCommandCenterState'

export function CodexQueue(props: { state: CommandCenterState }) {
  const card = props.state.selectedResearchCard
  const record = props.state.selectedCodexQueueRecord

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

  return (
    <>
      <Hint>
        Queue files are local JSON only. The app does not call OpenAI APIs or
        spend API tokens.
      </Hint>
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
      <KV label="status" value={getCodexQueueStatusLabel(record.status)} />
      <KV label="updated" value={record.updatedAt ?? 'not queued'} />
      <KV label="request" value={record.requestPath ?? 'none'} />
      <KV label="result" value={record.resultPath ?? 'none'} />
      <div className="hint">{record.message}</div>
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
