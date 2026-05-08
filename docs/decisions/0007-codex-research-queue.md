# 0007: Codex Research Queue

## Chosen

Add a local JSON request/result queue for Codex or ChatGPT-assisted research.
The app creates structured request files, validates manually produced short
stock-report result files, and imports valid drafts into the existing editable
research card as AI-drafted / Needs review.

## Why

The next research slice needs deeper manual research help without putting
OpenAI API calls, API keys, or subscription automation inside the app. A local
file queue keeps the cockpit fast and local-first while letting a separate
human/Codex worker use browser, Chrome, ChatGPT, or Deep Research outside the
runtime.

## Options Considered

- Keep only the deterministic curated source-pack provider.
- Add OpenAI API calls directly in the frontend.
- Add a backend worker that silently invokes a Codex or ChatGPT subscription.
- Add a local request/result JSON queue with manual worker docs and runtime
  import validation.

## Tradeoffs

The queue does not automatically perform research. The user or a worker must
process pending request JSON and write a valid result JSON file. That manual
step is intentional for this slice because it avoids credentials, API spend,
and hidden automation while preserving typed validation and source metadata.

## Consequences

- Generated request and result JSON live under `research-queue/` and are ignored
  by source control.
- Request/result schemas and the worker prompt are committed.
- Imported results must pass local validation, include source metadata, and use
  the standard manual-review disclosure.
- Invalid, missing, pending, imported, and error states are visible in the
  research card UI.
- Imported copy may source-report analyst ratings, target prices, target-price
  ranges, and option strike context, but must not create its own rating,
  guarantee an outcome, or write buy/sell instructions.
