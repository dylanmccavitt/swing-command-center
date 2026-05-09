import { useMemo, useState } from 'react'
import {
  buildSellFillsFromAcceptedRobinhoodRows,
  parseRobinhoodCsvFile,
  ROBINHOOD_CSV_DISCLOSURE,
  updateRobinhoodRowReviewState,
  type RobinhoodCsvReportKind,
  type RobinhoodNormalizedRow,
} from '../lib/robinhoodCsv'
import { SELL_FILL_DISCLOSURE } from '../lib/sellFills'
import { RowReviewModal } from '../components/import/RowReviewModal'
import {
  Hint,
  KV,
  Ledger,
  Panel,
  PanelHead,
} from '../components/primitives'
import type { CommandCenterState } from '../state/useCommandCenterState'
import {
  formatCurrency,
  getRobinhoodKindLabel,
  getRobinhoodReconciliationLabel,
} from '../state/useCommandCenterState'

export function Import(props: { state: CommandCenterState }) {
  const [reviewRow, setReviewRow] = useState<RobinhoodNormalizedRow | null>(null)
  const fixtureRows = useMemo(() => buildFixtureRows(), [])
  const rows =
    props.state.robinhoodRows.length > 0 ? props.state.robinhoodRows : fixtureRows
  const isFixture = props.state.robinhoodRows.length === 0
  const acceptedRows = rows.filter((row) => row.reviewState === 'accepted')
  const csvRealized = rows.reduce((total, row) => total + (row.realizedGainLoss ?? 0), 0)
  const journalRealized = isFixture
    ? csvRealized
    : props.state.realizedProfitSummary.netRealizedTradingProfit
  const delta = csvRealized - journalRealized
  const matched = rows.filter((row) => row.reconciliationStatus === 'matched').length
  const review = rows.filter((row) => row.reviewState === 'needs_review').length
  const unmapped = rows.filter(
    (row) => row.reconciliationStatus === 'unsupported_row',
  ).length

  function updateReview(rowId: string, state: RobinhoodNormalizedRow['reviewState']) {
    if (isFixture) {
      setReviewRow((current) =>
        current?.id === rowId ? { ...current, reviewState: state } : current,
      )
      return
    }

    props.state.actions.updateRobinhoodReviewState(rowId, state)
    setReviewRow(null)
  }

  return (
    <section className="view" data-view="import">
      <div className="page-head">
        <div>
          <div className="kicker">— robinhood csv reconcile</div>
          <h1 className="page-title">Import</h1>
          <div className="breadcrumbs">
            workspace<span className="sep">/</span>import
            <span className="sep">/</span>robinhood
          </div>
        </div>
        <div className="actions">
          <button className="btn" type="button">
            Open template
          </button>
          <CsvButton
            label="Account CSV"
            reportKind="account_activity"
            onFile={props.state.actions.importRobinhoodCsvFile}
          />
          <CsvButton
            label="Gain/loss CSV"
            reportKind="realized_gain_loss"
            onFile={props.state.actions.importRobinhoodCsvFile}
          />
        </div>
      </div>

      <div className="split-2">
        <Panel>
          <PanelHead
            kicker="csv preview"
            title={isFixture ? 'Robinhood fixture preview' : 'Robinhood activity'}
            pill={`${rows.length} rows · ${unmapped} unmapped`}
          />
          <Ledger
            columns="80px 1fr 70px 85px 95px 75px 82px"
            headers={[
              'date',
              'desc',
              <div className="num" key="qty">qty</div>,
              <div className="num" key="price">price</div>,
              <div className="num" key="amount">amount</div>,
              <div className="num" key="fees">fees</div>,
              <div className="num" key="type">type</div>,
            ]}
            rows={rows.slice(0, 12).map((row) => ({
              id: row.id,
              cells: [
                <div className="mono small muted" key="date">
                  {row.tradeDate?.slice(5) ?? '--'}
                </div>,
                <button
                  className="tag"
                  key="desc"
                  type="button"
                  onClick={() => setReviewRow(row)}
                >
                  <b>{row.symbol || 'Cash'}</b> · {getRobinhoodKindLabel(row.kind)}
                </button>,
                <div className="num" key="qty">{row.quantity ?? ''}</div>,
                <div className="num" key="price">{formatCurrency(row.price)}</div>,
                <div className="num" key="amount">{formatCurrency(row.amount)}</div>,
                <div className="num" key="fees">{formatCurrency(row.fees)}</div>,
                <div className="num" key="type">
                  <span
                    className={`card-status ${
                      row.reconciliationStatus === 'matched'
                        ? 'exec'
                        : row.reconciliationStatus === 'unsupported_row'
                          ? 'draft'
                          : 'ready'
                    }`}
                  >
                    {row.reconciliationStatus === 'matched'
                      ? 'match'
                      : row.reviewState === 'needs_review'
                        ? 'review'
                        : getRobinhoodReconciliationLabel(row.reconciliationStatus)}
                  </span>
                </div>,
              ],
            }))}
          />
        </Panel>

        <Panel>
          <PanelHead kicker="reconcile" title="Match against journal" />
          <KV label="rows in csv" value={rows.length} />
          <KV label="matched" tone="pos" value={matched} />
          <KV label="review" value={review} />
          <KV label="unmapped" value={unmapped} />
          <div className="dash-rule" />
          <KV label="csv realized" tone="pos" value={formatCurrency(csvRealized)} />
          <KV label="journal realized" tone="pos" value={formatCurrency(journalRealized)} />
          <KV label="delta" value={formatCurrency(delta)} />
          <div className="dash-rule" />
          <Hint>{ROBINHOOD_CSV_DISCLOSURE}</Hint>
          <Hint>{SELL_FILL_DISCLOSURE}</Hint>
          {props.state.robinhoodImportMessage ? (
            <div className="hint">{props.state.robinhoodImportMessage}</div>
          ) : null}
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="btn" type="button" onClick={() => setReviewRow(rows[0] ?? null)}>
              Map remaining
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                buildSellFillsFromAcceptedRobinhoodRows(acceptedRows)
                props.state.actions.applyAcceptedRobinhoodRows()
              }}
            >
              Apply matches
            </button>
          </div>
        </Panel>
      </div>

      <RowReviewModal
        row={reviewRow}
        onClose={() => setReviewRow(null)}
        onUpdate={updateReview}
      />
    </section>
  )
}

