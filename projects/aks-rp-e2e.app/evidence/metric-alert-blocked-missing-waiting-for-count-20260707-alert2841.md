# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count

- Alert id: `2841`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the controller-authoritative runtime task tree, and the safe owner repair path existed. The supported blocked-contract repair command found exactly eight blocked leaf tasks missing `blocker.waiting_for` in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` and repaired them.

## Evidence checked

### Live metric before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{"measuredAt":1783390408723,"value":8}
```

### Exact offenders from the runtime tree

Runtime-tree audit before repair found these eight blocked leaves without `blocker.waiting_for`:

- `hold-compact-aad-rbac-mixed-frontier-20260707b`
- `hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707f`
- `hold-compact-serverless-promotion-frontier-20260707b`
- `hold-compact-secops-identity-pair-workflow-secret-frontier-20260707`
- `hold-spec-localdns-hosts-plugin-create-http400-frontier-20260707b`
- `hold-spec-private-cluster-public-second-hop-artifact-visibility-frontier-20260707b`
- `hold-spec-remediator-node-not-ready-restart-runtime-nonpass-frontier-20260707c`
- `hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707c`

Each blocker already had `condition`, `category`, `owner`, and `resume_condition`, but no `waiting_for` object.

### Safe repair path

Dry-run first:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount: 8`
- repaired tasks: the eight ids listed above

Apply the same supported repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

- `repairedCount: 8`
- repaired tasks: the same eight ids

### Validation after repair

The repaired blockers now carry explicit `waiting_for`, `observed_by`, `observation_method`, `next_check_at`, `fallback_at`, and `fallback_action` fields. A fresh runtime-tree audit found no remaining blocked leaves missing `waiting_for`.

```json
{"count":0,"offenders":[]}
```

The metric source then recomputed to target value `0`:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result after repair:

```json
{"measuredAt":1783390452978,"value":0}
```

## Conclusion

`fix_root_cause` is the correct operation because the alert came from live blocked tasks missing the required wait-target contract, the supported runtime repair command added that contract, and the metric source now recomputes to `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`. If the sample stays `0`, alert `2841` should recover automatically.
