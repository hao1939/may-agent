# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3263`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triaged at: `2026-07-09T09:23Z`
- Owner: `app-ops`
- Operation: `waiting_with_evidence`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row is breaching (`current=1`) but the owner-side metric source command now recomputes the metric to `0`. In this triage environment I only have read-only runtime DB access, so I cannot safely resolve the alert row or rewrite the metric state directly. The concrete owner action is to record the contradiction and wait for the next runtime `metrics-snapshot` / alert-recovery pass.

## Evidence checked

### 1. Persisted metric row still says breach

`metrics` row at triage time:

- `id = aks-rp-e2e.task.no-work-with-gaps`
- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783588755581`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps`

Open alert row:

- `id = 3263`
- `alert_type = consecutive_failures`
- `resolved_at = null`
- message: `AKS RP E2E no executable work while verification gaps remain is above threshold: current=1, threshold=0, target=0`

### 2. Owner-side metric source now recomputes `0`

Direct source command from the metric definition:

```json
{"measuredAt":1783589004934,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 3. Metric definition says the alert should clear when runnable or healthy active work exists

From `scripts/project-metrics.ts`, `aks-rp-e2e.task.no-work-with-gaps` returns `1` only when all of these are true:

- project is not closed
- `tasks.runnable === 0`
- `healthyActive === 0`
- `openGaps > 0`

So the recomputed `value=0` means the current task tree no longer satisfies the no-work condition.

### 4. Project execution is active now

Recent `sessions` rows for project `aks-rp-e2e` show active work in progress during this triage window, including:

- running planner session `s_project_planner_planning_update_20260709092204_jz9yy2`
- running worker session `s_task_ops-repair-compact-exact-holder-owner-backfill-20260709`
- running worker session `s_task_ops-refresh-shared-westus2-managed-cluster-capacity-family-20260709`

Recent `events` rows also show fresh assignments and review handoff activity immediately before the source metric recomputed to `0`.

## Why not another operation?

- Not `fix_root_cause`: there is no current project starvation to fix; the owner-side metric already computes `0`.
- Not `resolve_stale`: manual alert resolution would require a safe runtime write path that this session does not have.
- Not `calibrate_metric`: the metric contract is still correct; the problem is stale persisted state versus live recomputation.
- Not `upgrade_or_escalate`: this is not a destructive or human-policy issue yet.

## Expected validation

Wait for the next `metrics-snapshot` / alert-recovery pass. If runtime state catches up, the metric row should move from `current=1` to `current=0` and alert `3263` should recover naturally. If the persisted row stays at `1` after the next snapshot while the source command still returns `0`, re-triage as a metric state-sync defect rather than a real no-work-with-gaps breach.
