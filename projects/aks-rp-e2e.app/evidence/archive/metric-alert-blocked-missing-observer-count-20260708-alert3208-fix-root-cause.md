# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3208`

- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3208`
- Final operation: `fix_root_cause`
- Triage time: `2026-07-08T18:00:05.834Z`

## Judgment

This breach was real at triage time. A fresh live metric sample returned `value=2` and named two current offender task ids in the runtime task tree:

- `hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260708`
- `hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708`

The supported repair path `bun run ./scripts/task-tree.ts repair-blocked-contracts` safely backfilled missing blocked-contract observer metadata in the runtime task tree. A second repair pass then repaired one additional newly-created blocked holder:

- `wait-compact-bootstrap-profile-cache-direct-cache-switch-run171365996-timeout-frontier-20260708b`

After repair, a fresh metric sample returned `value=0` with `offenderTaskIds=[]`.

## Evidence

### 1. Persisted metric row was breaching

The alert payload reported:

- `current=1`
- `threshold=0`
- latest snapshot offender: `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`

### 2. Fresh live recompute showed the current breach and concrete offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Output before repair:

```json
{"measuredAt":1783555064496,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260708\",\"hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708\"]}"}
```

### 3. Supported repair path found and backfilled the missing observer contract

Dry run:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Dry-run result:

```json
{
  "repairedCount": 2,
  "repaired": [
    "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260708",
    "hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708"
  ]
}
```

Applied repair:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Applied result (first pass):

```json
{
  "repairedCount": 2,
  "repaired": [
    "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260708",
    "hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708"
  ]
}
```

Applied result (second pass after a concurrent planner update introduced one more offender):

```json
{
  "repairedCount": 2,
  "repaired": [
    "hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260708",
    "wait-compact-bootstrap-profile-cache-direct-cache-switch-run171365996-timeout-frontier-20260708b"
  ]
}
```

### 4. Repaired tasks now show observer metadata in the runtime tree

`task-tree show` after repair confirmed blocked holders now include:

- `observed_by`
- `observation_method`
- `next_check_at`

for:

- `hold-compact-fleet-hubless-rpapi-version-progression-frontier-20260708`
- `hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708`
- `wait-compact-bootstrap-profile-cache-direct-cache-switch-run171365996-timeout-frontier-20260708b`

### 5. Fresh live metric sample recovered to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Output after repair:

```json
{"measuredAt":1783555140414,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Conclusion

`fix_root_cause` is the correct final operation because the live runtime task tree really did contain blocked leaf tasks missing the required observer contract, the owner had a supported safe repair path, that repair was applied in this session, and the fresh live metric sample returned to `0`.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Recovery is confirmed when the persisted metric row updates to `current=0` and alert `3208` resolves automatically.
