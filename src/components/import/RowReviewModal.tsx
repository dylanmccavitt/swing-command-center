import { useEffect, useRef } from 'react'
import type {
  RobinhoodNormalizedRow,
  RobinhoodReviewState,
} from '../../lib/robinhoodCsv'
import {
  formatCurrency,
  formatSignedCurrency,
  getRobinhoodKindLabel,
  getRobinhoodReconciliationLabel,
} from '../../state/useCommandCenterState'
import { Hint, KV } from '../primitives'

export function RowReviewModal(props: {
  row: RobinhoodNormalizedRow | null
  onClose: () => void
  onUpdate: (rowId: string, state: RobinhoodReviewState) => void
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!props.row) {
      return
    }

    closeRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        props.onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props])

  if (!props.row) {
    return null
  }

  const { row } = props
  const isProceedsOnlySell =
    row.kind === 'sell' &&
    row.proceeds !== null &&
    row.realizedGainLoss === null

  return (
    <div
      aria-labelledby="row-review-title"
      aria-modal="true"
      className="modal-overlay"
      role="dialog"
    >
      <div className="review-modal">
        <div className="modal-head">
          <div>
            <div className="kicker">row review</div>
            <h2 className="page-title" id="row-review-title">
              {row.symbol || 'Unmapped'} · {getRobinhoodKindLabel(row.kind)}
            </h2>
          </div>
          <button
            className="btn ghost"
            ref={closeRef}
            type="button"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>
        <div className="modal-body">
          <KV label="review" value={row.reviewState.replaceAll('_', ' ')} />
          <KV label="status" value={getRobinhoodReconciliationLabel(row.reconciliationStatus)} />
          <KV label="trade date" value={row.tradeDate ?? 'missing'} />
          <KV label="quantity" value={row.quantity ?? 'missing'} />
          <KV label="proceeds" value={formatMaybeCurrency(row.proceeds)} />
          <KV label="basis" value={formatMaybeCurrency(row.costBasis)} />
          <KV
            label="recognized realized P/L"
            value={formatMaybeSignedCurrency(row.realizedGainLoss)}
          />
          <KV
            label="wash sale"
            value={formatMaybeCurrency(row.washSaleLossDisallowed)}
          />
          {isProceedsOnlySell ? (
            <Hint variant="warn">
              Accepting this row can count the proceeds for buying power, but
              realized P/L, reserve, and pay-myself stay $0 until basis is
              imported or manually reviewed.
            </Hint>
          ) : null}
          {row.reportKind === 'realized_gain_loss' &&
          row.realizedGainLoss !== null ? (
            <Hint>
              Realized gain/loss CSV values provide recognized realized P/L and
              take precedence over matching account-activity proceeds.
            </Hint>
          ) : null}
          <div className="dash-rule" />
          <div className="muted small">
            {row.description || Object.values(row.raw).filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="btn"
            type="button"
            onClick={() => props.onUpdate(row.id, 'rejected')}
          >
            Reject
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => props.onUpdate(row.id, 'needs_review')}
          >
            Needs review
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => props.onUpdate(row.id, 'accepted')}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

function formatMaybeCurrency(value: number | null): string {
  return value === null ? 'missing' : formatCurrency(value)
}

function formatMaybeSignedCurrency(value: number | null): string {
  return value === null ? 'missing' : formatSignedCurrency(value)
}
