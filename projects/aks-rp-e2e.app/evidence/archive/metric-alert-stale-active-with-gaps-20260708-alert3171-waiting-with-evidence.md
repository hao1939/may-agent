# Metric alert triage — `waiting_with_evidence` — `aks-rp-e2e.task.stale-active-with-gaps`

- Alert id: `3171`
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Triage time: `2026-07-08T02:41:10Z`
- Chosen operation: `waiting_with_evidence`

## Current runtime facts

The persisted runtime metric still shows a breach:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `metrics.updated_at = 1783528520281`

Recent persisted snapshots show a one-sample spike:

- `1783528520281 => 1`
- previous nine snapshots immediately before that were all `0`

The open alert row is therefore still active, but the current task/tree and live sessions no longer match a stale-active condition.

## Fresh recompute and frontier evidence

Fresh local recompute from the app metric implementation returns the metric to in-range:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.task.stale-active-with-gaps --json
{"measuredAt":1783528683613,"value":0}
```

Current frontier evidence also shows healthy active ownership instead of dead active residue:

- `bun run task-tree summary` reports `counts.active = 3`
- `bun run task-tree frontier` shows the active leaves are:
  - `repair-fleet-hubless-rpapi-lifecycle-expectation-carrier-reconciliation-20260708`
  - `repair-spec-storage-csi-blob-verify-nfs-consumer-identity-proof-20260708`
  - `retry-bootstrap-profile-byo-acr-timeout-empty-turn-20260708`
- runtime `sessions` rows for those active task sessions are all present with `status = running` and recent `lastActivityAt` values

The metric source logic still defines the breach only as:

```ts
!tasks.projectClosed && tasks.activeStale > 0 && openGaps > 0 ? 1 : 0
```

With the current active leaves all backed by running worker sessions, the persisted `1` is best explained as measurement timing lag rather than a current stuck frontier.

## Judgment

Choose `waiting_with_evidence`.

This is not a safe `resolve_stale` because this workflow has no runtime write path for `metric_alerts`, and it is not `fix_root_cause` because there is no current stale-active leaf to repair. The concrete action taken here is a durable accepted evidence note documenting that the alert is waiting on the next normal validator.

## Next validation

Accept the next runtime `metrics-snapshot` / persisted metric sample as validator.

Expected outcome:

- metric `aks-rp-e2e.task.stale-active-with-gaps` persists from stored `1` to `0`
- alert `3171` recovers automatically through the normal runtime closure path

If the next persisted sample still reports `1`, re-open judgment as a real app/process regression or measurement bug.