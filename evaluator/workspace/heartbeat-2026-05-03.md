# Evaluator heartbeat — 2026-05-03

## Signals checked (structural)

### Session-eval pipeline liveness
- DB recency (canonical): `evaluations.max(createdAt)=1777799888302`, `sessions.max(startedAt)=1777801789849`.
- Last-24h volume: `sessions=10086`, `evaluations=2484`.
- Coverage (all-time): `evaluatedSessions=2484 / totalSessions=10086 = 0.2463`.
- Unevaluated sessions: `7883`.

### Coverage gap by agent (sessions total vs unevaluated)
- evaluator: 3514 total, 3514 uneval (0% covered)
- optimizer: 2502 total, 1772 uneval (~29% covered)
- coach: 1933 total, 1173 uneval (~39% covered)
- amy: 1077 total, 834 uneval (~23% covered)
- may: 243 total, 116 uneval (~52% covered)
- qa: 56 total, 9 uneval (~84% covered)
- tech-lead: 137 total, 118 uneval (~14% covered)

### Heuristic vs LLM split
- `evaluatedByHeuristic=0`: 1695
- `evaluatedByHeuristic=1`: 790

## Interpretation
1. **Pipeline is alive** (evalMax close to sessMax; thousands of evals in last 24h).
2. **Coverage is low (~24.6%)** and **highly skewed**: *0% of evaluator sessions are evaluated*, while some others (e.g., QA) are.
3. The `.state/evaluations/` directory shows latest per-session JSON on Apr 29 while DB is current → indicates **legacy artifact path drift** rather than job stalling.

## Action proposed
- Create/adjust a metric+alert for “evaluation coverage overall” and “coverage by agent”; especially flag if any agent is near 0% (like evaluator).
- Escalate to tech-lead/optimizer: check evaluate-session-llm scoping rules (likely excluding evaluator agent sessions) and decide whether to:
  - include evaluator sessions in coverage, or
  - explicitly document exclusion (and update coverage metric to match intended scope).
