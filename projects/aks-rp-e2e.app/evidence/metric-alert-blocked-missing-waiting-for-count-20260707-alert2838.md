# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count

- Alert id: `2838`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the controller-authoritative runtime task tree, and the safe owner repair path existed. The supported blocked-contract repair command found exactly six blocked leaf tasks missing `blocker.waiting_for` in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` and repaired them.

## Evidence checked

### Live metric before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783389224796, "value": 6 }
```

### Exact offenders from the runtime tree

Runtime-tree audit before repair found these six blocked leaves without `blocker.waiting_for`:

- `wait-compact-serverless-promotion-frontier-20260707`
- `wait-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707`
- `wait-spec-bootstrap-profile-byo-acr-timeout-frontier-20260707`
- `wait-compact-aad-rbac-mixed-frontier-20260707`
- `wait-spec-fleet-hubless-managed-cluster-quota-headroom-frontier-20260707`
- `wait-spec-kms-v2-trust-service-node-subnet-http409-frontier-20260707`

Each blocker already had `condition`, `category`, `owner`, and `resume_condition`, but no `waiting_for` object.

### Safe repair path

Dry-run first:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount: 6`
- repaired tasks: the six ids listed above

Apply the same supported repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

- `repairedCount: 6`
- repaired tasks: the same six ids

### Validation after repair

A fresh runtime-tree audit using the same blocked-waiting-for logic as `scripts/project-metrics.ts` found no remaining offenders:

```json
{ "count": 0, "offenders": [] }
```

The metric source then recomputed to target value `0`:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result after repair:

```json
{ "measuredAt": 1783389237372, "value": 0 }
```

## Conclusion

`fix_root_cause` is the correct operation because the alert came from live blocked tasks missing the required wait-target contract, the supported runtime repair command added that contract, and the metric source now recomputes to `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`. If the sample stays `0`, alert `2838` should recover automatically.
