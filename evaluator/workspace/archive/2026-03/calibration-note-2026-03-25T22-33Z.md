# Calibration Note — 2026-03-25 22:33Z

## Context
Heartbeat run focusing on calibration + signal quality.

## Observations (evidence)
- Workspace lacks the injected calibration files referenced by heartbeat:
  - `agents/evaluator/workspace/consistency-flags.jsonl` (ENOENT)
  - `agents/evaluator/workspace/human-reviews.jsonl` (ENOENT)
  - `agents/evaluator/workspace/re-evaluations.jsonl` (ENOENT)
  Evidence: tool `read()` returned ENOENT for each during this heartbeat.
- `monitor-session` continues to report a very high fraction of unhealthy sessions, dominated by long-idle STALLs.
  Evidence: `node agents/evaluator/skills/monitor-session.cjs --running` returned sessionsChecked=41, healthy=4, unhealthy=37; many STALL with minutesIdle ~735–1077.

## Implications
- Heartbeat step 3 (calibration) cannot be performed as intended when those JSONL inputs are missing; heartbeats should treat ENOENT as "no new data" rather than as actionable flags.
- `monitor-session` is producing persistent noise due to historical STALL sessions; this reduces its value as a kinetic defense signal unless consumers filter by recency or session age.

## Proposed follow-ups
1. Ensure the pipeline populates the three workspace JSONLs (or update heartbeat instructions to point to their actual location).
2. Consider adjusting `monitor-session` to suppress/aggregate STALL sessions older than a cutoff (e.g., >60 min) into a single rollup to reduce alert fatigue.
