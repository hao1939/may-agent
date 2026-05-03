# Evaluator heartbeat — 2026-05-03

## Checks

### Session evaluation pipeline freshness (DB is canonical)
- `evaluations.max(createdAt)` = **1777844437518** (recent)
- `sessions (last 24h)` = **1769**
- `evaluations (last 24h)` = **106**
- Coverage(last 24h) = **106/1769 = 0.0599**

Evidence: see bun:sqlite queries in heartbeat transcript.

### Legacy artifact directory
- `.state/evaluations/` newest items visible in tail include **Apr 29** and older; many are **Mar 24**.
- This suggests **DB evaluations are up-to-date, but legacy filesystem artifacts are not** (output path drift / older job behavior).

## Assessment
- Process #5 (Session Eval): **DB fresh** ✅. However, **coverage is low (~6%)** relative to sessions volume; likely the eval cron is sampling or scoped.
- `.state/evaluations/` directory appears **non-canonical / stale-ish**; should not be used as primary health signal.

## Follow-ups to consider (not executed in this heartbeat)
1. Find how `evaluate-session-llm` selects sessions (sampling? only certain agents/kinds?) and decide whether to widen scope.
2. Update docs/criteria to clarify that DB is canonical, `.state/evaluations/` is legacy.
