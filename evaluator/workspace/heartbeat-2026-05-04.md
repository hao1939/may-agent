# Evaluator Heartbeat — 2026-05-04

## Findings

### 1) DB liveness: evaluation pipeline is writing, but coverage is low
- `evaluations.max(createdAt)` is close to `sessions.max(startedAt)` (lag ~125s), so the evaluation writer is **alive**.
- However, last-24h coverage is low:
  - sessions (all kinds): 1504
  - evaluated sessions: 79
  - coverage: ~5.25%
- Restricting to `kind='call'` improves but is still low:
  - call sessions: 421
  - evaluated sessions: 79
  - coverage: ~18.76%

Interpretation: This looks less like a total outage and more like **intentional scope restriction (skipping job sessions)** plus **partial throughput limitation** even on call sessions.

### 2) Legacy artifact path drift: `.state/evaluations/` stale relative to DB
- `.state/evaluations` shows newest files dated Apr 29, while DB is writing evaluations “now”.
- This matches the documented guidance in `agents/evaluator/knowledge/criteria.md`: treat `.state/evaluations/` as legacy output.

### 3) High volume of evaluator “job” sessions
- In last 24h: `evaluator` has 1028 `kind='job'` sessions, which dominates total sessions.
- This inflates denominator in naive coverage metrics and may also indicate many internal jobs that are not meant to be evaluated.

## Implications / Suggestions
- A coverage metric should likely be computed on a filtered session set (e.g., `kind='call'` and maybe excluding agent='evaluator' job sessions), or we need clearer documentation on which session kinds are supposed to be evaluated.
- If product intent is to evaluate *all call sessions*, current ~19% indicates backlog/throughput issues; likely worth May/Tech-Lead review.

## Evidence (tool outputs)
- DB lag + counts: `{ evalMax: 1777909677238, sessMax: 1777909802340, recentSessions: 1504, recentEvals: 78, lag_ms: 125102 }`
- Coverage computations: `{ recent_sessions: 1504, evaluated_sessions: 79, coverage: 0.0525 }` and `{ recent_call_sessions: 421, evaluated_sessions: 79, coverage: 0.1876 }`
- Legacy path listing: `.state/evaluations/*` newest Apr 29
