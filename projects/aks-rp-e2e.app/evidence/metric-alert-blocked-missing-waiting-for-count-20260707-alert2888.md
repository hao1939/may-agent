# Metric alert triage — aks-rp-e2e.process.blocked.missing-waiting-for-count (alert 2888)

- Alert id: 2888
- Metric: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Chosen operation: `fix_root_cause`
- Timestamp: 2026-07-07T06:15:00Z

## Judgment

The breach was real but narrow, not stale and not a threshold problem.

The metric implementation counts blocked leaf tasks whose `blocker` record lacks a structured `waiting_for` object. At triage time, the live task tree had exactly one such task:

- `hold-spec-traffic-applink-upgrade-survival-contract-ceiling-20260707`

That blocked holder had `condition`, `category`, `owner`, `resume_condition`, and `resume_at`, but it was missing the structured wait/observer/fallback metadata expected by the blocked-contract metric family.

## Concrete change made

Ran the safe task-tree repair path:

```bash
cd /app/projects/aks-rp-e2e.app
bun run ./scripts/task-tree.ts repair-blocked-contracts
```

The repair output reported:

- `repairedCount: 1`
- repaired task `hold-spec-traffic-applink-upgrade-survival-contract-ceiling-20260707`

After repair, that blocked holder contains:

- `waiting_for`
- `observed_by`
- `observation_method`
- `next_check_at`
- `fallback_at`
- `fallback_action`
- trace field `blocked_contract_repaired_at`

## Validation

Recomputed the metric with:

```bash
cd /app/projects/aks-rp-e2e
bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count
```

Result: `0`

A direct task-tree scan using the same blocked/waiting-for logic also returned `count 0`.

## Why this is not calibration or stale resolution

- Not calibration: the threshold remains correct at `0`; blocked holders should carry explicit wait targets.
- Not stale: the metric recomputed to `1` before repair and only returned to `0` after the blocked-contract repair updated the task.
- Not waiting_with_evidence: the owner could safely repair the malformed blocked holder immediately.
