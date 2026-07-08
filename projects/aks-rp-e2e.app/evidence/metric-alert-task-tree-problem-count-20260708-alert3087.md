# Metric alert triage — aks-rp-e2e.process.integrity.task-tree-problem-count (alert 3087)

- Alert id: `3087`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Judged at: `2026-07-08T02:41Z`
- Chosen operation: `waiting_with_evidence`

## Persisted metric state at triage start

Read-only runtime state still showed an open breach:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `metrics.updated_at = 1783498990589`
- open alert row `metric_alerts.id = 3087`, `resolved_at = null`

Recent persisted snapshots:

- `1783498990589` => `1`
- `1783498646774` => `1`
- `1783498334705` => `0`
- `1783498028971` => `1`
- `1783497715538` => `2`

## Live source-of-truth verification

Fresh direct recompute no longer reproduced the breach:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed output:

```json
{ "measuredAt": 1783499284848, "value": 0 }
```

Fresh integrity verification also reported the app task tree itself is healthy:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed output:

```text
$ bun run ./scripts/check-integrity.ts
[warn] domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/
[warn] domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=723
```

## Why this is waiting_with_evidence

The current metric implementation sets `taskTreeProblemCount` to:

- `1` if the task tree root count is not exactly one, plus
- `assignmentStateMismatch`

Current code evidence:

```ts
taskTreeProblemCount: (roots === 1 ? 0 : 1) + assignmentStateMismatch;
```

The fresh recompute returned `0`, and `bun run integrity` returned `App integrity OK`, so there is no reproducible task-tree root/reachability/parent-child defect to repair right now.

This means the alert is currently ahead of the live source of truth: the persisted snapshot still says `1`, while direct measurement already says `0`. In this workflow I do not have a safe runtime write path to mutate `metric_alerts` or force metric reconciliation. The concrete responsible action is therefore to record durable evidence that the live condition has recovered and wait for the next supported metric snapshot / alert reconciliation cycle to update persisted runtime state.

## Concrete next validation

Validate on the next `metrics-snapshot` cycle for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Recovery is confirmed when the persisted metric row refreshes from `1` to `0` and alert `3087` resolves automatically. If a future direct recompute returns `>0` again, reopen only with the exact current root-shape or assignment-mismatch contributor from a fresh live audit.
