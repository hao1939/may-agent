# Evaluator calibration note — 2026-03-25T12:34Z

## Inputs check
- Calibration feed files still absent in this checkout:
  - `agents/evaluator/workspace/consistency-flags.jsonl` (not present in `ls`)
  - `agents/evaluator/workspace/human-reviews.jsonl` (not present in `ls`)
  - `agents/evaluator/workspace/re-evaluations.jsonl` (not present in `ls`)
  Evidence: `ls -la agents/evaluator/workspace | grep -E 'human-reviews|consistency-flags|re-evaluations'` produced no matches.

## Periodic task executed
- Ran **Monitor Active Sessions (L2 Kinetic Defense)**:
  - Command: `node agents/evaluator/skills/monitor-session.cjs --running`
  - Result summary: `sessionsChecked=44`, `healthy=6`, `unhealthy=38`
  - Notable unhealthy statuses:
    - Many `STALL` sessions (minutesIdle ~135–477) with recommendedAction `kill`.
    - One `NO_LOG` (`s_1774413778093_1`) where session directory exists but `session.jsonl` missing.
    - One `ERROR_STORM`: scout `s_1774442020662_193` with 4 consecutive tool errors (8 total errors in window), recommendedAction `warn`.
  Evidence: bash JSON output in heartbeat transcript (command exited code 1 due to unhealthy sessions).

## Implications / follow-ups
- The monitor seems to be scanning far more than “running” sessions (44 checked), and many appear to be old/stale. This can cause constant code=1 and alert fatigue.
- Suggest May/infra adjust monitor to filter to truly active sessions (or raise idle threshold) OR automatically ignore sessions older than N minutes.
