# Metric alert triage — aks-rp-e2e.process.integrity.task-tree-problem-count (alert 3081)

- Alert id: `3081`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Judged at: `2026-07-08T02:41Z`
- Chosen operation: `waiting_with_evidence`

## Current alert state checked

Persisted metric and alert state still show a breach:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- open alert row `metric_alerts.id = 3081`, `resolved_at = null`

Recent persisted snapshots for this metric:

- `1783498028971` => `1`
- `1783497715538` => `2`
- `1783497392730` => `0`
- `1783497068333` => `0`
- `1783496757661` => `0`

Recent related metric event evidence:

- `metric.breach` event `2843378` for this metric at `1783498079295` with `current=1`
- `metric.recovered` event `2843379` at `1783498079329` for `aks-rp-e2e.process.assignment-state-mismatch-count` with `current=0`

## Current live verification

Fresh direct recompute no longer reproduces the breach:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed output:

```json
{ "measuredAt": 1783498164777, "value": 0 }
```

Fresh integrity check also reports the app task tree itself is structurally healthy:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed output:

```text
$ bun run ./scripts/check-integrity.ts
[warn] domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/
[warn] domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=688
```

## Why this is `waiting_with_evidence`

The metric implementation computes `task-tree-problem-count` as:

- `1` when task-tree root count is not exactly one, plus
- `assignmentStateMismatch`

The current direct recompute is already back to `0`, and `bun run integrity` reports `App integrity OK`, so there is no currently reproducible task-tree root/reachability defect to repair.

The most plausible explanation from current evidence is a transient assignment-state mismatch that already healed between the persisted snapshot and this triage. That explanation is consistent with the near-simultaneous recovery event for `aks-rp-e2e.process.assignment-state-mismatch-count`.

This workflow does not provide a safe runtime write path to mutate `metric_alerts` or force a metrics refresh, so the truthful concrete action is to record durable evidence that the live source of truth has already recovered and wait for the supported lifecycle to catch up.

## Concrete next validation

Wait for the next `metrics-snapshot` / alert reconciliation cycle for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Recovery is confirmed when the persisted metric row refreshes to `0` and alert `3081` resolves automatically. If a future direct recompute returns `>0` again, reopen only with the exact current mismatch contributor or root-shape defect from a fresh live audit.
