# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3079`

- Judged at: `2026-07-08T07:28:37Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `app-ops`

## Judgment

This breach was real in the live task-tree contract, not just a stale alert row. A supported dry run of `task-tree repair-blocked-contracts` found one current blocked leaf missing required observer metadata, specifically `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`. I then applied the supported repair path, which wrote the missing blocked-contract fields onto that task. A fresh metric sample after the repair returned `value=0` with no offender task ids, so the correct final operation is `fix_root_cause`.

## Evidence checked

### Persisted alert context

At triage, the alert payload reported:

- `metric_id = aks-rp-e2e.process.blocked.missing-observer-count`
- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`

Recent snapshots around the breach also showed this metric oscillating between `0` and `1`, so I checked the live tree instead of assuming the alert was stale.

### Live task-tree repair dry run found one exact offender

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount = 1`
- offender repaired by the tool: `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

That is direct proof that one blocked leaf still lacked the required observer contract.

### Metric sample before deciding final operation

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783495703380,"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

Although the sampler was already back to `0`, the dry run still exposed a live blocked-contract defect, so this was not sufficient to choose `resolve_stale`.

### Supported repair path applied successfully

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

Observed result:

- `dryRun = false`
- `repairedCount = 1`
- repaired task: `hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707`

### Repaired task now carries the required observer contract

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-dev-infra-core-slice03-kms-publickv-invalid-sku-frontier-20260707
```

Observed blocker fields now present on the task:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`
- `blocker.fallback_at`
- `blocker.fallback_action`
- `trace.blocked_contract_repaired_at = 2026-07-08T07:26:54.994Z`

### Post-repair validation sample is healthy

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783495717269,"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Conclusion

`fix_root_cause` is the correct final operation because the live task tree still had one blocked leaf missing observer metadata, the owner had a safe built-in repair path, and that repair was applied successfully in this session with healthy post-repair validation.

## Next validation

Validate on the next `metrics-snapshot` cycle. Recovery is confirmed when the persisted metric row remains `0` and alert `3079` resolves or is superseded by the next healthy snapshot.
