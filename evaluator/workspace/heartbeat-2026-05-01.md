# Evaluator heartbeat — 2026-05-01

## Checks performed

### Pipeline freshness (DB canonical)
From `.state/may.db` (readonly):
- `evaluations.max(createdAt)` = `1777647323107`
- `sessions.max(startedAt)` = `1777647411939`
- Last 7d counts: `evaluations=2040`, `sessions=6053`
- Sessions missing eval (last 7d, left join where `e.sessionId is null`) = `4256`

### Missing-eval breakdown (last 7d)
By `kind/source` (top):
- `job / standalone-eval`: 1477
- `call / workflow:worker`: 1010
- `call / workflow:orchestrator`: 758
- `job / null`: 695
- `call / workflow:heartbeat-evaluator`: 107

By `agent` (top):
- evaluator: 1590
- optimizer: 947
- coach: 866
- amy: 697

### Legacy artifact path
`.state/evaluations/` contains files with mtimes through Apr 29 / Apr 20; older task_tree artifacts still dated Mar 24.

## Interpretation
- DB timestamps indicate the evaluation pipeline is *running recently* (fresh max createdAt).
- Evaluation **coverage** is likely limited by intentional scoping / skip rules rather than a dead cron: 6053 sessions vs 2040 evals in 7 days (~34% coverage).
- A large share of missing-eval sessions are internal workflow calls and standalone-eval jobs (may be intentionally excluded to avoid evaluating evaluators / orchestration noise).

## Action recommended
- Decide/clarify policy: should we evaluate `workflow:*` calls and `standalone-eval` jobs?
  - If **no**, the “coverage” metric should explicitly exclude these categories, otherwise it will always look low.
  - If **yes**, update the evaluator job’s session filter to include these.

## Next step (if assigned)
- Open `agents/evaluator/knowledge/criteria.md` and document the intended evaluation scope and what is excluded from coverage.
