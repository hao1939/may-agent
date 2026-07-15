# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3671)

- Date: 2026-07-14
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3671`
- Owner: `app-ops`

## Judgment

The breach was real. The live runtime task tree was corrupted (`.state/tasks/tree.json` was invalid JSON), which blocked both integrity checks and task-tree tooling. After restoring the runtime tree from the last valid mirrored `tasks/tree.json`, one remaining focus-metadata integrity defect still kept the metric at `1`: the focus branch frontier links no longer matched the live tree.

This session fixed the root cause by:

1. restoring runtime task-tree readability through the supported task-tree save helper,
2. running `task-tree repair-rollups` to restore parent/active rollups, and
3. rewriting the focus branch structured frontier metadata through the supported task-tree save path so the live tree passes integrity again.

## Evidence checked

### 1) Persisted metric row was breaching before repair

- `metrics.current = 1`
- `threshold = 0`
- `priority = P0`

### 2) Runtime tree was genuinely broken at triage start

Before repair:

- `bun run integrity` failed with `/.state/tasks/tree.json is not valid JSON: JSON Parse error: Expected '}'`
- `bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json` failed on the same parse error
- the corrupt fragment was the `focus-terminal-frontier-finality-reconciliation-20260714` node missing the comma after `goal`

### 3) Runtime tree readability was restored

The session restored `.state/tasks/tree.json` from the valid mirrored `tasks/tree.json` using the supported task-tree save helper, then ran `bun run task-tree repair-rollups`, which repaired these rollups:

- `aks-spec-verification-loop`: `backlog -> blocked`
- `aks-feature-compact-loop`: `backlog -> blocked`
- `project`: `backlog -> active`

### 4) One final structured focus-metadata defect remained and was repaired

After runtime JSON recovery but before the final focus repair:

- `bun run integrity` failed with exactly one issue: focus metadata drift on `focus-terminal-frontier-finality-reconciliation-20260714`
- `bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json` returned `value=1`

The session then rewrote the focus branch structured frontier metadata through the supported task-tree save path.

### 5) Live validation after the repair is green

After the final focus-metadata repair:

- `bun run integrity` returned `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=128`
- `bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json` returned:

```json
{"measuredAt":1784031700766,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

- `bun run task-tree summary` reported one root (`project`) and a readable live frontier again

## Outcome

Choosing `fix_root_cause` because the live task tree corruption and the remaining structured focus-metadata drift were both safely repairable through supported task-tree save/repair tooling in this session, and the live metric recompute now returns `0`.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh to move the persisted `metrics.current` row from `1` to `0` and auto-clear alert `3671`.
