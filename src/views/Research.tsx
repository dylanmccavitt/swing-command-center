import { useState } from 'react'
import {
  CandidateFilter,
} from '../components/research/CandidateFilter'
import { CodexQueue } from '../components/research/CodexQueue'
import { LayerList } from '../components/research/LayerList'
import { ResearchCard } from '../components/research/ResearchCard'
import { TickerTracker } from '../components/research/TickerTracker'
import {
  Hint,
  Panel,
  PanelHead,
  SectionDivider,
  Tabs,
} from '../components/primitives'
import type { CommandCenterState } from '../state/useCommandCenterState'

type ResearchTab = 'card' | 'layers' | 'codex' | 'imports'

export function Research(props: { state: CommandCenterState }) {
  const [tab, setTab] = useState<ResearchTab>('card')
  const card = props.state.selectedResearchCard

  return (
    <section className="view" data-view="research">
      <div className="page-head">
        <div>
          <div className="kicker">— research universe</div>
          <h1 className="page-title">Research card</h1>
          <div className="breadcrumbs">
            workspace<span className="sep">/</span>research
            <span className="sep">/</span>{card?.symbol ?? 'none'}
          </div>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={() => setTab('codex')}>
            Open Codex queue
          </button>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              if (card) void props.state.actions.runResearchForSymbols([card.symbol])
            }}
          >
            Run research
          </button>
        </div>
      </div>

      <Tabs
        active={tab}
        ariaLabel="Research sections"
        tabs={[
          { key: 'card', label: 'Card', count: props.state.researchCards.length },
          { key: 'layers', label: 'Layers', count: props.state.researchLayerGroups.length },
          { key: 'codex', label: 'Codex queue', count: Object.keys(props.state.codexQueue).length },
          { key: 'imports', label: 'Imports' },
        ]}
        onChange={setTab}
      />

      <div className="research-grid">
        <Panel>
          <PanelHead
            kicker="watchlist"
            title="Research lanes"
            pill={`${props.state.researchCards.length} cards`}
          />
          <TickerTracker state={props.state} />
          <div className="dash-rule" />
          <LayerList
            state={props.state}
            onSelect={(symbol) => props.state.actions.setSelectedResearchSymbol(symbol)}
          />
        </Panel>

        <Panel>
          <PanelHead
            kicker={tab === 'codex' ? 'codex queue' : 'research card'}
            title={card ? `${card.symbol} · ${card.name}` : 'No card'}
            pill={props.state.selectedResearchRun.status.replaceAll('_', ' ')}
          />
          {tab === 'codex' ? (
            <CodexQueue state={props.state} />
          ) : tab === 'imports' ? (
            <>
              <Hint>
                Import a validated local result JSON from the Codex queue. It
                drafts editable fields only and stays marked for review.
              </Hint>
              <CodexQueue state={props.state} />
            </>
          ) : (
            <ResearchCard state={props.state} />
          )}
        </Panel>

        <Panel>
          <PanelHead
            kicker="checklist"
            title="Candidate filter"
            pill={`${props.state.filteredResearchScores.length} shown`}
          />
          <CandidateFilter state={props.state} />
        </Panel>
      </div>

      {tab === 'layers' ? (
        <SectionDivider
          label="layer detail"
          meta={`${props.state.researchLayerGroups.length} active layers`}
        />
      ) : null}
    </section>
  )
}
