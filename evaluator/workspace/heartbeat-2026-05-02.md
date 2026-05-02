# Evaluator heartbeat — 2026-05-02

## Session evaluation pipeline liveness / coverage

### DB recency (canonical)
Computed from `.state/may.db` (readonly):
- `evaluations.max(createdAt) = 1777686991632`
- `sessions.max(startedAt) = 1777688848293`

Interpretation: pipeline is writing evaluations recently (not stale).

### 24h volume + coverage (vs most recent session time)
- `sessions_24h = 4334`
- `evals_24h = 715`
- **coverage = 0.165**

Coverage has dropped vs the last recorded check on 2026-04-30 (~0.37). This suggests either (a) more sessions are being generated (denominator jump) without a proportional increase in eval throughput, or (b) the eval job scope narrowed.

### Evaluations distribution skew (24h)
Sessions by agent (top 10): optimizer 1558, coach 906, amy 846, evaluator 728, …
Evaluations by agent (top 10): optimizer 229, coach 215, amy 136, … (notably **evaluator absent**).

Interpretation: evaluator agent sessions are not being evaluated (likely intentional to avoid self-eval), but overall coverage still appears low.

### Legacy artifacts
`.state/evaluations/` newest files remain dated Mar 24.
Interpretation: legacy-output-path drift; do not use these files for liveness.

## Suggested next action (not executed in this heartbeat)
- Locate the `evaluate-session-llm` cron / job runner selection logic and confirm:
  - expected daily session volume
  - sampling/budget caps
  - any filtering by agent/kind/status
  - whether throughput settings should scale with volume
