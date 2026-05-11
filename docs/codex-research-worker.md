# Codex Research Worker Prompt

Use this document when a request JSON is queued in `research-queue/requests/`.
The app does not call OpenAI APIs, store API keys, or run a background research
agent. A human/Codex worker processes the request manually with browser,
Chrome, ChatGPT, or Deep Research, then writes a result JSON file for import.

## Worker Prompt

You are helping update a Swing Command Center research card. Read the pending
request JSON first. Use the request's symbol, company name, research lane,
`researchDesk` checklist, current editable card fields, requested output schema,
guardrails, and expected result path. Requests can be for any ticker, including
General watchlist names such as HIMS; do not assume the company is part of the
AI stack.

Research the symbol manually in browser, Chrome, ChatGPT, or Deep Research.
Prefer primary company pages, investor relations, SEC filings, earnings
materials, recent news, and high-quality sector or peer context. For HIMS or
other general watchlist names, use company, filing/regulatory, healthcare,
consumer, peer, or category sources that actually fit the business. Also include
source-reported analyst consensus, recent analyst rating or target-price
changes, and relevant option strike context when those data are available from
public sources. Do not use this app as an OpenAI API client. Do not add API
keys. Do not log in to brokerage accounts, scrape brokerage holdings, place
trades, or automate trading.

Use the request's `researchDesk.sourceChecklist` as the research desk checklist:

- Company primary source: investor relations, earnings, company updates, or
  shareholder materials.
- Filing or regulatory source: SEC filings, risk language, or relevant
  regulatory context.
- Recent news: current catalyst or risk events.
- Analyst context: sourced rating/target/range changes when public.
- Sector or peer context: industry, peer, macro, or category context that fits
  the ticker.
- Price setup context: source-reported price, moving-average, support, or
  option-strike context only.

Use the request's `researchDesk.importChecklist` before writing the result:
catalyst filled, invalidation filled, target/stop context filled, review state
left as `needs_review`, and every source includes metadata.

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

## Result Skeleton

```json
{
  "schemaVersion": "scc.codexResearchResult.v1",
  "requestId": "copy-from-request",
  "symbol": "HIMS",
  "companyName": "Hims & Hers Health",
  "draftedAt": "2026-05-11T14:00:00.000Z",
  "reviewState": "needs_review",
  "disclosure": "Draft research notes for manual review only. Not a recommendation, rating, guaranteed outcome, or buy/sell instruction.",
  "fields": {
    "thesis": "Short sourced brief for manual review.",
    "catalyst": "Events, filings, earnings, product, regulatory, or price/setup context to monitor next.",
    "invalidation": "What would force a rewrite or make the setup unusable.",
    "riskNotes": "Sourced risks and unknowns.",
    "sourceNotes": "One line per source. Include analyst target/rating context or write Not found in reviewed sources.",
    "plannedEntry": "Source context only; do not tell the user to enter.",
    "stop": "Source or invalidation context only; do not tell the user to sell.",
    "target": "Source-reported analyst target range or strike context only; do not create an app target.",
    "reviewDate": "2026-05-18"
  },
  "sources": [
    {
      "id": "company-ir",
      "type": "investor_relations",
      "title": "Company investor relations page",
      "url": "https://example.com/investors",
      "publisher": "Company Investor Relations",
      "accessedAt": "2026-05-11T13:55:00.000Z",
      "publishedAt": null,
      "notes": "Short note explaining what this source supports."
    }
  ]
}
```
