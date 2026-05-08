# Codex Research Worker Prompt

Use this document when a request JSON is queued in `research-queue/requests/`.
The app does not call OpenAI APIs, store API keys, or run a background research
agent. A human/Codex worker processes the request manually with browser,
Chrome, ChatGPT, or Deep Research, then writes a result JSON file for import.

## Worker Prompt

You are helping update a Swing Command Center research card. Read the pending
request JSON first. Use the request's symbol, company name, AI-stack layer,
current editable card fields, requested output schema, guardrails, and expected
result path.

Research the symbol manually in browser, Chrome, ChatGPT, or Deep Research.
Prefer primary company pages, investor relations, SEC filings, earnings
materials, and high-quality sector context. Also include source-reported
analyst consensus, recent analyst rating or target-price changes, and relevant
option strike context when those data are available from public sources. Do not
use this app as an OpenAI API client. Do not add API keys. Do not log in to
brokerage accounts, scrape brokerage holdings, place trades, or automate
trading.

Write exactly one result JSON file at the request's `expectedResultPath`. It
must match `docs/schemas/codex-research-result.schema.json` and the app's
runtime validator:

- `schemaVersion`: `scc.codexResearchResult.v1`
- `requestId`: copy from the request
- `symbol`: uppercase symbol from the request
- `companyName`: copy from the request
- `draftedAt`: current ISO timestamp
- `reviewState`: `needs_review`
- `disclosure`: `Draft research notes for manual review only. Not a recommendation, rating, guaranteed outcome, or buy/sell instruction.`
- `fields.thesis`: short stock brief, 3-5 sentences, covering the company,
  current setup, key financial/research signal, and analyst backdrop
- `fields.catalyst`: concrete events, data points, and price/setup context to
  monitor next
- `fields.invalidation`: what would force a thesis rewrite or make the setup
  unusable
- `fields.riskNotes`: sourced risks and unknowns
- `fields.sourceNotes`: concise analyst/source notes, including consensus
  rating, target-price range, recent upgrades/downgrades, and source dates when
  available; write `Not found in reviewed sources` for unavailable data
- `fields.plannedEntry`: source-reported entry context only, such as current
  price versus moving averages/support or analyst-target context; do not tell
  the user to enter
- `fields.stop`: source-reported risk level or invalidation-price context only;
  do not tell the user to sell
- `fields.target`: source-reported analyst target range, average target,
  upside/downside context, or notable strike/exit context only; do not make your
  own target
- `fields.reviewDate`: `YYYY-MM-DD`
- `sources[]`: at least one source with `id`, `type`, `title`, `url`,
  `publisher`, `accessedAt`, `publishedAt`, and `notes`

Allowed source `type` values are `recent_news`, `investor_relations`,
`sec_filings`, `earnings_call`, `sector_context`, and `analyst_context`.

Keep the draft framed as a short manual-review stock report. You may report
analyst ratings, analyst price targets, analyst target ranges, and option
strike data as sourced context, but do not create your own rating, promise an
outcome, or write buy/sell instructions. The app will import the file only as
draft notes that need review, and the user must review the source notes before
using the card.
