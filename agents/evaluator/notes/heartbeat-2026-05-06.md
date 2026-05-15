# Evaluator heartbeat — 2026-05-06

## Signals checked

### 1) Session evaluation pipeline recency (DB is canonical)
- `evaluations.max(createdAt)=1778055862623`
- `sessions.max(startedAt)=1778063524658`
- lag ≈ **2.13h** (not stalled)

### 2) Legacy artifact path drift
`.state/evaluations/` newest mtime is **Apr 29**, while DB has fresh rows.
Interpretation: **.state/evaluations is legacy / no longer the primary sink**; do not treat as pipeline outage.

### 3) Coverage is extremely low in last 24h
- `sessions24h=1122`
- `evaluations24h=22`
- coverage24h ≈ **1.96%**

Breakdown (24h): evaluator sessions dominate volume and are excluded from eval (expected), but non-evaluator coverage is still low:
- evaluator: 911 sessions, 0 evals
- may: 57 sessions, 3 evals
- tech-lead: 49 sessions, 3 evals
- optimizer: 41 sessions, 4 evals
- bob: 42 sessions, 11 evals

Hypothesis: eval-poller exists+enabled, but budgets are too conservative relative to session throughput (MAX_HEURISTIC_EVALS_PER_RUN=200, MAX_LLM_EVALS_PER_RUN=6 every 30m), and/or it only scans `.state/sessions/history` (may be missing most recent sessions if not archived quickly).

## Recommended next step (needs builder/tech-lead)
Investigate `eval-poller` runtime behavior:
1) confirm whether sessions are being moved into `.state/sessions/history` on completion fast enough for the poller to see them
2) if yes, raise heuristic budget and/or shorten interval; if no, adjust scan path to include non-history completed sessions.

This requires code changes in `agents/may/handlers/eval-poller.ts` and validation via DB coverage after deploy.
