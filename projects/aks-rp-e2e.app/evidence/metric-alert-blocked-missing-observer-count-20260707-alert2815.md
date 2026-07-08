# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2815`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T00:29:16Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the live runtime task tree, and the safe repair path was available to the owner. The runtime blocked-contract repair tool found and backfilled two blocked leaf holders that were missing observer metadata in `.state/tasks/tree.json`.

## Evidence checked

### Live metric state before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count
```

Observed value:

- `2`

### Safe repair path

Dry-run first showed exactly two blocked holders would be repaired:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount: 2`
- repaired tasks:
  - `hold-spec-deployment-safeguards-vpa-interop-publish-repair-frontier-20260707b`
  - `hold-spec-fleet-hubless-managed-cluster-quota-headroom-frontier-20260707`

Applying the same supported task-tree command then mutated only the runtime task tree:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

- `repairedCount: 2`
- each repaired task now includes `blocker.observed_by`, `blocker.observation_method`, `blocker.next_check_at`, plus fallback metadata
- each repaired task trace includes `blocked_contract_repaired_at`

Representative repaired task evidence:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-spec-deployment-safeguards-vpa-interop-publish-repair-frontier-20260707b
```

showed:

- `blocker.observed_by.workflow = "project-planner"`
- `blocker.observation_method = "Scheduled blocked-frontier owner review checks the stated wait condition..."`
- `blocker.next_check_at = "2026-07-07T00:36:11.440Z"`
- `trace.blocked_contract_repaired_at = "2026-07-07T00:26:11.440Z"`

The fleet quota holder shows the same repaired contract fields.

### Validation after repair

The authoritative metric source now recomputes to target value `0`:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783384156864, "value": 0 }
```

A direct runtime-tree audit after repair also found no remaining blocked leaves missing observer metadata.

## Conclusion

`fix_root_cause` is the correct operation because the metric breach came from live blocked holders missing required observer contract fields, the supported runtime repair tool backfilled those exact holders, and the live metric sample now returns `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. If the sample remains `0`, alert `2815` should recover automatically. If it returns `>0`, reopen only with concrete offender task ids from a fresh `.state/tasks/tree.json` audit.
