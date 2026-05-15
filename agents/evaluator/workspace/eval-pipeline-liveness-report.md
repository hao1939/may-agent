# Evaluator heartbeat — evaluation pipeline liveness

## Signals checked

### DB (canonical): `.state/may.db`
- `evaluations.max(createdAt)` = **2026-04-16T14:32:21.389Z** (string timestamp)
- Sessions started in last 6h: **888**
- Evaluations created in last 6h: **257**

Evidence: bash output in heartbeat (python/sqlite queries).

### Legacy artifacts: `.state/evaluations/`
- Directory last entries show newest file mtime **Apr 20 11:24**; most task_tree/eval jsons are **Mar 24**.

This appears consistent with prior note: DB may still receive writes even if `.state/evaluations/` task_tree artifacts are stale (output-path drift / legacy artifact generation disabled).

## Key finding
The pipeline is **not fully dormant** (257 eval rows in last 6h), but **coverage is partial** relative to session volume (257/888 ≈ 29%). Additionally, most recent `verdict='skipped'` rows are all for `agent='evaluator'`, suggesting the cron is intentionally skipping evaluator sessions and/or a filter is overly broad.

## Recommended actions (delegate to owner of cron / tech lead)
1. Confirm what drives `verdict='skipped'` and `skippedByJs` flags for evaluator sessions.
2. Determine intended evaluation coverage ratio (sample vs full) and whether 29% is expected.
3. If `.state/evaluations/` artifacts are still expected, trace why they stopped updating after Apr 20 / Mar 24.
