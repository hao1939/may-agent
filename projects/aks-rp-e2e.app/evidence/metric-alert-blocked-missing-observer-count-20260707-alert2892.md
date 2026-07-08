# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2892`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T06:41:00Z`
- Chosen operation: `fix_root_cause`

## Judgment

This alert was real at triage time. The runtime task tree used by the supported metric sampler still contained blocked leaf holders missing the observer contract required by the blocked-wait process metric. The supported repair path (`repair-blocked-contracts`) found two such holders and backfilled the missing blocked-contract fields. Because the owner could safely apply that repair directly, the correct operation is `fix_root_cause`.

## Evidence checked

### 1. The official metric sampler still showed an active breach

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed before repair:

```json
{ "measuredAt": 1783405785098, "value": 2 }
```

### 2. The supported repair tool identified the exact offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 2,
  "repaired": [
    "hold-spec-traffic-applink-cross-cluster-and-register-frontier-20260707",
    "hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707"
  ]
}
```

### 3. The safe repair was applied

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 2,
  "repaired": [
    "hold-spec-traffic-applink-cross-cluster-and-register-frontier-20260707",
    "hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707"
  ]
}
```

### 4. The runtime tree now contains the required observer fields on repaired blocked holders

After repair, the runtime tree entries for the repaired holders include the required blocked-contract fields:

- `waiting_for`
- `observed_by`
- `observation_method`
- `next_check_at`
- `fallback_at`
- `fallback_action`
- `trace.blocked_contract_repaired_at`

### 5. The metric should validate on the next sample cycle

The next validation step is another metric sample / metrics snapshot for `aks-rp-e2e.process.blocked.missing-observer-count`. If the repair holds, the value should return to `0`.
