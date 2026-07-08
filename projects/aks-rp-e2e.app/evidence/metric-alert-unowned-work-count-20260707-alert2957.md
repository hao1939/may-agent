# Metric alert triage — aks-rp-e2e.process.unowned-work-count (alert 2957)

- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Alert id: `2957`
- Judged at: `2026-07-07T10:54:40Z`
- Chosen operation: `resolve_stale`

## Why this is stale now

The alert snapshot was real at sampling time: the latest stored snapshot cited
`recoveryUnownedSpecIds=["spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease","spec.serverless-virtualnodes.standard"]`.

But a fresh live recompute now shows the aggregate metric and all of its
component contributors at zero:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
{"measuredAt":1783421611971,"value":0,"sampleSize":0,"note":"{\"sampledAt\":\"2026-07-07T10:53:32.183Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[]}"}
```

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun scripts/project-metrics.ts aks-rp-e2e.spec.recovery-unowned-count --json && echo '---' && \
  bun scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json && echo '---' && \
  bun scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json
{"measuredAt":1783421670485,"value":0}
---
{"measuredAt":1783421671217,"value":0}
---
{"measuredAt":1783421672012,"value":0}
```

## Current state that explains recovery

The metric source code defines the aggregate as:

- `staleActiveTasks.length`
- `+ assignmentMismatches.length`
- `+ specRecovery.recoveryUnowned`
- unless `tasks.projectClosed`, in which case value is forced to `0`.

Current source read-back in `scripts/project-metrics.ts` shows exactly that.

The two previously cited specs now have exact representations in current app
state rather than remaining unowned:

- `spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease` now points at
  `wait-spec-rp-cluster-lifecycle-new-vnet-run-28592745619-artifact-visibility-frontier-20260707e`
  in `.state/spec-loop/state.json`.
- `spec.serverless-virtualnodes.standard` remains pointed at
  `wait-serverless-virtualnodes-standard-extension-install-recovery-28673258682-20260703`
  in `.state/spec-loop/state.json`.
- `.state/tasks/tree.json` also shows newer exact replacement holders for both
  families, including a spec-scoped holder for the RP cluster lifecycle path
  and multiple reviewed replacement holders for the serverless virtualnodes
  frontier, which explains why the current recompute no longer reports either
  spec in `recoveryUnownedSpecIds`.

## Judgment

Choose **`resolve_stale`** because the currently authoritative live metric source
has already recovered to `0`, the component metrics are also `0`, and the alert
row is now lagging recovered ownership state rather than signaling unfinished
ownerless work that still needs a new repair.

## Next validation

Validate on the next `metrics-snapshot` for
`aks-rp-e2e.process.unowned-work-count`: it should record `value=0` or emit the
next nonzero contributor list if ownership regresses again.
