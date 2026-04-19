# Calibration note — 2026-03-27T14:33Z

## Workspace calibration
- Confirmed `agents/evaluator/workspace/archive/2026-03/` contains the expected calibration artifacts and the canonical empty calibration inputs:
  - `consistency-flags.jsonl` (0 bytes)
  - `human-reviews.jsonl` (0 bytes)
  - `re-evaluations.jsonl` (0 bytes)
  Evidence: `ls -la agents/evaluator/workspace/archive/2026-03/` output in this heartbeat.
- Current workspace root only has `journal.md` (10 bytes) among the expected calibration inputs; `consistency-flags.jsonl` etc. are not present at root.

## Periodic tasks spot-check
- Reviewed `agents/evaluator/periodic-tasks.md` for last-run stamps: last monitor-session run recorded as 2026-03-26 16:33; strategy extraction last run 2026-03-13.

## Monitor-session health signal
- Ran `node agents/evaluator/skills/monitor-session.cjs --running`:
  - sessionsChecked: 39, healthy: 2, unhealthy: 37
  - Most unhealthy are `STALL` with idle times in the thousands of minutes (likely historical sessions still counted as “running”).
  - One `NO_LOG`: `s_1774413778093_1` (session directory exists, missing session.jsonl).
  Evidence: tool output shows these counts and sample entries.

## Implications / follow-ups
1) Consider tightening `--running` definition or adding an age cutoff so ancient sessions don’t dominate the signal.
2) Investigate `NO_LOG` cause: creation race, cleanup bug, or path mismatch.
