# Metric alert triage — aks-rp-e2e.process.integrity.task-tree-problem-count (alert 3194)

- Alert id: `3194`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Judged at: `2026-07-08T20:41:12Z`
- Chosen operation: `waiting_with_evidence`

## Persisted runtime state at triage start

Read-only runtime state still showed an open breach:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `metrics.updated_at = 1783543163597`
- open alert row `metric_alerts.id = 3194`, `resolved_at = null`

Recent persisted snapshots:

- `1783543163597` => `1`
- `1783542863538` => `0`
- `1783542563685` => `0`
- `1783542264500` => `0`
- `1783541952439` => `0`
- `1783541652716` => `0`
- `1783541348350` => `0`
- `1783541064647` => `0`
- `1783540731523` => `0`
- `1783540431411` => `0`

## Live source-of-truth verification

Fresh direct recompute no longer reproduced the breach:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed output:

```json
{"measuredAt":1783543265859,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

Fresh integrity verification also reported the app task tree is currently healthy:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed output:

```text
$ bun run ./scripts/check-integrity.ts
[warn] domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/
[warn] domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=625
```

## Why this is waiting_with_evidence

The metric implementation is a direct gauge of `tasks.taskTreeProblemCount`:

```ts
"aks-rp-e2e.process.integrity.task-tree-problem-count": () => ({
  value: tasks.taskTreeProblemCount,
}),
```

The fresh direct recompute returned `0`, while the persisted metric row and alert still show the prior failing sample (`1`). That means the currently visible alert is ahead of automatic reconciliation rather than evidence of a still-reproducible task-tree integrity defect.

In this environment I only have read-only DB access and no safe runtime write path to mutate `metric_alerts` or force metric reconciliation. The concrete responsible action is therefore to record durable evidence that the live condition has recovered and wait for the next supported metrics snapshot / alert reconciliation cycle.

## Concrete next validation

Validate on the next `metrics-snapshot` cycle for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Recovery is confirmed when the persisted metric row refreshes from `1` to `0` and alert `3194` resolves automatically. If a future direct recompute returns `>0` again, reopen only with the exact current root-shape or assignment-mismatch contributor from a fresh live audit.
