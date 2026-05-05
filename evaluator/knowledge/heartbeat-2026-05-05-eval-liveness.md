# Heartbeat — 2026-05-05 — Eval liveness + coverage snapshot

## Pipeline liveness (DB is canonical)

Query (readonly bun:sqlite):
- `evaluations.MAX(createdAt)` = **1777940199976**
- `sessions.MAX(startedAt)` = **1777942211910**

So the evaluation writer is **active**.

Legacy artifact dir:
- `.state/evaluations/` newest mtime observed: **Mar 24** (tail -5), i.e. still stale relative to DB.

## Coverage snapshot (last 24h)

- `sessions (startedAt in last 24h)` = **1304**
- `evaluations (createdAt in last 24h)` = **53**
- coverage ratio = **0.0406**

Sessions by agent (last 24h):
- evaluator: 996
- optimizer: 55
- tech-lead: 54
- bob: 48
- may: 48

Evaluations by agent (last 24h):
- bob: 12
- may: 9
- amy: 8
- coach: 7
- arc: 5
- optimizer: 5
- tech-lead: 5

## Interpretation

- Liveness looks good.
- Coverage is low in absolute terms, but the session stream is dominated by `agent='evaluator'` (996/1304). It is plausible many of these are intentionally non-evaluated (self-evaluation avoidance / loop prevention), so the naive ratio is probably not a meaningful health metric.

## Next

- Find the JS/cron selection predicate for session evaluation and document which categories are intentionally excluded (agent=evaluator, kind=job, source=standalone-eval, etc.).
- Then define a coverage metric that excludes intentionally skipped classes.
