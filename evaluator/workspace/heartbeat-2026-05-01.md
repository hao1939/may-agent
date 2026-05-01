# Evaluator heartbeat — 2026-05-01

## Checks run (evidence)
- DB recency: evaluations MAX(createdAt) = 2026-05-01 22:56:30 UTC (fresh)
- Legacy artifacts: `.state/evaluations/` still has many files last updated ~2026-03-24, but also some from 2026-04-29 → likely legacy output path drift, not pipeline stoppage.

## Coverage probe
### Last 7 days
- sessions: 6626
- unevaluated: 4578
- coverage: **0.3091**

Top unevaluated sources (7d):
- evaluator: 1821/1821 unevaluated (coverage 0)
- optimizer: 994/1642 unevaluated (coverage 0.3946)
- coach: 855/1590 unevaluated (coverage 0.4623)
- amy: 721/948 unevaluated (coverage 0.2395)

### Last 24 hours (for freshness)
- amy coverage24h: 0.1608 (710/846 unevaluated)
- optimizer coverage24h: 0.2579 (584/787 unevaluated)
- coach coverage24h: 0.3133 (480/699 unevaluated)
- evaluator coverage24h: 0 (670/670 unevaluated)

## Hypothesis
The evaluation pipeline is running (evaluations table is fresh), but it is sampling/scoping such that a majority of sessions (especially for high-volume agents) are not being evaluated.

A second possibility is that some sessions (e.g., evaluator’s own heartbeat sessions) are intentionally excluded from evaluation; confirm whether exclusion rules exist and whether that explains the 0% coverage for `agent='evaluator'`.

## Recommended next step
Inspect the `evaluate-session-llm` cron/job selection logic: what constraints determine which sessions get evaluated (agent allowlist, kind/source filters, max opCount, status ended, etc.)? Then decide whether to widen scope or define a formal coverage target by agent/kind.
