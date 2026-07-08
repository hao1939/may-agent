# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2876`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T05:11:07Z`
- Chosen operation: `fix_root_cause`

## Judgment

This breach was real in the live runtime task tree used by the metric sampler, and a safe owner repair path existed. The supported blocked-contract repair tool found two blocked leaf holders in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` that were missing the required observer contract fields, backfilled them, and the live metric recompute returned to `0` afterward.

## Evidence checked

### 1. Persisted metric row showed an active breach

Runtime DB inspection showed:

- `metrics.current = 1`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- `metrics.source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count`

### 2. Metric contract still counts blocked leaf tasks missing observer metadata

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines the metric as:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

and `tasks.blockedMissingObserver` counts blocked leaf tasks whose `blocker` lacks any of:

- `observed_by`
- `observation_method`
- `next_check_at`

### 3. Live runtime recompute still breached before repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed before repair:

```json
{ "measuredAt": 1783401045803, "value": 2 }
```

So the breach was not just stale DB state during this triage session.

### 4. Supported repair tool identified the exact missing-contract holders

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed dry-run result:

```json
{
  "dryRun": true,
  "repairedCount": 2,
  "repaired": [
    "hold-compact-workload-autoscaler-vpa-cert-renewal-source-equivalent-frontier-20260707",
    "hold-compact-traffic-applink-two-member-source-equivalent-frontier-20260707"
  ]
}
```

### 5. Safe runtime repair was applied

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts
```

Observed repair result:

```json
{
  "dryRun": false,
  "repairedCount": 2,
  "repaired": [
    "hold-compact-workload-autoscaler-vpa-cert-renewal-source-equivalent-frontier-20260707",
    "hold-compact-traffic-applink-two-member-source-equivalent-frontier-20260707"
  ]
}
```

### 6. Repaired runtime holders now carry the required observer contract

Direct inspection of `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` after repair showed both repaired holders now include:

- `blocker.waiting_for`
- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`
- `blocker.fallback_at`
- `blocker.fallback_action`
- `trace.blocked_contract_repaired_at`

### 7. Live metric recompute returned to zero after repair

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed after repair:

```json
{ "measuredAt": 1783401092299, "value": 0 }
```

A direct runtime-tree audit also found no remaining blocked leaf missing the required observer fields.

## Why this is `fix_root_cause`

`fix_root_cause` is correct because the current runtime tree really did contain blocked leaf holders missing the observer contract, the owner had a supported repair path (`repair-blocked-contracts`), that repair was applied, and the live metric sample returned to `0` immediately afterward.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed persisted value stays `0`, alert `2876` should recover automatically.
- If it returns `>0`, reopen only with exact offender task ids from a fresh `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` audit.
