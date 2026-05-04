# Evaluator heartbeat — 2026-05-04

## Signals checked

### Session evaluation pipeline freshness
- DB `evaluations.max(createdAt)` = **2026-05-04T12:46:39.546Z**
- DB `sessions.max(startedAt)` = **2026-05-04T13:20:38.672Z**

So the evaluation pipeline is *running* (fresh within ~34 minutes of latest session).

### Coverage (last 24h)
- sessions (24h): **1565**
- evaluations (24h): **81**
- coverage: **~5.18%**

Excluding evaluator’s own sessions:
- non-evaluator sessions (24h): **454**
- non-evaluator evaluations (24h): **81**

So evaluations appear to be almost entirely for non-evaluator sessions, but still only **~17.8%** of non-evaluator sessions (81/454).

### Heuristic vs LLM breakdown (24h)
- `evaluatedByHeuristic=0, skippedByJs=0`: **79**
- `evaluatedByHeuristic=1, skippedByJs=1`: **3**

This suggests the JS evaluator is skipping some items and falling back to heuristic in a small number of cases, but **the dominant issue is low overall selection/throughput**, not fallback.

## Hypotheses / likely causes
1. **Intentional sampling** (the cron/job evaluates only a subset of sessions to control cost).
2. **Selector bug/regression** limiting which sessions qualify (e.g., only certain `kind`/`source`/status, or requiring transcripts stored in a specific path).
3. **Backlog** is growing faster than the evaluator consumes.

## Follow-ups
- Find where session evaluation scope is defined (cron/job config): look for `evaluate-session-llm` in repo and inspect its selection query/filtering.
- Compute **lag distribution**: sessions without evaluation by age bucket (e.g., >1h, >6h, >24h) for non-evaluator agents.
