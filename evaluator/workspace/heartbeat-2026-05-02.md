# Evaluator heartbeat — 2026-05-02

## Process ownership checks

### Process #5 — Session Evaluation coverage (DB is canonical)

**24h volume**
- sessions (startedAt): **2594**
- sessions ended: **2593** (ended share **99.92%**)
- evaluations created: **211**
- ended-session coverage: **213/2593 = 8.21%**

**Breakdown clues**
- By `kind`:
  - call: 1523 sessions / 167 evals (10.96%)
  - job: 1071 sessions / 43 evals (4.01%)
- By `source`:
  - standalone-eval: **968 sessions / 0 evals**
  - workflow:orchestrator: 520 / 57
  - workflow:worker: 493 / 2
  - (null source): 103 / 43

**Recency / liveness**
- evaluations max(createdAt): **1777734760205** (~37 minutes behind now when checked)
- evaluations span: **~23.35h** between min/max in last 24h window
- evaluation type (last 24h): heuristic **58**, non-heuristic/LLM **152**

**Interpretation**
- Pipeline appears **alive** (evaluations written across the whole 24h window; max(createdAt) close to now).
- Overall coverage is **very low (~8%)**, and the single biggest driver is `source='standalone-eval'` sessions (≈37% of all sessions) which have **0% evaluation linkage**.
- This suggests at least one of:
  1) `standalone-eval` is deliberately excluded from evaluation (should be documented), or
  2) `standalone-eval` sessions are being created in a way that bypasses evaluation sync/handler.

### Process #15 — LLM evaluation status
- LLM evaluation appears **enabled** for some subset: 152/210 evaluations in last 24h are `evaluatedByHeuristic=0`.
- Legacy artifact path `.state/evaluations/` is stale (tail mtimes around 2026-03-24) and should not be used as a liveness signal.

## Proposed follow-up actions
1. Determine what produces `source='standalone-eval'` sessions and whether they *should* be evaluated. If yes, fix join/writer path so evaluations are inserted for those sessions.
2. If `standalone-eval` is expected to be excluded, update docs/criteria to clarify and adjust coverage expectations/metrics to exclude them.

## Evidence (tool outputs)
- Coverage calculation: bun sqlite query showed `evals: 211`, `sess: 2594`, coverage `0.0813`.
- Source breakdown: bun sqlite query showed `standalone-eval` 968 sessions, 0 evals.
- LLM vs heuristic split: bun sqlite query showed heuristic 58 vs llm 152.
