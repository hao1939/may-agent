# Evaluator heartbeat — 2026-05-01

## Checks

### Session evaluation pipeline liveness (DB is canonical)
- `evaluations.max(createdAt)` = `1777672399850`
- `sessions.max(endedAt)` = `1777674408702`
- lag ≈ `2,008,852 ms` (~33.5 minutes)
- sessions ended last 24h = `3243`
- evaluations created last 24h = `731`

Interpretation: evaluation writes are happening recently (within ~34 minutes of latest ended session), so the pipeline is live. However, coverage is partial (~22.5% of sessions in last 24h have an evaluation row), which may be expected (sampling) or a scope issue.

### Legacy artifacts path
- `.state/evaluations/` newest visible files are dated Apr 29 (and many Mar 24), suggesting this directory is not a reliable freshness indicator.
- Treat as legacy/output drift unless a consumer still depends on this directory.

## Follow-ups proposed
1. Confirm intended evaluation sampling rate / scope (is ~20-25% coverage expected?).
2. If higher coverage is desired, inspect `evaluate-session-llm` cron configuration / filters (agent/kind/source).
3. If any downstream tooling reads `.state/evaluations/`, update it to use DB tables instead.
