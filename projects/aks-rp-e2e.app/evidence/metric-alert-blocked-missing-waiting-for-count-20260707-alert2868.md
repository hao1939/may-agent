# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count

- Alert id: `2868`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T04:48:30Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the controller-authoritative runtime task tree, and the safe owner repair path existed. A live metric sample returned value `2`, and the supported blocked-contract repair command found two blocked leaf tasks missing `blocker.waiting_for`. Applying that supported repair normalized the blocked wait-target contract and a fresh metric recomputation returned the count to `0`.

## Evidence checked

### Live metric before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783399680092, "value": 2 }
```

### Exact offenders from the runtime tree before repair

Dry-run of the supported repair command identified these blocked leaves as missing `blocker.waiting_for`:

- `hold-spec-traffic-applink-source-authority-and-superseded-alias-frontier-20260707`
- `hold-spec-rp-nodepool-lifecycle-rollback-reviewed-no-history-frontier-20260707`

### Safe repair path applied

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 2,
  "unchangedCount": 81,
  "repaired": [
    "hold-spec-traffic-applink-source-authority-and-superseded-alias-frontier-20260707",
    "hold-spec-rp-nodepool-lifecycle-rollback-reviewed-no-history-frontier-20260707"
  ]
}
```

### Validation after repair

A fresh metric recomputation returned the target value `0`:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json --verbose
```

Observed result after repair:

```json
{ "measuredAt": 1783399697633, "value": 0 }
```

## Conclusion

`fix_root_cause` is the correct operation because the alert came from live blocked tasks missing the required wait-target contract, the supported runtime repair command added that contract, and the metric source now recomputes to `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`. If the sample stays `0`, alert `2868` should recover automatically.
