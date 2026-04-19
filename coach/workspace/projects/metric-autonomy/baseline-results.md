# Metric-Reaction Baseline Results

**Date**: 2026-04-18
**Scenario**: metric-reaction (agents/gym/scenarios/metric-reaction/)
**Agent**: coach
**Category**: metric-autonomy

## Results

| Metric | Value |
|--------|-------|
| Total trials | 21 |
| Passed | 21 |
| **Pass rate** | **100% (21/21)** |

## Verdict: CEILING

Per KE-010, this scenario hits ceiling at baseline — the coach agent always reacts to the stuck-requests metric when it's mentioned in the task prompt.

The success criteria checks if the agent takes any concrete action on the stuck-requests metric (reads the file, mentions it in bash commands, references it in finish summary, etc.). The coach's heartbeat flow naturally leads it to investigate environment files.

## Notes

- Earlier version of scenario files (from 6h ago, different task.md) scored 2/20 (10%). The key difference: the current task.md explicitly mentions `environment/stuck-requests.json`, which makes discovery trivial.
- The batch runner shows ERROR for all trials due to a JSON parsing issue in gym-batch.sh, but the actual runs all passed (verified via DB query).
- To make this scenario non-ceiling, the metric would need to be embedded less obviously (e.g., within a dashboard file the agent isn't directed to read).

## Next Steps

To create a non-ceiling variant:
1. Remove the "Environment Notice" from task.md — just use a plain heartbeat prompt
2. Embed the stuck-requests metric in a less obvious location (e.g., a metrics dashboard mixed with other normal metrics)
3. This would test whether the agent proactively discovers anomalous metrics without being told to look
