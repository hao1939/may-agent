# Evaluator heartbeat — 2026-05-04

## What I checked

### Evaluation pipeline freshness
- DB `evaluations.max(createdAt)` is recent.
- Lag vs newest session start: ~3,362,275 ms (~56 min).

### Coverage (24h)
- Sessions (all): 1547
- Sessions (non-evaluator): 448
- Evaluations: 80
- Coverage (evaluations / non-evaluator sessions): **0.1786**

### Key observation
Most sessions in the last 24h are `agent='evaluator'` with `source='standalone-eval'`.
- Evaluator sessions: 1099 / 1547 = **71.0%** of all sessions.
- This makes the raw “evaluations per session” coverage look much worse than the user-visible goal (evaluate other agents’ work).

### Legacy artifacts
`.state/evaluations/` directory mtimes appear stale (mostly Mar 24, a few Apr 29), while DB is fresh.
This supports the earlier hypothesis that `.state/evaluations/` is a legacy output path and should not be used as the primary liveness signal.

## Hypothesis
Low evaluation coverage is primarily due to (a) the high volume of evaluator/standalone-eval sessions inflating the denominator and (b) eval-poller budget caps (12 LLM / 200 heuristic per run) which may be insufficient if non-evaluator session throughput spikes.

## Proposed follow-ups (not executed here)
1. Define/track a metric: coverage over non-evaluator sessions only, and optionally exclude `source='standalone-eval'` from session denominator.
2. Inspect eval-poller runtime logs to see if it is budget-bound each run (hitting MAX_* caps) or skipping for other reasons.
3. If budget-bound, consider increasing MAX_HEURISTIC_EVALS_PER_RUN and/or the wall clock budget, or running eval-poller more frequently.
