# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3564`

- Date: `2026-07-13`
- Final operation: `waiting_with_evidence`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3564`
- Persisted alert message at triage start: `AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

## Judgment

This open alert is currently **persisted stale state, not a live repairable blocked-holder defect**.

At triage time, the runtime `metrics` row still showed `current=1` and alert `3564` remained open, but the current live recompute already returned `0`, the safe repair dry run returned `repairedCount=0`, and the exact offender named in the last persisted snapshot now carries a complete observer contract in the runtime task tree.

That means there is no exact blocked observer-contract mutation left for me to apply safely in this session. The truthful final operation is `waiting_with_evidence`: durable evidence now records that live authoritative recomputation is healthy and the remaining discrepancy is the lagging persisted metric/alert lifecycle awaiting the next safe runtime metrics refresh.

## Evidence

### 1. Persisted runtime state is still breaching

Runtime DB reads at triage time showed:

- metric row: `current=1`, `threshold=0`, `target=0`, `priority=P0`, `updated_at=1783963991040`
- open alert row: `id=3564`, `resolved_at=null`, `message=AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`
- latest persisted snapshot: `value=1`, `sample_size=1`, `measured_at=1783963991040`, `note={"offenderTaskIds":["hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b"]}`

The immediately previous persisted snapshot was already healthy at `value=0`, confirming this is an isolated fresh breach in persisted state rather than a long-standing trend.

### 2. Fresh live recompute says the current value is already `0`

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Output:

```json
{"measuredAt":1783964204127,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 3. Supported repair path has nothing left to fix

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Output excerpt:

```json
{
  "dryRun": true,
  "repairedCount": 0,
  "repaired": []
}
```

So there is no remaining blocked holder missing observer metadata in the controller-authoritative runtime task tree.

### 4. The exact offending holder now shows full observer metadata

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b
```

Relevant current `blocker` excerpt:

```json
{
  "waiting_for": {
    "type": "blocker.resolved",
    "taskId": "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  "next_check_at": "2026-07-14T18:00:00Z",
  "resume_condition": "Resume only when the same lineage gains materially new lower-level evidence: a concrete async-op error payload for 8e0e36d1-3ed3-4073-b7a1-d8f887417990, node-RG child-resource / VMSS / node-bootstrap proof from MC_rg-plan-001-0335-69ezcw-903180_aks-plan-001-0335-69ezcw-903180_westus2 that identifies the first failing surface, a bounded code/execution change that materially alters this same create path, or a newer same-spec artifact bundle that moves the first failing surface or succeeds.",
  "fallback_at": "2026-07-15T18:00:00Z",
  "fallback_action": "If no materially new same-lineage evidence appears by fallback, keep one exact bootstrap-profile runtime holder refreshed to the current evidence ceiling; do not spawn another same-lineage diagnosis or reopen an unchanged rerun."
}
```

The same task also records:

- `trace.blocked_contract_repaired_at = 2026-07-13T17:34:42.158Z`
- `trace.blocked_wait_refreshed_at = 2026-07-13T17:35:28.640Z`

So the concrete root-cause repair already landed in runtime state before this triage concluded.

## Why this is `waiting_with_evidence`

- **Not `fix_root_cause`**: there is no live blocked-holder observer defect left to repair; live recompute is already `0` and repair dry run is a no-op.
- **Not `calibrate_metric`**: the metric still correctly measures blocked tasks missing observer metadata.
- **Not `resolve_stale`**: this session has no safe runtime write path for manually resolving alert `3564` or rewriting the persisted metric row.
- **Not `upgrade_or_escalate`**: no destructive action or human policy decision is required; the remaining discrepancy should clear on the normal metrics refresh path.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle. Recovery is confirmed when the persisted `metrics.current` value for `aks-rp-e2e.process.blocked.missing-observer-count` updates from `1` to `0` and alert `3564` resolves automatically.
