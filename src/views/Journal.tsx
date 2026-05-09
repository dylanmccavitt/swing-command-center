import { useMemo, useState } from 'react'
import { TRADE_JOURNAL_DISCLOSURE } from '../lib/tradeJournal'
import type { TradeJournalEntryStatus } from '../lib/tradeJournal'
import {
  Hint,
  Ledger,
  Pill,
  Tabs,
} from '../components/primitives'
import type { CommandCenterState } from '../state/useCommandCenterState'
import {
  formatCurrency,
  formatDateTime,
  formatShares,
  formatSignedCurrency,
} from '../state/useCommandCenterState'

type JournalTab = 'all' | TradeJournalEntryStatus

const TABS: { key: JournalTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'planned', label: 'Plans' },
  { key: 'executed', label: 'Executed' },
  { key: 'mistake', label: 'Mistakes' },
  { key: 'result', label: 'Results' },
]

export function Journal(props: { state: CommandCenterState }) {
  const [tab, setTab] = useState<JournalTab>('all')
  const entries = useMemo(
    () =>
      tab === 'all'
        ? props.state.journalEntries
        : props.state.journalEntries.filter((entry) => entry.status === tab),
    [props.state.journalEntries, tab],
  )
  const counts = useMemo(() => {
    const next = new Map<JournalTab, number>([['all', props.state.journalEntries.length]])

    for (const key of ['planned', 'executed', 'mistake', 'result'] as const) {
      next.set(
        key,
        props.state.journalEntries.filter((entry) => entry.status === key).length,
      )
    }

    return next
  }, [props.state.journalEntries])

  return (
    <section className="view" data-view="journal">
      <div className="page-head">
        <div>
          <div className="kicker">— trade journal</div>
          <h1 className="page-title">Journal</h1>
          <div className="breadcrumbs">
            workspace<span className="sep">/</span>journal
            <span className="sep">/</span>2026
          </div>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={props.state.actions.exportTradeJournal}>
            Tax export
          </button>
          <button className="btn" type="button" onClick={() => exportJournalCsv(props.state)}>
            CSV export
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              const ticket = props.state.manualTradeTickets[0]
              if (ticket) props.state.actions.addJournalEntryFromTicket(ticket, 'planned')
            }}
          >
            + Entry
          </button>
        </div>
      </div>

      <Tabs
        active={tab}
        ariaLabel="Journal filter"
        tabs={TABS.map((item) => ({
          ...item,
          count: counts.get(item.key) ?? 0,
        }))}
        onChange={setTab}
      />

      <Ledger
        columns="80px 1fr 90px 90px 100px 100px 80px"
        headers={[
          'date',
          'entry',
          <div className="num" key="shares">shares</div>,
          <div className="num" key="raised">raised</div>,
          <div className="num" key="realized">realized</div>,
          <div className="num" key="reserve">reserve</div>,
          <div className="num" key="type">type</div>,
        ]}
        rows={entries.map((entry) => ({
          id: entry.id,
          cells: [
            <div className="mono small muted" key="date">
              {formatDateTime(entry.createdAt)}
            </div>,
            <div key="entry">
              <div>
                <b>{entry.symbol}</b> · {entry.action}
              </div>
              <div className="muted small">{entry.notes || entry.source}</div>
            </div>,
            <div className="num" key="shares">
              {formatShares(entry.shares)}
            </div>,
            <div className="num" key="raised">
              {formatCurrency(entry.cashRaised)}
            </div>,
            <div
              className={`num ${entry.realizedProfitLoss >= 0 ? 'pos' : 'neg'}`}
              key="realized"
            >
              {formatSignedCurrency(entry.realizedProfitLoss)}
            </div>,
            <div className="num" key="reserve">
              {formatCurrency(entry.taxReserveEstimate)}
            </div>,
            <div className="num" key="type">
              <Pill tone={entry.status === 'executed' ? 'exec' : entry.status}>
                {entry.status === 'executed' ? 'exec' : entry.status}
              </Pill>
            </div>,
          ],
        }))}
      />
      <Hint>{TRADE_JOURNAL_DISCLOSURE}</Hint>
    </section>
  )
}

function exportJournalCsv(state: CommandCenterState) {
  const header = [
    'createdAt',
    'symbol',
    'status',
    'action',
    'shares',
    'cashRaised',
    'realizedProfitLoss',
    'taxReserveEstimate',
  ]
  const rows = state.journalEntries.map((entry) =>
    [
      entry.createdAt,
      entry.symbol,
      entry.status,
      entry.action,
      entry.shares ?? '',
      entry.cashRaised,
      entry.realizedProfitLoss,
      entry.taxReserveEstimate,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  )
  const blob = new Blob([[header.join(','), ...rows].join('\n')], {
    type: 'text/csv',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'swing-command-center-journal.csv'
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
