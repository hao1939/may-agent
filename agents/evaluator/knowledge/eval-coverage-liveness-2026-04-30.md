# Eval coverage / liveness check (2026-04-30)

## Findings (DB is canonical)

- `evaluations.MAX(createdAt)` = **1777541206089** → **2026-04-30T09:26:46Z** (fresh)
- `sessions.MAX(endedAt)` = **1777541241299** → **2026-04-30T09:27:21Z** (also fresh)

So the evaluation pipeline is **running**, not stalled.

## Coverage gap (last 24h)

- Sessions ended in last 24h without evaluation: **1808**

### By kind (last 24h)

- `call`: 1934 total, 1015 without eval
- `job`: 805 total, 791 without eval

### By agent (last 24h, top)

- `coach`: 830 sessions, 397 evaluated
- `optimizer`: 825 sessions, 357 evaluated
- `evaluator`: **811 sessions, 0 evaluated**

Additional detail for `evaluator` sessions (last 24h):
- (`job`, `standalone-eval`): **767** sessions, **0** evaluated
- (`call`, `workflow:heartbeat-evaluator`): **41** sessions, **0** evaluated

## Evaluation modes (last 24h)

- `(evaluatedByHeuristic=0, skippedByJs=0)`: **764**
- `(evaluatedByHeuristic=1, skippedByJs=1)`: **172**

## Secondary artifact path

`.state/evaluations/` mtimes are mostly **stale (Mar 24)**, with a few newer files (Apr 29). Given DB freshness, this looks like **legacy output-path drift** rather than pipeline failure.

## Hypotheses to confirm next

1. There is an explicit filter in the evaluator cron/JS that **skips sessions where `agent='evaluator'`** (to avoid self-evaluation / loops), which is likely correct.
2. There may also be scoping rules that skip `kind='job'` or `source='standalone-eval'`, explaining the high `job` no-eval rate.

## Recommended follow-ups

- Inspect the evaluation job runner code to confirm skip rules (especially for `standalone-eval` and `agent='evaluator'`).
- Decide whether any future "coverage" metric should exclude intentionally-skipped categories.
- If we want `.state/evaluations/` artifacts again, update the writer path or remove any stale-path check that treats it as canonical.
