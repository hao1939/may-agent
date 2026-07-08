# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3057`

- Judged at: `2026-07-08T05:03:40Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `app-ops`

## Judgment

This breach was real at triage time. The persisted metric row showed `current=1`, the supported blocked-contract repair dry run found one current blocked holder missing required observer metadata, and the owner had a safe repair path available through the task-tree tool. Applying `repair-blocked-contracts` repaired exactly one blocked task (`hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`), and a fresh metric sample immediately returned `0`. Because the live source of truth really did contain a missing observer contract and the safe owner repair was applied in this session, the correct final operation is `fix_root_cause`.

## Evidence checked

### 1. Persisted metric row still breaching

Alert payload / metric row at triage:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783486826548`

### 2. Metric contract still counts blocked leaves missing observer metadata

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

And `tasks.blockedMissingObserver` is computed from blocked leaf tasks missing any of:

- `observed_by`
- `observation_method`
- `next_check_at`

### 3. Live recompute before repair was already healthy, but the supported repair path still found one concrete offender

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result before repair:

```json
{ "measuredAt": 1783486996431, "value": 0 }
```

That meant the metric sampler had already dropped back to `0`, but this alone was not enough to dismiss the alert because the supported repair dry run still found a concrete blocked holder missing observer metadata.

### 4. Supported blocked-contract repair dry run found one exact blocked holder to repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount = 1`
- repaired task: `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

### 5. Applying the safe repair changed the runtime task tree

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

- `dryRun = false`
- `repairedCount = 1`
- repaired task: `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

A follow-up `task-tree show` on that task now shows the missing observer contract fields present:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`
- `trace.blocked_contract_repaired_at = 2026-07-08T05:01:50.250Z`

### 6. Fresh live validation after repair is healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result after repair:

```json
{ "measuredAt": 1783487017026, "value": 0 }
```

Direct runtime-tree audit after repair:

```json
{
  "blocked_missing_observer_count": 0,
  "task_ids": []
}
```

## Conclusion

`fix_root_cause` is the correct final operation because the live runtime task tree still had one blocked holder missing observer metadata according to the supported repair path, the owner safely repaired that blocked contract in this session, and post-repair validation shows no remaining blocked tasks missing observer metadata with a fresh metric sample of `0`.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted `metrics.current` row updates from `1` to `0` and alert `3057` resolves automatically. If a future fresh dry run or runtime-tree audit names a new blocked task missing observer metadata, reopen with that exact task id.
