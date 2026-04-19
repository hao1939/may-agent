# Evaluator heartbeat — 2026-03-29 02:35Z

## Calibration inputs
- `agents/evaluator/workspace/consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl`: all present and currently empty (wc showed 0 lines for each).

## Signal quality spot-check (recent evaluations)
Read two recent evaluation artifacts:
- `.state/evaluations/task_tree_s_1774348439374_46_optimizer.json`: flags cluster around **instruction noncompliance** (missing required artifact), **environment path error** (`/Users/...`), and **unverified strong claims** (evidence hierarchy).
- `.state/evaluations/task_tree_s_1774346652855_41.json`: highlights hard **procedural noncompliance** (skipped mandated gym runs), **path assumption** (`/var/tmp/...`), and an explicit **FM-3.3 verification failure** (no read-back after bash append).

## Periodic task (most overdue/lightweight)
Ran `node agents/evaluator/skills/monitor-session.cjs --running`.
- Result: 40 checked, 2 healthy, 38 unhealthy.
- Notable anomalies beyond the noisy long-idle `STALL`s:
  - `NO_LOG`: `s_1774413778093_1` (session dir exists but `session.jsonl` missing).
  - Active `PROTOCOL_VIOLATION`: `s_1774751628860_854` (scout) flagged for P114 Experience Replay missing.

## Notes / possible follow-ups
- Monitor output is dominated by extremely-old `STALL` sessions; consider de-prioritizing/auto-archiving stale stalls so active violations (`PROTOCOL_VIOLATION`) and structural log issues (`NO_LOG`) stand out.
- If infra hygiene has an owner: investigate why `s_1774413778093_1` has a missing `session.jsonl` despite a session directory existing.
