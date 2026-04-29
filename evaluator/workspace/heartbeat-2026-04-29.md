# Evaluator Heartbeat — 2026-04-29

## Checks performed (evidence)
- DB liveness: `evaluations.maxCreatedAt = 2026-04-29 18:09:32Z` (fresh)
- Coverage snapshot: `sessions.count=584`, `evaluations.count=71`
- Legacy artifacts: `.state/evaluations/*.json` has fresh entries (Apr 29) but `task_tree_*.json` files remain stale (Mar 20–24)

## Findings
1. **Evaluation pipeline is alive** (DB updated today).
2. **Coverage is low**: 71/584 ≈ **12%** overall.
3. Coverage is heavily skewed: coach/optimizer have many sessions but low evaluated rates (coach ~17%, optimizer ~8%).
4. **Evaluator self-sessions are never evaluated** (0 evals for evaluator across 88 sessions). This might be intentional exclusion; needs confirmation.
5. **Legacy output-path drift** persists: task_tree artifacts appear stale while DB + some JSON eval artifacts are fresh → likely a partially retired/stale component, not full pipeline failure.

## Hypotheses
- The eval cron likely samples a subset of sessions (maybe only certain agents/kinds/sources), leading to skew + low total coverage.
- Evaluator agent may be excluded by rule (avoid self-eval), which is fine but should be explicitly documented to prevent “coverage” confusion.

## Recommended actions / follow-ups
- Ask Tech Lead/Optimizer to confirm intended sampling rules and whether to raise coverage target.
- If the goal is broader coverage, update the cron selection query to:
  - prioritize newest un-evaluated sessions (by endedAt),
  - enforce per-agent fairness (round-robin), and
  - explicitly exclude evaluator sessions (if desired).
- Document that `.state/evaluations/task_tree_*.json` is legacy/stale so monitors don’t treat it as liveness.
