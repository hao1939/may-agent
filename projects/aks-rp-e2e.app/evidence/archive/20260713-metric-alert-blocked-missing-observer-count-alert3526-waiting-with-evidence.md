# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3526`

- Judged at: `2026-07-13T10:18:00Z`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3526`
- Chosen operation: `waiting_with_evidence`

## Judgment

This alert is currently waiting on the normal metric refresh / alert recovery cycle, not on a new blocked-wait repair.

The persisted metric row and open alert still reflect the latest breaching snapshot at `2026-07-13T10:15:29.415Z`, which named exactly one offender:

- `hold-compact-fleet-reviewed-exception-split-frontier-20260709`

However, the current live task-tree state already shows that holder has a complete observer contract again:

- `blocker.observed_by.workflow = project-planner`
- `blocker.observation_method` is present
- `blocker.next_check_at = 2026-07-13T20:00:00Z`
- `trace.blocked_contract_repaired_at = 2026-07-13T10:16:12.662Z`

That repair timestamp is later than the breaching persisted sample, which explains why the alert is stale relative to current live truth.

## Evidence checked

### 1. Persisted metric row still shows the breach

`metrics` row for `aks-rp-e2e.process.blocked.missing-observer-count`:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783937729415` (`2026-07-13T10:15:29.415Z`)

### 2. Open alert `3526` is still unresolved

`metric_alerts` row:

- `id = 3526`
- `resolved_at = null`
- `created_at = 1783937734410` (`2026-07-13T10:15:34.410Z`)

### 3. Latest persisted snapshots oscillate around the same single Fleet holder

Newest snapshots include:

- `1258452` → value `1`, offender `hold-compact-fleet-reviewed-exception-split-frontier-20260709`
- `1258350` → value `0`
- `1258248` → value `1`, same offender
- `1257733` → value `0`
- `1257631` → value `1`, same offender

This is the same transient Fleet holder contract shape seen in earlier samples.

### 4. Live task-tree now shows the holder repaired

Supported live command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-compact-fleet-reviewed-exception-split-frontier-20260709
```

Current output includes:

```json
"observed_by": {
  "workflow": "project-planner",
  "schedule": "blocked-frontier-app-ops-review",
  "trigger": "project.planning.requested"
},
"observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
"next_check_at": "2026-07-13T20:00:00Z"
```

and:

```json
"blocked_contract_repaired_at": "2026-07-13T10:16:12.662Z"
```

### 5. Fresh live metric sample is healthy now

Supported live metric command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783937862273,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

That is the current controller-visible live sample, and it shows no offenders.

## Why `waiting_with_evidence`

I do not have a safe runtime write path in this session to resolve `metric_alerts` manually, and the live metric sample is already healthy. The correct next process move is therefore to wait for the next persisted metrics snapshot / alert recovery cycle to reconcile the runtime tables, rather than inventing a new repair task or manually mutating the DB.

## Next validation

Watch the next `metrics-snapshot` cycle for:

- `metrics.current = 0` on `aks-rp-e2e.process.blocked.missing-observer-count`, and
- automatic alert recovery / resolution for alert `3526`.
