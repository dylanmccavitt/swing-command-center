import { useMemo, useState } from 'react'
import {
  buildSellFillsFromAcceptedRobinhoodRows,
  ROBINHOOD_CSV_DISCLOSURE,
  parseRobinhoodCsvFile,
  updateRobinhoodRowReviewState,
  type RobinhoodCsvReportKind,
  type RobinhoodNormalizedRow,
} from '../lib/robinhoodCsv'
import {
  getRobinhoodHoldingsReviewDecision,
  type RobinhoodDerivedHolding,
} from '../lib/robinhoodHoldingsSync'
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
  formatSignedCurrency,
  getRobinhoodKindLabel,
  getRobinhoodReconciliationLabel,
} from '../state/useCommandCenterState'

export function Import(props: { state: CommandCenterState }) {
  const [reviewRow, setReviewRow] = useState<RobinhoodNormalizedRow | null>(null)
  const fixtureRows = useMemo(() => buildFixtureRows(), [])
  const hasImportedRows = props.state.robinhoodRows.length > 0
  const isFixture =
    !hasImportedRows &&
    props.state.robinhoodImports.length === 0 &&
    !props.state.robinhoodImportMessage
  const rows = hasImportedRows ? props.state.robinhoodRows : isFixture ? fixtureRows : []
  const canClearImport =
    hasImportedRows ||
    props.state.robinhoodImports.length > 0 ||
    Boolean(props.state.robinhoodImportMessage)
  const acceptedRows = rows.filter((row) => row.reviewState === 'accepted')
  const rejectedRows = rows.filter((row) => row.reviewState === 'rejected')
  const sellRows = rows.filter((row) => row.kind === 'sell')
  const recognizedSellRows = sellRows.filter(
    (row) => row.realizedGainLoss !== null,
  )
  const missingBasisSellRows = sellRows.filter(
    (row) => row.proceeds !== null && row.realizedGainLoss === null,
  )
  const acceptedSellRows = acceptedRows.filter((row) => row.kind === 'sell')
  const acceptedRecognizedSellRows = acceptedSellRows.filter(
    (row) => row.realizedGainLoss !== null,
  )
  const acceptedMissingBasisSellRows = acceptedSellRows.filter(
    (row) => row.proceeds !== null && row.realizedGainLoss === null,
  )
  const acceptedProceeds = acceptedSellRows.reduce(
    (total, row) => total + (row.proceeds ?? 0),
    0,
  )
  const nextReviewRow =
    rows.find((row) => row.reviewState === 'needs_review') ?? rows[0] ?? null
  const csvRealized = recognizedSellRows.reduce(
    (total, row) => total + (row.realizedGainLoss ?? 0),
    0,
  )
  const acceptedRealized = acceptedRecognizedSellRows.reduce(
    (total, row) => total + (row.realizedGainLoss ?? 0),
    0,
  )
  const journalRealized = isFixture
    ? csvRealized
    : props.state.realizedProfitSummary.netRealizedTradingProfit
  const delta = csvRealized - journalRealized
  const matched = rows.filter((row) => row.reconciliationStatus === 'matched').length
  const review = rows.filter((row) => row.reviewState === 'needs_review').length
  const unmapped = rows.filter(
    (row) => row.reconciliationStatus === 'unsupported_row',
  ).length
  const derivedHoldings = props.state.robinhoodDerivedHoldings
  const pendingHoldingUpdates = derivedHoldings.filter(
    (holding) =>
      getRobinhoodHoldingsReviewDecision(
        props.state.robinhoodHoldingsReview,
        holding,
      ) === 'needs_review',
  )
  const appliedHoldingUpdates = derivedHoldings.filter(
    (holding) =>
      getRobinhoodHoldingsReviewDecision(
        props.state.robinhoodHoldingsReview,
        holding,
      ) === 'applied',
  )
  const missingBasisHoldings = derivedHoldings.filter(
    (holding) => holding.status === 'missing_basis',
  )

  function updateReview(rowId: string, state: RobinhoodNormalizedRow['reviewState']) {
    if (isFixture) {
      setReviewRow(null)
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
          <button
            className="btn"
            disabled={!canClearImport}
            type="button"
            onClick={props.state.actions.clearRobinhoodImportRows}
          >
            Clear import
          </button>
          <CsvButton
            label="Account CSV"
            reportKind="account_activity"
            onFile={props.state.actions.importRobinhoodCsvFile}
          />
          <CsvButton
            label="Positions CSV"
            reportKind="current_positions"
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
            columns="80px 1fr 70px 85px 95px 95px 82px"
            headers={[
              'date',
              'desc',
              <div className="num" key="qty">qty</div>,
              <div className="num" key="price">price</div>,
              <div className="num" key="proceeds">proceeds</div>,
              <div className="num" key="realized">realized</div>,
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
                <div className="num" key="proceeds">
                  {formatCurrency(row.proceeds)}
                </div>,
                <div className="num" key="realized">
                  {row.realizedGainLoss === null
                    ? 'missing'
                    : formatSignedCurrency(row.realizedGainLoss)}
                </div>,
                <div className="num" key="type">
                  <span
                    className={`card-status ${getImportRowStatusClass(row)}`}
                  >
                    {getImportRowStatusLabel(row)}
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
          <KV label="accepted" tone="pos" value={acceptedRows.length} />
          <KV label="review" value={review} />
          <KV label="rejected" value={rejectedRows.length} />
          <KV label="unmapped" value={unmapped} />
          <div className="dash-rule" />
          <KV
            label="CSV recognized P/L"
            tone={csvRealized >= 0 ? 'pos' : 'neg'}
            value={formatSignedCurrency(csvRealized)}
          />
          <KV
            label="accepted recognized P/L"
            tone={acceptedRealized >= 0 ? 'pos' : 'neg'}
            value={formatSignedCurrency(acceptedRealized)}
          />
          <KV
            label="accepted proceeds"
            value={formatCurrency(acceptedProceeds)}
          />
          <KV
            label="accepted proceeds-only"
            value={acceptedMissingBasisSellRows.length}
          />
          <KV label="missing basis rows" value={missingBasisSellRows.length} />
          <KV
            label="journal realized"
            tone={journalRealized >= 0 ? 'pos' : 'neg'}
            value={formatSignedCurrency(journalRealized)}
          />
          <KV label="delta" value={formatSignedCurrency(delta)} />
          <div className="dash-rule" />
          {missingBasisSellRows.length > 0 ? (
            <Hint variant="warn">
              {missingBasisSellRows.length} sell row
              {missingBasisSellRows.length === 1 ? '' : 's'} have proceeds but
              no imported cost basis. Account-activity CSV can show cash raised,
              but realized P/L, reserve, and pay-myself need a realized
              gain/loss CSV row or manual basis.
            </Hint>
          ) : null}
          {acceptedMissingBasisSellRows.length > 0 ? (
            <Hint variant="warn">
              {acceptedMissingBasisSellRows.length} accepted sell row
              {acceptedMissingBasisSellRows.length === 1 ? '' : 's'} will count
              as buying-power proceeds, but reserve and pay-myself stay $0 until
              basis is present.
            </Hint>
          ) : null}
          <Hint>{ROBINHOOD_CSV_DISCLOSURE}</Hint>
          <Hint>{SELL_FILL_DISCLOSURE}</Hint>
          {props.state.robinhoodImportMessage ? (
            <div className="hint">{props.state.robinhoodImportMessage}</div>
          ) : null}
          <div className="actions" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={!nextReviewRow}
              type="button"
              onClick={() => setReviewRow(nextReviewRow)}
            >
              Map remaining
            </button>
            <button
              className="btn primary"
              disabled={acceptedRows.length === 0}
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

      <Panel>
        <PanelHead
          kicker="holdings sync"
          title="Review holdings changes"
          pill={`${pendingHoldingUpdates.length} pending · ${appliedHoldingUpdates.length} applied`}
        />
        <div className="split-2 compact">
          <div>
            <KV label="derived holdings" value={derivedHoldings.length} />
            <KV label="missing basis" value={missingBasisHoldings.length} />
          </div>
          <div>
            <Hint>
              Holdings sync uses accepted local CSV rows only. It does not log
              in, scrape, store credentials, execute orders, automate trading,
              or provide tax advice.
            </Hint>
          </div>
        </div>
        <Ledger
          columns="80px 120px 110px 110px 110px 110px 100px 170px"
          headers={[
            'symbol',
            'source',
            <div className="num" key="current-shares">current sh</div>,
            <div className="num" key="csv-shares">csv sh</div>,
            <div className="num" key="current-avg">current avg</div>,
            <div className="num" key="csv-avg">csv avg</div>,
            <div className="num" key="state">state</div>,
            <div className="num" key="actions">actions</div>,
          ]}
          rows={derivedHoldings.map((holding) =>
            buildHoldingReviewRow(holding, props.state),
          )}
        />
        <div className="actions" style={{ marginTop: 10 }}>
          <button
            className="btn primary"
            disabled={pendingHoldingUpdates.length === 0}
            type="button"
            onClick={props.state.actions.applyAllRobinhoodDerivedHoldings}
          >
            Apply all reviewed holdings
          </button>
        </div>
      </Panel>

      <RowReviewModal
        row={reviewRow}
        onClose={() => setReviewRow(null)}
        onUpdate={updateReview}
      />
    </section>
  )
}

function getImportRowStatusLabel(row: RobinhoodNormalizedRow): string {
  if (row.reviewState === 'accepted') {
    return 'accepted'
  }

  if (row.reviewState === 'rejected') {
    return 'rejected'
  }

  if (row.reconciliationStatus === 'matched') {
    return 'match'
  }

  return row.reviewState === 'needs_review'
    ? 'review'
    : getRobinhoodReconciliationLabel(row.reconciliationStatus)
}

function getImportRowStatusClass(row: RobinhoodNormalizedRow): string {
  if (row.reviewState === 'accepted') {
    return 'exec'
  }

  if (row.reviewState === 'rejected') {
    return 'draft'
  }

  if (row.reconciliationStatus === 'matched') {
    return 'exec'
  }

  return row.reconciliationStatus === 'unsupported_row' ? 'draft' : 'ready'
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

function buildHoldingReviewRow(
  holding: RobinhoodDerivedHolding,
  state: CommandCenterState,
) {
  const reviewDecision = getRobinhoodHoldingsReviewDecision(
    state.robinhoodHoldingsReview,
    holding,
  )
  const currentLot = state.manualLots[holding.symbol]
  const canApply =
    holding.shares !== null &&
    holding.status !== 'missing_shares' &&
    holding.status !== 'closed'

  return {
    id: holding.symbol,
    cells: [
      <div key="symbol">
        <b>{holding.symbol}</b>
        <div className="muted small">{holding.name}</div>
      </div>,
      <div className="small" key="source">
        {holding.source === 'current_positions_csv'
          ? 'positions'
          : 'ledger'}
      </div>,
      <div className="num" key="current-shares">
        {currentLot?.shares || 'missing'}
      </div>,
      <div className="num" key="csv-shares">
        {formatMaybeNumber(holding.shares)}
      </div>,
      <div className="num" key="current-avg">
        {formatCurrentAverageCost(currentLot?.averageCost)}
      </div>,
      <div className="num" key="csv-avg">
        {holding.averageCost === null
          ? 'missing'
          : formatCurrency(holding.averageCost)}
      </div>,
      <div className="num" key="state">
        <span className={`card-status ${getHoldingReviewStatusClass(holding, reviewDecision)}`}>
          {reviewDecision === 'needs_review'
            ? holding.status.replaceAll('_', ' ')
            : reviewDecision}
        </span>
      </div>,
      <div className="actions tight" key="actions">
        <button
          className="btn ghost"
          disabled={reviewDecision === 'rejected'}
          type="button"
          onClick={() => state.actions.rejectRobinhoodDerivedHolding(holding)}
        >
          Reject
        </button>
        <button
          className="btn"
          disabled={!canApply || reviewDecision === 'applied'}
          type="button"
          onClick={() => state.actions.applyRobinhoodDerivedHoldingSync(holding)}
        >
          Apply
        </button>
      </div>,
    ],
  }
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

function getHoldingReviewStatusClass(
  holding: RobinhoodDerivedHolding,
  reviewDecision: string,
): string {
  if (reviewDecision === 'applied') {
    return 'exec'
  }

  if (reviewDecision === 'rejected' || holding.status === 'closed') {
    return 'draft'
  }

  return holding.status === 'ready' ? 'ready' : 'draft'
}

function formatMaybeNumber(value: number | null): string {
  return value === null ? 'missing' : String(Number(value.toFixed(6)))
}

function formatCurrentAverageCost(value: string | undefined): string {
  if (!value) {
    return 'missing'
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? formatCurrency(parsed) : 'missing'
}
