# Metric alert triage — resolve_stale — `aks-rp-e2e.process.unowned-work-count`

- Alert id: `3495`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-13T01:19:00Z`
- Chosen operation: `resolve_stale`

## Current facts

1. The open metric row still shows a breach (`current=1`, `threshold=0`, `priority=P0`), but the latest breaching snapshot attributes it to exactly one stale-active contributor:
   - task `domain/prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713`
   - session `s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713`
   - restart reason `session-no-activity`
2. The cited stale session is no longer stale. Runtime `sessions` now shows:
   - `status=done`
   - `endedAt=1783905532114`
   - `lastActivityAt=1783905532114`
3. The same task now has a fresh owned retry session:
   - `s_task_domain_prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713_retry_20260713011607`
   - `agent=aks-explorer`
   - `status=running`
   - `lastActivityAt=1783905487105`
4. Because the only breaching contributor is already closed and replaced by a live retry owner, the alert row reflects a transient sampling window rather than current unowned unfinished work.

## Judgment

This alert is stale. The metric snapshot caught the original task between `session-no-activity` recovery and the replacement worker becoming the live owner. By triage time, the old session had already ended `done` and a fresh `aks-explorer` retry session was active for the same task.

The correct operation is `resolve_stale`: the alert should be cleared by the next normal metrics recompute/recovery cycle, not by routing new repair work.

## Next validation

Use the next `metrics-snapshot` for `aks-rp-e2e.process.unowned-work-count`. It should drop back to `0` once the snapshot stops counting the completed stale session and sees the current retry as the active owner.
