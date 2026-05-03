# Evaluator heartbeat — 2026-05-03

## Checks run

### DB recency (pipeline liveness)
- evaluations MAX(createdAt)=`1777842798959` → `2026-05-03T21:13:18.959Z`
- sessions MAX(startedAt)=`1777845008307` → `2026-05-03T21:50:08.307Z`
- Lag: `2209348ms` (~36.8 minutes)

Evidence: bun:sqlite query in this session transcript (`lag_ms` computed from `sessions.startedAt - evaluations.createdAt`).

### Coverage sample (last 24h)
- sessions (all agents): 1790
- evaluations: 101
- raw coverage: 5.64%

Exclude meta agents (evaluator/judge):
- sessions: 642
- evaluations: 102
- coverage: 15.89%
- unevaluated sessions (non-meta): 540

Most unevaluated by agent (non-meta): optimizer 124, amy 95, coach 78, tech-lead 53, scout 41, may 40, arc 38, dev 36, bob 35.

### Legacy artifact path
- `.state/evaluations/*task_tree*` newest mtime observed: 2026-03-24
- DB is writing new evaluations (today), so treat `.state/evaluations/` as legacy output-path drift, not eval pipeline outage.

## Note
The `sessions` table does **not** have `createdAt`; it uses `startedAt`/`endedAt`. Queries against `sessions.createdAt` fail with `SQLiteError: no such column: createdAt`.

## Hypothesis
Low evaluation coverage is likely due to the eval-poller budget gates:
- `MAX_LLM_EVALS_PER_RUN = 12` every 30min → 576/day max LLM evals
- heuristic evals cap 200/run (9600/day) but only applies when `msgCount` is very small.
- Many real sessions have msgCount > heuristic thresholds, so they queue behind the LLM cap.

Also, eval-poller skips `agent=evaluator` entirely, which is fine, but evaluator-generated call/job sessions dominate raw session count (1148/1790 last 24h), making the naive coverage metric misleading.

## Recommendation
1) Add a dedicated metric: `evaluation.coverage-non-meta-24h` and `evaluation.backlog-non-meta-24h` (sessions without evaluation) so we stop mixing in evaluator meta traffic.
2) Consider increasing `MAX_LLM_EVALS_PER_RUN` (or shortening interval) OR introducing a cheap mid-tier heuristic that can score non-trivial sessions without full LLM.
3) If `.state/evaluations/` is still relied on by any consumer, either revive writes there or remove the consumer.
