# Evaluator heartbeat — 2026-04-30

## Checks performed

### Process #5 Session Eval — DB recency
- sessions max(startedAt): 1777590252436 (2026-04-30 23:04:12Z)
- evaluations max(createdAt): 1777589934923 (2026-04-30 22:58:54Z)
Evidence: bash query outputs in this session.

### Legacy artifacts (.state/evaluations) recency
- Directory shows last-modified entries mostly around 2026-03-24, with a few JSONs on 2026-04-29.
Interpretation: DB is fresh; `.state/evaluations/` is not the canonical freshness signal and appears partially stale / drifting.

## Coverage probe (not a configured metric, but a liveness signal)
- sessions last 7d: 3345
- evaluations last 7d: 1517
- approx eval coverage ratio: 0.454
- evaluator sessions last 7d without eval: 1155 (i.e., 0 of evaluator sessions have evaluations)

## Hypotheses
1. evaluate-session-llm cron may be scoped to exclude agent='evaluator' (self-eval avoidance), which is expected.
2. The overall 45% coverage suggests eval job is either sampling, rate-limited, or failing intermittently.

## Recommended next actions
- Confirm intended sampling policy for evaluations (target %). If target is >45%, inspect eval cron logs / scheduling.
- If excluding evaluator sessions is intentional, document it explicitly in evaluator criteria so coverage probes don’t trigger false alarms.
