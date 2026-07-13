# Metric alert triage: `aks-rp-e2e.process.blocked.missing-owner-count` alert 3453

## Decision

Chosen operation: `resolve_stale`

## Why

The alert began as a transient persisted breach:

- metric `aks-rp-e2e.process.blocked.missing-owner-count`
- prior persisted snapshot at `1783814762620`: `value=1`
- prior snapshot note: `{"offenderTaskIds":["hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706"]}`
- open alert `3453` created at `1783814768174`

During triage, the owner-side metric source command recomputed the live task-tree state back to in-range:

```json
{"measuredAt":1783815041601,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

The cited stale offender task id was already gone from the live task tree:

```text
$ bun run task-tree show hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706
Task not found: hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706
```

A later persisted metric refresh then confirmed recovery in the runtime DB:

- `metrics.current = 0`
- `metrics.updated_at = 1783815068682`
- latest snapshot at `1783815068682`: `value=0`, `note={"offenderTaskIds":[]}`
- alert `3453` now has `resolved_at = 1783815074080`

## Judgment

This alert was a transient/stale lifecycle artifact, not a still-live blocked-holder contract defect. The authoritative metric and snapshot stream now show `0`, and the open alert has already auto-resolved through the normal metrics lifecycle. That makes `resolve_stale` the correct final operation.

## Next validation

- On the next `metrics-snapshot`, expect `aks-rp-e2e.process.blocked.missing-owner-count` to remain `0` with `offenderTaskIds=[]`.
- If the metric rises above `0` again, treat the new offender task id as a new process defect rather than reusing alert `3453`.
