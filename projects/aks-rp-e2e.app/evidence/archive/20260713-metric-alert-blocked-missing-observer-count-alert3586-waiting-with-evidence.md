# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3586`

- Date: `2026-07-13`
- Final operation: `waiting_with_evidence`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3586`
- Persisted alert message at triage start: `AKS RP E2E blocked tasks missing observer is above threshold: current=2, threshold=0, target=0`

## Judgment

This open alert is currently **persisted stale state awaiting the next metrics refresh, not a live blocked-contract defect that still needs repair**.

At triage time, the runtime DB still showed `current=2` and the latest persisted snapshot named exactly two offender task ids:

- `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized`
- `ops/wait-project-approval-owner-return-primary-blocker-20260713`

But a fresh authoritative recompute already returned `value=0`, the supported blocked-contract repair dry run returned `repairedCount=0`, and direct task readback showed that both named waits already carry the observer fields this metric enforces:

- `blocker.observed_by`
- `blocker.observation_method`

That means there is no remaining current repair for me to apply safely in this session. The truthful final operation is `waiting_with_evidence`: durable evidence now records that the live task tree is healthy and the remaining discrepancy is just the lagging persisted metric / alert lifecycle awaiting the next safe runtime metrics refresh.

## Evidence

### 1. Persisted runtime state still shows the breach

Runtime DB reads at triage time showed:

- metric row: `current=2`, `threshold=0`, `target=0`, `priority=P0`, `updated_at=1783987862267`
- open alert row: `id=3586`, `resolved_at=null`, `message=AKS RP E2E blocked tasks missing observer is above threshold: current=2, threshold=0, target=0`
- latest persisted snapshot: `value=2`, `sample_size=2`, `measured_at=1783987862267`, `note={"offenderTaskIds":["ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized","ops/wait-project-approval-owner-return-primary-blocker-20260713"]}`

The immediately previous persisted snapshot was healthy at `value=0`, so this is a fresh persisted discrepancy rather than a long-running drift trend.

### 2. Fresh live recompute already says the current value is `0`

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Output:

```json
{"measuredAt":1783988113320,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

So the controller-authoritative task tree is already healthy for this metric.

### 3. Supported repair path has nothing left to fix

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Output excerpt:

```json
{
  "dryRun": true,
  "repairedCount": 0,
  "repaired": []
}
```

So there is no current blocked wait missing observer metadata for the supported repair path to change.

### 4. Both persisted offender tasks now show complete observer metadata

Current readback for `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized` shows:

```json
"observed_by": {
  "workflow": "project-planner",
  "trigger": "project.approval.submitted"
},
"observation_method": "Planner/app-ops handles a matching returned project.approval.submitted event or reviewed same-lineage helper/result evidence for this exact shared approval-return lineage; if no decision arrives, the scheduled family review surface is the governing project-level wait ops/wait-project-approval-owner-return-primary-blocker-20260713."
```

Current readback for `ops/wait-project-approval-owner-return-primary-blocker-20260713` shows:

```json
"observed_by": {
  "workflow": "project-planner",
  "trigger": "project.approval.submitted"
},
"observation_method": "Planner/app-ops handles a matching returned project.approval.submitted event for one of the governed focus/shared-auth lineages or reviewed same-lineage evidence that truthfully replaces this family carrier."
```

The project-level wait also records:

- `trace.blocked_contract_repaired_at = 2026-07-13T22:29:51.459Z`
- `trace.blocked_wait_refreshed_at = 2026-07-13T23:23:33.852Z`

So the concrete blocked-contract normalization already landed in runtime state before this triage concluded.

## Why this is `waiting_with_evidence`

- **Not `fix_root_cause`**: there is no live blocked-contract defect left to repair; live recompute is already `0` and repair dry run is a no-op.
- **Not `resolve_stale`**: this session has no safe runtime write path for manually resolving alert `3586` or rewriting the persisted metric row.
- **Not `calibrate_metric`**: the metric is still correctly measuring blocked waits missing observer metadata.
- **Not `upgrade_or_escalate`**: no destructive action or human policy decision is required; the discrepancy should clear on the normal metrics refresh path.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle. Recovery is confirmed when the persisted `metrics.current` value for `aks-rp-e2e.process.blocked.missing-observer-count` updates from `2` to `0` and alert `3586` resolves automatically.