function CsvButton(props: {
  label: string
  reportKind: RobinhoodCsvReportKind
  onFile: (file: File, reportKind: RobinhoodCsvReportKind) => void
}) {
  return (
    <label className="btn primary">
      {props.label}
      <input
        accept=".csv,text/csv,text/plain"
        style={{ display: 'none' }}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) props.onFile(file, props.reportKind)
        }}
      />
    </label>
  )
}

function buildFixtureRows(): RobinhoodNormalizedRow[] {
  const importedAt = '2026-05-08T12:00:00.000Z'
  const realized = parseRobinhoodCsvFile({
    fileName: 'realized-gain-loss.csv',
    importedAt,
    text: [
      'Symbol,Date Acquired,Date Sold,Quantity,Proceeds,Cost Basis,Realized Gain/Loss,Term,Wash Sale Loss Disallowed',
      'NVDA,01/02/2026,05/02/2026,4,"$1,200.00","$1,000.00",$200.00,Short Term,$0.00',
      'AMD,01/10/2026,05/03/2026,5,$500.00,$600.00,"($100.00)",Short Term,$25.00',
    ].join('\n'),
  }).rows
  const accepted = updateRobinhoodRowReviewState(
    realized,
    realized[0]?.id ?? '',
    'accepted',
  )

  return updateRobinhoodRowReviewState(accepted, realized[1]?.id ?? '', 'accepted')
}
