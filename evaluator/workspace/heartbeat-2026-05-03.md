# Evaluator heartbeat — 2026-05-03

## Checks performed

### Session evaluation pipeline recency (DB is canonical)
- `evaluations.max(createdAt)` = **1777801594760**
- `sessions.max(startedAt)` = **1777803594913**
- Observed lag ≈ **2000s (~33m)**
- Last 24h: **69** evaluations vs **1729** sessions
- Last 1h: **2** evaluations vs **68** sessions

Evidence: see bash outputs in this session:
- maxEval/maxSess/lag: `{ maxEval: 1777801594760, maxSess: 1777803594913, ... }`
- last-hour counts: `{c:2}` evals vs `{c:68}` sessions

### Legacy artifact path (.state/evaluations)
- Recent `s_*.json` files exist (Apr 29)
- `task_tree_*.json` artifacts appear stale (Mar 24)

Evidence: `ls -la .state/evaluations | tail -10`.

## Assessment
- The evaluation pipeline is running, but **coverage is low** relative to session volume.
- The ~33m lag suggests the cron is not completely dead; the low eval/session ratio suggests **narrow scope, throttling, or backlog**.
- `.state/evaluations/` task_tree staleness is consistent with known chronic issue; DB is fresher and should be treated as source of truth.

## Next actions proposed
1. Inspect `evaluate-session-llm` cron schedule + filters (which kinds/sources it evaluates).
2. If intended: widen scope or increase throughput (or clarify as sampling).
3. If unintended: open an issue to restore expected coverage and/or expose it as an explicit metric.
