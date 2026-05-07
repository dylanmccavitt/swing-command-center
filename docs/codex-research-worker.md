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
materials, and high-quality sector context. Do not use this app as an OpenAI
API client. Do not add API keys. Do not log in to brokerage accounts, scrape
brokerage holdings, place trades, or automate trading.

Write exactly one result JSON file at the request's `expectedResultPath`. It
must match `docs/schemas/codex-research-result.schema.json` and the app's
runtime validator:

- `schemaVersion`: `scc.codexResearchResult.v1`
- `requestId`: copy from the request
- `symbol`: uppercase symbol from the request
- `companyName`: copy from the request
- `draftedAt`: current ISO timestamp
- `reviewState`: `needs_review`
- `disclosure`: `AI-drafted source summary for manual review only. Not a recommendation, rating, guaranteed outcome, or buy/sell instruction.`
- `fields.thesis`: short sourced thesis draft
- `fields.catalyst`: concrete sourced catalysts to monitor
- `fields.invalidation`: what would force a thesis rewrite
- `fields.riskNotes`: sourced risks and unknowns
- `fields.sourceNotes`: concise source-by-source notes
- `fields.reviewDate`: `YYYY-MM-DD`
- `sources[]`: at least one source with `id`, `type`, `title`, `url`,
  `publisher`, `accessedAt`, `publishedAt`, and `notes`

Allowed source `type` values are `recent_news`, `investor_relations`,
`sec_filings`, `earnings_call`, and `sector_context`.

Keep the draft framed as manual research. Do not write ratings, certainty,
guaranteed outcomes, price targets, or buy/sell instructions. The app will
import the file only as AI-drafted / Needs review, and the user must review the
source notes before accepting the card.
