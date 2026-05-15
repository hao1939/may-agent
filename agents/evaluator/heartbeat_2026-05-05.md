# Evaluator heartbeat — 2026-05-05 — eval coverage & liveness

## Signals

### DB recency (canonical)

- `evaluations.max(createdAt)=1777940199976`
- `sessions.max(endedAt)=1777945733331`

So the evaluation writer is alive, but evaluations lag newest sessions by ~**5533s (~92 min)**.

### Coverage gap (ended sessions without any evaluation row)

- `missing=10126` ended sessions have **no** row in `evaluations`.
- Missing by agent (top):
  - evaluator: 5263
  - optimizer: 1873
  - coach: 1200
  - amy: 889
  - others much smaller

Interpretation: evaluation pipeline appears to only evaluate a subset of sessions (likely scoped by kind/source/agent, or sampling), not “all ended sessions”.

### Cron config reality

`agents/may/cron.json` contains **`eval-poller` enabled**, which:

> "Poll recent completed sessions and evaluate them using evaluateStandaloneSession()."

So the current path is likely `eval-poller` (not the old `evaluate-session-llm`), and references to `evaluate-session-llm` in docs may be stale.

Legacy note: `.state/evaluations/` contains some files with recent mtimes (Apr 29) but task_tree artifacts are older (Mar 24), consistent with “legacy output drift” rather than total pipeline failure.

## Hypotheses (actionable)

1) `eval-poller` intentionally filters (e.g., by `kind`, `source`, `opCount`, or agent allowlist), producing low coverage.
2) `eval-poller` backlog/throughput issue (runs every 30m, but cannot keep up), causing lag and low coverage.

## Next concrete query

- Inspect `eval-poller` implementation: identify filters, batch size, and ordering.
- Compute coverage for last 24h by kind/source/agent to determine what’s excluded vs backlogged.
