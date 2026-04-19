# Evaluator calibration note — 2026-03-24T12:34Z

## Observations
- Heartbeat calibration inputs expected by `agents/evaluator/heartbeat.md` are still missing in this checkout:
  - `agents/evaluator/workspace/consistency-flags.jsonl` (ENOENT)
  - `agents/evaluator/workspace/human-reviews.jsonl` (ENOENT)
  - `agents/evaluator/workspace/re-evaluations.jsonl` (ENOENT)
  This blocks sections (3) Calibration in the heartbeat from being meaningfully executed.

- Periodic task completed: **Monitor Active Sessions (L2 Kinetic Defense)**
  - Ran: `node agents/evaluator/skills/monitor-session.cjs --running`
  - Result: `sessionsChecked=7`, `healthy=7`, `unhealthy=0`.
  - Notable: May’s running session had `recentErrors=2` but still classified HEALTHY by the monitor (suggests monitor weights recency/volume rather than failing on a small number of errors).

## Actionable follow-ups
1. Infra: ensure the three calibration JSONL feeds are generated (or adjust heartbeat to tolerate their absence by pointing to the correct source path).
2. Monitoring: consider whether the HEALTHY threshold should downgrade to WARNING when `recentErrors>=2` within window, to surface early tool failures.
