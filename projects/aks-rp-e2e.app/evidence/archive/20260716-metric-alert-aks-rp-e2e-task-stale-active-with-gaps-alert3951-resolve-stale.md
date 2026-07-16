# Metric alert triage — resolve_stale — aks-rp-e2e.task.stale-active-with-gaps

- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Alert id: `3951`
- Chosen operation: `resolve_stale`
- Triage time: `2026-07-16T13:49Z`

## Why this alert is stale now

The open alert row still reflects the earlier breaching sample (`current = 1`, `resolved_at = null`), but fresh owner-side sampling during this triage no longer reproduces the breach:

- `bun run metrics:sample aks-rp-e2e.task.stale-active-with-gaps --json` → `{"value":0,...}`
- `bun run metrics:sample aks-rp-e2e.task.stale-active-count --json` → `{"value":0,...}`
- `bun run metrics:sample aks-rp-e2e.task.no-work-with-gaps --json` → `{"value":0,...}`

That means the stale-active prerequisite is currently gone, so the alert row is lagging behind current runtime truth.

## Evidence checked

### 1. Open alert row is still present

`metric_alerts` still shows alert `3951` for `aks-rp-e2e.task.stale-active-with-gaps` with `resolved_at = null`.

### 2. Fresh task-tree state is healthy for this metric

`bun run task-tree summary` now shows:

- `counts.active = 6`
- `frontier.active` contains six live active leaves
- `counts.backlog = 0`
- `counts.review = 5`

So the project is not idle behind a stale active placeholder.

### 3. Active leaves have live worker sessions

Fresh `sessions` reads show the six active task-worker leaves each have matching running `aks-explorer` sessions with recent `lastActivityAt` values, including:

- `align-storage-csi-direct-vitest-live-request-contract-domain-followup`
- `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle`
- `domain/normalize-scenario-planned-maintenance-configuration-crud-lifecycle-20260716`
- `domain/reclassify-node-ephemeral-explicit-resourcedisk-public-create-contract-20260716`
- `domain/reconcile-rp-cluster-lifecycle-preflight-validation-pass-model-mapping-20260716`
- `domain/review-private-cluster-private-endpoint-connections-lifecycle-ado-run-172514841-20260716`

This matches the fresh metric sample result of `stale-active-count = 0`.

## Decision

Choose `resolve_stale` because the measurement is currently back in range and the remaining open alert row represents earlier breaching state, not a present stale-active incident.

This triage does **not** claim the runtime alert row was manually resolved from this session. The durable change from this session is this evidence note proving the alert is stale at triage time, so the next runtime metrics/alert cycle can recover it truthfully.

## Next validation

Accept the next `metrics-snapshot` / alert-recovery cycle as the validator. If the current healthy state holds, `aks-rp-e2e.task.stale-active-with-gaps` should remain `0` and alert `3951` should recover automatically on the next snapshot.
