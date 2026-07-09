# Metric alert triage — `aks-rp-e2e.process.blocked.overdue-unworked-count` (alert 3210)

- Date: 2026-07-09
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3210`
- Owner: `app-ops`

## Judgment

This alert is stale in runtime alert lifecycle state, not a live overdue-unworked breach now.

The alert opened from a real sample that named two blocked waits, but current task-tree state now shows both waits refreshed with exact blocked contracts and an explicit recovery task, and a fresh direct recompute of the metric returns `0` offenders.

## Evidence checked

### 1) Open alert row still exists

Current open alert row:

- `id = 3210`
- `resolved_at = null`
- `message = AKS RP E2E overdue blocked waits without active work is above threshold: current=2, threshold=0, target=0`

### 2) Alert-opening snapshot named two offenders

Latest stored snapshot before this judgment:

```json
{"value":2,"sample_size":2,"measured_at":1783555434632,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"wait-spec-cluster-autoscaler-mincount-recovery-rerun-171364167-return-20260708\",\"verify-spec-storage-csi-disk-v2-driver-enable-run-171380483-20260708\"]}"}
```

### 3) Both offender waits now carry refreshed blocked stewardship

Current task readback for `wait-spec-cluster-autoscaler-mincount-recovery-rerun-171364167-return-20260708` shows:

- `state = blocked`
- `blocker.owner = ado`
- `blocker.next_check_at = 2026-07-09T02:30:00Z`
- `blocker.fallback_at = 2026-07-09T04:30:00Z`
- `blocker.waiting_for.runId = 171364167`
- blocker condition explicitly says planner created active recovery task `recover-overdue-ado-rerun-returns-storage-csi-diskv2-and-camincount-20260709`

Current task readback for `verify-spec-storage-csi-disk-v2-driver-enable-run-171380483-20260708` shows:

- `state = blocked`
- `blocker.owner = ado`
- `blocker.next_check_at = 2026-07-09T02:30:00Z`
- `blocker.fallback_at = 2026-07-09T04:30:00Z`
- `blocker.waiting_for.runId = 171380483`
- blocker condition explicitly says planner created the same active recovery task `recover-overdue-ado-rerun-returns-storage-csi-diskv2-and-camincount-20260709`

### 4) The exact recovery task now exists and is already in review

Current task readback for `recover-overdue-ado-rerun-returns-storage-csi-diskv2-and-camincount-20260709` shows:

- `state = review`
- `owner = aks-explorer`
- result summary says both overdue Azure DevOps runs were reviewed end-to-end and the stale blocked waits should be replaced with reviewed-pass state

### 5) Fresh recompute now returns zero offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && APP_DIR=/app/projects/aks-rp-e2e.app PROJECT_DIR=/app/projects/aks-rp-e2e bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.overdue-unworked-count --json
```

Observed result:

```json
{"measuredAt":1783555848535,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `resolve_stale`

- The current authoritative metric source of truth is back in range.
- The alert-opening offenders are no longer unworked: both now point at an exact active recovery branch that has already progressed to review.
- The remaining inconsistency is the still-open `metric_alerts` row and stale `metrics.current`, which should converge on the next safe metrics/alert lifecycle refresh.
- This environment does not provide a safe runtime write path to set `resolved_at` directly, so the correct owner action here is to record the stale-state judgment with concrete evidence rather than mutate runtime DB state unsafely.

## Next validation

On the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.blocked.overdue-unworked-count`, expect:

- recomputed `value = 0`
- `offenderTaskIds = []`
- alert `3210` to recover automatically
