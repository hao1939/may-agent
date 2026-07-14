# Metric alert triage — `aks-rp-e2e.process.blocked.missing-fallback-count` — alert `3617`

- Date: 2026-07-14
- Owner: `app-ops`
- Final operation: `waiting_with_evidence`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Alert id: `3617`

## Why this is the right operation

The open alert still reflects a short-lived missing-fallback spike, but the live
runtime task tree has already moved past those three offending blocked leaves.
The current live tree no longer contains the exact task ids named in the alert
snapshot, and a fresh direct metric recompute against
`/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` now returns `value=0` with
no offenders.

That means there is no current live blocked-wait contract defect for app-ops to
repair safely in this session. Because this triage environment only provides
read-only database access, I cannot directly update `metrics.current` or resolve
alert row `3617` myself. The truthful final operation is therefore
`waiting_with_evidence`: record that the live source of truth has recovered and
wait for the next runtime `metrics-snapshot` / alert lifecycle refresh to clear
this stale alert.

## Evidence checked

### 1) The persisted metric row and open alert still show the old spike

`query_db` showed:

- `metrics.current = 3`
- `metrics.updated_at = 1784013234333`
- open `metric_alerts.id = 3617`
- alert message still says `current=3, threshold=0, target=0`

So the alert is still open in persisted runtime state.

### 2) The last offending snapshot named three exact task ids

Latest `metric_snapshots` row note:

```json
{"offenderTaskIds":["domain/checkpoint-feature-local-no-live-carrier-bundle-20260714","domain/isolate-shared-knowledge-map-regeneration-bundle-20260714","domain/materialize-rp-nodepool-row3-residual-holder-20260714"]}
```

Those are the exact leaves the stale alert was based on.

### 3) The live task tree no longer contains those three offender tasks

Commands:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show domain/checkpoint-feature-local-no-live-carrier-bundle-20260714
cd /app/projects/aks-rp-e2e.app && bun run task-tree show domain/isolate-shared-knowledge-map-regeneration-bundle-20260714
cd /app/projects/aks-rp-e2e.app && bun run task-tree show domain/materialize-rp-nodepool-row3-residual-holder-20260714
```

Observed result for each command:

- `Task not found: <task-id>`

So the exact blocker leaves from the alert snapshot are not present in the live
runtime tree anymore.

### 4) Current live task-tree summary shows the frontier has moved to approval-gated successors

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed result excerpt:

- `updated_at = 2026-07-14T07:16:18.640Z`
- `frontier.active = ["domain/map-vm-prerelease-mounted-source-coverage-to-live-tree-20260714", "ops/repair-focus-approval-warning-classification-20260714"]`
- blocked frontier includes the successor waits
  - `domain/checkpoint-feature-local-no-live-carrier-bundle-approval-gated-20260714`
  - `domain/isolate-shared-knowledge-map-regeneration-bundle-approval-gated-20260714`
  - `domain/materialize-rp-nodepool-row3-residual-holder-approval-gated-20260714`

This confirms the tree has already rolled forward from the offending leaves to
new blocked successors, not left the original malformed blockers in place.

### 5) Fresh live recompute of this exact metric is already healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-fallback-count --json
```

Observed result:

```json
{"measuredAt":1784013435984,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

So the current live measurement source of truth is already back in range.

### 6) Supported blocked-contract repair finds nothing left to fix

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result excerpt:

- `repairedCount = 0`
- `repaired = []`

There is no remaining auto-repairable missing-fallback contract breach in the
current live tree.

## Judgment

Choose **`waiting_with_evidence`**.

Why not the other final operations:

- Not `fix_root_cause`: there is no current live missing-fallback defect left to fix.
- Not `calibrate_metric`: the metric rule itself still correctly detected the earlier malformed wait state.
- Not `downgrade_priority`: this is stale alert lifecycle lag, not evidence that the policy should interrupt less aggressively.
- Not `upgrade_or_escalate`: no destructive action or human-only policy decision is required.
- Not `resolve_stale`: that would require a safe runtime write path to resolve alert `3617` directly, which this environment does not provide.
- Not `document_exception`: the breach is not an accepted ongoing exception.

## Next validation

Wait for the next `metrics-snapshot` / alert lifecycle refresh for
`aks-rp-e2e.process.blocked.missing-fallback-count`.

Recovery is confirmed when:

1. `metrics.current` updates from `3` to `0`, and
2. alert `3617` gains a non-null `resolved_at`.
