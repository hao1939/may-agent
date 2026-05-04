# Evaluator heartbeat — 2026-05-04

## Checks performed

### Session evaluation pipeline liveness (DB canonical)
- Evaluations latest createdAt: **2026-05-04T07:12:37.717Z**
- Sessions latest startedAt: **2026-05-04T09:20:14.719Z**
- Counts last 7d:
  - evaluations: **2546**
  - sessions: **11797**

Interpretation: evaluation pipeline is **running recently**, but coverage is ~**21.6%** (2546/11797) over 7d.

### Legacy artifact path drift
`.state/evaluations/` newest files are from **Mar 24**, while DB evaluations are fresh (May 04).
Interpretation: `.state/evaluations/task_tree_*.json` is likely a **legacy/stale output path**; do not treat as pipeline failure.

## Actions
- No immediate alerts to escalate (DB evals are fresh).
- Noted potential **coverage gap**: evaluations are being written, but only for a subset of sessions.

## Next suggested step (requires owner/cron context)
- Identify the selection filter for `evaluate-session-llm` (e.g., only certain agents/kinds/sources) and decide whether coverage should be raised.
  - If unintended: widen selection criteria.
  - If intended (cost control): document it explicitly in evaluator criteria/ops docs.
