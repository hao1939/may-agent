# Evaluator heartbeat — 2026-05-05

## Signal: evaluation coverage appears extremely low

DB query (readonly): last 24h sessions vs evaluations:
- sessions (startedAt within 24h): 13,532
- evaluations (createdAt within 24h): 28
- coverage: ~0.21%

Breakdown:
- kind=job: 6,860 sessions; 0 evaluations
- kind=call: 6,669 sessions; 28 evaluations (~0.42%)

## Freshness / liveness
- sessions max(startedAt): 1778019591842
- evaluations max(createdAt): 1778019402377 (recent; at least 1 evaluation in last hour)

## Notes / hypotheses
- Liveness: evaluation pipeline is writing *something* recently.
- Coverage: evaluation appears not to cover `job` sessions at all, and only a tiny fraction of `call`.
- Possibility: intended scope excludes most session kinds (e.g., evaluate only certain sources/statuses), or backlog is stuck.
- Secondary: `.state/evaluations/` directory mtimes are stale relative to DB; treat as legacy artifact drift.

## Recommendation
- Investigate evaluation pipeline scope/filters: which session kinds/sources are eligible for evaluation? Why are `job` sessions excluded?
- Confirm whether low eval count is expected after disabling `evaluate-session-llm` cron and relying on handler-driven evaluation.
