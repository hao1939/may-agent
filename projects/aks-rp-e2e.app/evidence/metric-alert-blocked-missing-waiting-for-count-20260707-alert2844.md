# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count

- Alert id: `2844`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the controller-authoritative runtime task tree, and the safe owner repair path existed. A live audit of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` found three blocked leaf tasks missing `blocker.waiting_for`. Running the supported blocked-contract repair command added the missing wait-target contract, and a fresh runtime audit plus metric recomputation returned the count to `0`.

## Evidence checked

### Live metric before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Alert context reported current value `3`.

### Exact offenders from the runtime tree before repair

A direct runtime-tree audit found these blocked leaves without `blocker.waiting_for`:

- `hold-compact-aad-rbac-mixed-frontier-20260707c`
- `hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707g`
- `hold-compact-serverless-promotion-frontier-20260707d`

Each blocker already had `condition`, `category`, `owner`, and `resume_condition`, but no `waiting_for` object.

### Safe repair path applied

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed result:

```json
{
  "dryRun": false,
  "repairedCount": 4,
  "repaired": [
    "hold-compact-aad-rbac-mixed-frontier-20260707c",
    "hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707g",
    "hold-compact-serverless-promotion-frontier-20260707d",
    "hold-spec-bootstrap-profile-byo-acr-timeout-frontier-20260707b"
  ]
}
```

The three alert offenders were repaired, and the same supported repair also normalized one newly-added blocked frontier (`hold-spec-bootstrap-profile-byo-acr-timeout-frontier-20260707b`) before it could remain in breach.

### Validation after repair

A fresh runtime-tree audit using the same blocked-waiting-for logic as `scripts/project-metrics.ts` found no remaining offenders:

```json
{ "count": 0 }
```

The metric source then recomputed to target value `0`:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json --verbose
```

Observed result after repair:

```json
{ "measuredAt": 1783391060783, "value": 0 }
```

## Conclusion

`fix_root_cause` is the correct operation because the alert came from live blocked tasks missing the required wait-target contract, the supported runtime repair command added that contract, and the metric source now recomputes to `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`. If the sample stays `0`, alert `2844` should recover automatically.
