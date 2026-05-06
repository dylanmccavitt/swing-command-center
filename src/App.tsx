import { seedHoldings } from './data/seedHoldings'
import { buildPortfolioSeedSummary } from './lib/portfolio'
import './App.css'

function App() {
  const summary = buildPortfolioSeedSummary(seedHoldings)

  return (
    <main className="app-shell">
      <section className="overview-panel" aria-labelledby="page-title">
        <div className="title-block">
          <p className="eyebrow">Local-first trading cockpit</p>
          <h1 id="page-title">Swing Command Center</h1>
          <p className="lede">
            Manual Robinhood-held portfolio planning with no broker login, no
            order execution, and no credential storage.
          </p>
        </div>

        <div className="status-grid" aria-label="Bootstrap status">
          <div className="metric-tile">
            <span className="metric-label">Seeded symbols</span>
            <strong>{summary.totalSymbols}</strong>
            <span>{summary.symbols.join(', ')}</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Manual lots needed</span>
            <strong>{summary.manualLotsNeeded}</strong>
            <span>shares and cost basis stay local</span>
          </div>
          <div className="metric-tile">
            <span className="metric-label">Broker access</span>
            <strong>None</strong>
            <span>planning only, no automation</span>
          </div>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Seeded workspace">
        <div className="section-heading">
          <p className="eyebrow">Current holdings seed</p>
          <h2>Ready for manual position details</h2>
        </div>

        <div className="holding-grid">
          {seedHoldings.map((holding) => (
            <article className="holding-card" key={holding.symbol}>
              <div>
                <span className="symbol">{holding.symbol}</span>
                <h3>{holding.name}</h3>
              </div>
              <p>{holding.thesisTag}</p>
              <dl>
                <div>
                  <dt>Layer</dt>
                  <dd>{holding.stackLayer}</dd>
                </div>
                <div>
                  <dt>Shares</dt>
                  <dd>{holding.shares ?? 'Manual'}</dd>
                </div>
                <div>
                  <dt>Average cost</dt>
                  <dd>{holding.averageCost ?? 'Manual'}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="guardrail-band" aria-label="Safety guardrails">
        <h2>Bootstrap guardrails</h2>
        <ul>
          <li>Local storage and manual input first.</li>
          <li>Market data is separate from brokerage access.</li>
          <li>No secrets, API keys, account numbers, or trades in repo data.</li>
        </ul>
      </section>
    </main>
  )
}

export default App
