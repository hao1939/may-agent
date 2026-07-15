# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3660`

- Date: 2026-07-14
- Owner: `app-ops`
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3660`

## Why this is the right operation

The breach was real when sampled: the persisted metric row and latest snapshots named two offenders, and a fresh live recompute before repair still found one live offender, `ops/wait-project-approval-owner-return-primary-blocker-20260713`.

That remaining offender was safe for app-ops to repair locally through the supported task-tree blocked-contract repair path. I ran the repair, which rewrote the blocked task with `waiting_for`, `observed_by`, and `observation_method`, and a follow-up live metric recompute immediately returned `value=0` with no offender task ids.

Because the root cause was a missing blocked observer contract on a live task that app-ops owns and can repair safely, the correct final operation is `fix_root_cause`.

## Evidence checked

### 1) Persisted metric row was still breaching at triage time

`query_db`:

```sql
SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Returned:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784029181244`

### 2) Latest persisted snapshots named the concrete offenders

`query_db` latest `metric_snapshots` rows returned:

- `1784029181244` → `value=2`, offenders `ops/wait-project-approval-owner-return-primary-blocker-20260713`, `focus-terminal-frontier-finality-reconciliation-20260714`
- `1784028873690` → `value=2`, same two offenders
- `1784028822834` → `value=2`, same two offenders
- earlier snapshots at `1784028392094` and `1784028067992` were already `value=0`

So this was a fresh regression, not a long-standing accepted exception.

### 3) Fresh live recompute before repair still found one real offender

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Returned before repair:

```json
{"measuredAt":1784029694479,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"ops/wait-project-approval-owner-return-primary-blocker-20260713\"]}"}
```

This proved the issue was still live and narrowed the fix target to one exact task.

### 4) The remaining offender was missing observer metadata before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show ops/wait-project-approval-owner-return-primary-blocker-20260713
```

Before repair, the shown `blocker` had:

- `condition`, `resume_condition`, `next_check_at`, `fallback_at`, and `fallback_action`
- but **no** `observed_by`
- and **no** `observation_method`

That matches the metric definition exactly.

### 5) Supported repair path fixed the live root cause

Dry run first:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Returned:

- `repairedCount = 1`
- `repaired = ["ops/wait-project-approval-owner-return-primary-blocker-20260713"]`

Applied repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Returned:

- `repairedCount = 1`
- `repaired = ["ops/wait-project-approval-owner-return-primary-blocker-20260713"]`

### 6) Post-repair task state now includes observer/check metadata

Post-repair `task-tree show` now includes:

- `blocker.waiting_for = { "type": "blocker.resolved", "taskId": "ops/wait-project-approval-owner-return-primary-blocker-20260713" }`
- `blocker.observed_by = { "workflow": "project-planner", "schedule": "blocked-frontier-app-ops-review", "trigger": "project.planning.requested" }`
- non-empty `blocker.observation_method`
- `trace.blocked_contract_repaired_at = 2026-07-14T11:48:37.729Z`

### 7) Post-repair live recompute is healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Returned after repair:

```json
{"measuredAt":1784029722748,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 8) Follow-up dry run confirms nothing remains repairable in this metric family

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Returned:

- `repairedCount = 0`
- `repaired = []`
- `unchangedCount = 122`

## Judgment

Choose **`fix_root_cause`**.

Why not the other final operations:

- Not `waiting_with_evidence`: the breach was still live when sampled, and app-ops could safely fix it.
- Not `resolve_stale`: the alert row may still lag, but the correct first action was to repair the remaining live offender.
- Not `calibrate_metric`: the metric correctly detected a real blocked-contract regression.
- Not `downgrade_priority`: a real P0 process-integrity breach existed on a live blocked task.
- Not `upgrade_or_escalate`: no destructive or human-only action was required.
- Not `document_exception`: this was not an accepted breach.

## Next validation

Watch the next `metrics-snapshot` / alert refresh cycle for
`aks-rp-e2e.process.blocked.missing-observer-count`.

Recovery is confirmed when:

1. the persisted `metrics.current` row updates from `2` to `0` (or at least non-breaching), and
2. alert `3660` resolves automatically from the normal metric recovery path.
