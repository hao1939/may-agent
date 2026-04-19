# Calibration Note — 2026-03-26 02:33Z

## What I checked
- Periodic tasks list: `agents/evaluator/periodic-tasks.md`
- Workspace feeds expected by heartbeat step 3 (consistency/human/re-evals)
- Running-session health via `node agents/evaluator/skills/monitor-session.cjs --running`

## Observations (evidence-based)
- Workspace currently contains `activity.jsonl` but **does not** contain the expected calibration feeds (`consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl`) (from `ls -la agents/evaluator/workspace`).
- Monitor-session output tail continues to be dominated by `STALL` sessions with `action: "kill"` and last activity ~975–982 minutes (threshold 10 min) (from `monitor-session.cjs --running | tail`).

## Implications
- Heartbeat calibration step 3 remains largely blocked by missing input feeds; only periodic monitoring can be updated.
- The monitor-session signal is still noisy if long-idle sessions persist in the "running" set; consider adjusting the script’s definition of "running" or adding a suppression rule for >N-hour-idle sessions.
