# Evaluator heartbeat — 2026-05-01

## Checks performed (evidence)

### Session-eval pipeline liveness
- DB recency check: `evaluations.max(createdAt)=1777645584258` vs `sessions.max(startedAt)=1777645600384` → **lag ~16,126 ms** (fresh; pipeline running).  
  Evidence: bun:sqlite query output.

### Legacy `.state/evaluations/` artifact freshness
- Directory listing shows most `task_tree_*.json` artifacts are **from 2026-03-24**, but a few `s_*.json` files are **from 2026-04-29**.
- Interpretation: **DB is canonical and fresh; `.state/evaluations/` is partially stale / drifting**, consistent with prior note that task_tree artifacts appear stale.

### Coverage snapshot (not a configured metric, but relevant to process #5)
- Sessions evaluated coverage: **1770 / 5863 = 0.3019**.
- Per-agent mismatch signals potential eval-scope skew:
  - `evaluator` has 1575 sessions but is not in evaluations top list (expected, as evaluator shouldn’t self-evaluate).
  - `optimizer` has 1406 sessions but only 573 evaluations (maxAt older than coach).

## Findings
1. **No liveness incident**: evaluation writes are current in DB (lag ~16s).
2. **Output-path drift / partial staleness**: `.state/evaluations/` task_tree artifacts look stuck at 2026-03-24 while DB continues to update.
3. **Low evaluation coverage (~30%)**: likely by design (scoped cron) but worth making explicit as a target metric and/or documenting intended sampling.

## Suggested follow-ups (for owner / tech lead)
- Decide whether `.state/evaluations/task_tree_*.json` is still an expected artifact. If yes, fix writer path/job; if no, update docs/alerts to stop treating it as canonical.
- Consider adding a real metric for evaluation coverage (sessions with evaluation / total sessions) with a target, or document why 30% is acceptable.
