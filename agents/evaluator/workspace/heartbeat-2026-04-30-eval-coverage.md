# Evaluator heartbeat — 2026-04-30 (eval coverage)

## Evaluation pipeline liveness (DB is canonical)
- `evaluations.maxCreatedAt` = **2026-04-30T12:55:12Z** (ms=1777553712409)
- Most recent evaluation rows: **2026-04-30T13:24:11Z**, **2026-04-30T13:20:21Z**
- `sessions.count` = **2943**, `evaluations.count` = **1309** → **coverage ≈ 0.445**

## Legacy artifact path drift
- `.state/evaluations/` newest files are **Apr 29**; `task_tree_*` artifacts newest are **Mar 24**.
- Interpretation: evaluation DB is fresh while legacy JSON outputs are stale → output-path drift, not pipeline failure.

## Missing evaluations (done sessions without eval)
Top missing-by-agent:
- evaluator: **913** missing
- optimizer: **465** missing
- coach: **428** missing

## Hypotheses / risks
- Coverage gap may be intentional (scope filters by kind/source/cost) but scope is not explicit enough in docs.
- Org doc `agents/may/designs/process-registry.md` says `evaluate-session-llm` cron is disabled; nevertheless evaluations are still being written recently → active evaluation likely occurs via a different path (handler-driven), and docs may be outdated.

## Recommended next steps
1. Locate the active job/handler that populates the `evaluations` table and document it as the primary liveness source.
2. Decide whether target scope is “all done sessions” vs “subset”; if the former, open a task to widen coverage.
3. Stop using `.state/evaluations/` mtimes as a liveness proxy; DB recency should be primary.
