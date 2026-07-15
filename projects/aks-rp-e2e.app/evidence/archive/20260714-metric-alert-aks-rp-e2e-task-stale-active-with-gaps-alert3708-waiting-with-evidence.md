# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.stale-active-with-gaps`

Date: 2026-07-14T18:58Z  
Alert id: `3708`  
Metric id: `aks-rp-e2e.task.stale-active-with-gaps`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row and open alert still show a breach (`current=1`), but a fresh direct recompute from the registered metric source already returns `0`, the related unowned-work sampler reports `staleActiveTaskIds: []`, and the current frontier shows live active work rather than a stale active slot. I also emitted a safe `trigger.metrics-snapshot` refresh event, but the persisted row had not updated during this session's verification window, so the truthful action is to record the mismatch and wait for the next normal metrics-snapshot / alert recovery cycle.

## Evidence checked

### Persisted runtime row is still breaching

Runtime metric row for `aks-rp-e2e.task.stale-active-with-gaps` still shows:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784055149102`

Open alert row still shows:

- `metric_alerts.id = 3708`
- `resolved_at = null`
- `created_at = 1784055215442`

Recent persisted snapshots confirm the last recorded breach was a single spike after a long zero run:

- `1784055149102 -> 1`
- `1784054849057 -> 0`
- `1784054549098 -> 0`
- `1784054249073 -> 0`
- `1784053948997 -> 0`

### Live metric source already computes healthy

Fresh recompute from the metric source command path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
# => {"measuredAt":1784055240999,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

The metric implementation remains:

```ts
!tasks.projectClosed && tasks.activeStale > 0 && openGaps > 0 ? 1 : 0
```

So the source-of-truth sampler no longer sees a stale active task while gaps remain.

### Related process signals agree there is no current stale active task

Fresh unowned-work sample:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
# => value=0, note.staleActiveTaskIds=[]
```

Current frontier sample:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts frontier
# => active: [
#      "domain/reconcile-trusted-access-ta-gateway-overdue-family-20260714",
#      "ops/escalate-shared-jwt-authenticator-egress-surface-owner-return-20260714",
#      "ops/followup-row37-managed-aad-owner-return-20260714"
#    ]
```

That frontier proves the project is not idle, and the companion unowned-work signal proves there is no currently detected stale active task id behind the alert.

### Safe refresh attempt made during triage

I emitted a safe refresh event:

```bash
cd /app && may-agent --emit trigger.metrics-snapshot '{}'
# => Event emitted: trigger.metrics-snapshot
```

But the runtime metric row and alert were unchanged during follow-up verification, so this session cannot honestly claim the alert has already recovered.

## Why this is waiting_with_evidence

- The live sampler for the exact metric now returns `0`.
- The related sampler reports `staleActiveTaskIds: []`.
- The open alert row still says `current=1` / unresolved.
- A safe refresh trigger was emitted, but the row had not yet converged during this session.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle.

Expected recovery condition:

- persisted `metrics.current` for `aks-rp-e2e.task.stale-active-with-gaps` moves from `1` to `0`, and
- alert `3708` resolves automatically.

If the next persisted snapshot still reports `1` while the direct source command continues to return `0`, re-triage this as a metric-state-sync defect rather than as a live stale-active task breach.
