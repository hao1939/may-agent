# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count

- Alert id: `2824`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T00:48Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the controller-authoritative runtime task tree, and the safe owner repair path existed. The supported blocked-contract repair command found exactly one blocked leaf missing `blocker.waiting_for` in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` and repaired it.

## Evidence checked

### Live metric before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783385272303, "value": 1 }
```

### Exact offender from the runtime tree

Dry-run and direct runtime-tree audit agreed on one offender:

- `hold-compact-serverless-promotion-frontier-20260707`

Its blocker had `condition`, `category`, `owner`, and `resume_condition`, but no `waiting_for` object.

### Safe repair path

Dry-run first:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount: 1`
- repaired task: `hold-compact-serverless-promotion-frontier-20260707`

Apply the same supported repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

- `repairedCount: 1`
- repaired task: `hold-compact-serverless-promotion-frontier-20260707`

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
{ "measuredAt": 1783385338549, "value": 0 }
```

## Conclusion

`fix_root_cause` is the correct operation because the alert came from a live blocked task missing the required wait-target contract, the supported runtime repair command added that contract, and the metric source now recomputes to `0`.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`. If the sample stays `0`, alert `2824` should recover automatically.
