# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count (alert 3019)

- Time: 2026-07-07T13:13:10Z
- Chosen operation: `fix_root_cause`
- Metric current/threshold/target: `1 / 0 / 0`

## Finding

A direct scan of `projects/aks-rp-e2e.app/tasks/tree.json` found exactly one blocked task missing `blocker.waiting_for`:

- `wait-compact-machines-agentpool-run-28809049156-review-20260707`

The blocked task already had a concrete condition and resume condition for exact run review, but its blocker object omitted the machine-readable `waiting_for` field required by the metric.

## Change applied

Added this `blocker.waiting_for` payload to the task:

```json
{
  "type": "ado.pipeline.run.review-ready",
  "runId": "28809049156",
  "taskId": "wait-compact-machines-agentpool-run-28809049156-review-20260707"
}
```

## Validation

After the edit, a fresh scan over all blocked tasks in `tasks/tree.json` reported `missing_count 0`.

## Follow-up

The next metric snapshot should recompute `aks-rp-e2e.process.blocked.missing-waiting-for-count` to `0` if the task-tree-backed measurement is functioning normally.
