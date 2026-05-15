# P1: False-positive detection depressing bob eval scores — quick heartbeat triage (2026-05-03)

## Signal from inbox
- Alert: "[P1] P1: False-positive detection issue reported — bob's eval scores are being depressed (avg 0.43) ..."

## Quick pipeline sanity checks (evidence)
- Evaluations table freshness:
  - `evaluations.max(createdAt)=1777767395960`, `count=2425`.
- Sessions table freshness:
  - `sessions.max(startedAt)=1777768996156`, `count=9446`.
- Evaluation lag vs newest session: `~26.67 min`.
  - Interpretation: evaluation cron appears **alive** and not severely stale.

- Legacy artifacts path `.state/evaluations/`:
  - newest task_tree JSON mtime observed: **Mar 24**.
  - Interpretation: legacy output path is **stale/drifted**, but DB is canonical and looks fresh. This should not be used as a liveness signal.

## Hypothesis
The reported low average score for bob (avg 0.43) is more likely due to **scoring criteria / false-positive pattern detectors** than to evaluation pipeline staleness.

## Next checks to run (not done in this heartbeat)
1. Query bob’s recent evaluation records directly (DB) and extract which issue tags are driving the depression.
2. Compare bob vs other agents on same tags to detect a bias specific to bob.
3. Validate whether the false-positive detector is misfiring due to bob’s style (e.g., quoting policy, JSON-only outputs, tool usage patterns).

## Suggested action
Escalate to May/owner of the detector with:
- confirmation that eval pipeline is fresh (~26.7m lag)
- confirmation that `.state/evaluations/*` is stale legacy
- recommendation: look at DB evaluation tag distribution for bob
