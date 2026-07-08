# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count`

- Alert id: `2934`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `aks-explorer`

## Judgment

This alert was real at triage time. The authoritative runtime metric row, the live metric sampler, and the supported blocked-contract repair dry run all agreed that blocked holders in the live runtime tree were still missing observer metadata. Because the owner had a supported safe repair path (`repair-blocked-contracts`) and that repair immediately cleared the missing-observer count from `9` to `0`, the correct final operation is `fix_root_cause`.

## Evidence checked

### 1. Persisted metric row was actively breaching

```sql
SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Observed row at triage:

- `current = 9`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `project = aks-rp-e2e`
- `status = active`
- `updated_at = 1783414312882`
- `alert_op = >`

### 2. Open alert row matched the live breach

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

Observed row:

- `id = 2934`
- `resolved_at = NULL`
- message reports `current=9`

### 3. Live sampler confirmed the breach before repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783414427595, "value": 9 }
```

### 4. Supported repair dry run identified exact offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 9,
  "repaired": [
    "wait-spec-node-confidential-vm-run-28672036322-artifact-visibility-20260707b",
    "wait-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-20260707f",
    "wait-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-visibility-20260707f",
    "wait-spec-rp-cluster-lifecycle-new-vnet-run-28592745619-artifact-visibility-20260707b",
    "wait-spec-secops-fips-extension-blocked-run-28618650515-artifact-visibility-20260707b",
    "wait-spec-secops-fips-windows-run-28621344506-artifact-visibility-20260707b",
    "wait-spec-traffic-azure-service-mesh-egress-gateway-run-28530680362-frontier-20260707b",
    "wait-spec-traffic-azure-service-mesh-ingress-internal-run-28587847781-frontier-20260707b",
    "wait-spec-traffic-azure-service-mesh-multi-revision-run-28530684426-frontier-20260707b"
  ]
}
```

### 5. Safe repair was applied

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 9,
  "repaired": [
    "wait-spec-node-confidential-vm-run-28672036322-artifact-visibility-20260707b",
    "wait-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-20260707f",
    "wait-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-visibility-20260707f",
    "wait-spec-rp-cluster-lifecycle-new-vnet-run-28592745619-artifact-visibility-20260707b",
    "wait-spec-secops-fips-extension-blocked-run-28618650515-artifact-visibility-20260707b",
    "wait-spec-secops-fips-windows-run-28621344506-artifact-visibility-20260707b",
    "wait-spec-traffic-azure-service-mesh-egress-gateway-run-28530680362-frontier-20260707b",
    "wait-spec-traffic-azure-service-mesh-ingress-internal-run-28587847781-frontier-20260707b",
    "wait-spec-traffic-azure-service-mesh-multi-revision-run-28530684426-frontier-20260707b"
  ]
}
```

### 6. Repaired tasks now carry observer metadata in the runtime tree

Example repaired task `wait-spec-traffic-azure-service-mesh-egress-gateway-run-28530680362-frontier-20260707b` now includes these blocked-contract fields:

- `blocker.waiting_for`
- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`
- `blocker.fallback_at`
- `blocker.fallback_action`
- `trace.blocked_contract_repaired_at`

## Conclusion

`fix_root_cause` is the correct final operation because the metric breach was real, the missing observer metadata existed on live blocked holders, and the owner safely repaired the exact offending blocked contracts in the runtime task tree.

## Next validation

Validate on the next metric sample / metrics snapshot for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when a fresh sample returns `0` and alert `2934` resolves automatically.
