# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3479)

- Alert id: `3479`
- Judged at: `2026-07-12T17:59:41Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `19`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

The metric implementation in `/app/projects/aks-rp-e2e.app/scripts/project-metrics.ts`
counts both:

1. local branch commits ahead of the tracked upstream from `git status --porcelain=v1 --branch`, and
2. each tracked dirty worktree path.

Relevant implementation excerpt:

```ts
function unpublishedGitChangeCount(repoDir: string): number {
  const result = spawnSync("git", ["status", "--porcelain=v1", "--branch"], {
    cwd: repoDir,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.status !== 0) return 0;
  let count = 0;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith("## ")) {
      const ahead = line.match(/\[ahead (\d+)/);
      if (ahead) count += Number.parseInt(ahead[1], 10) || 0;
      continue;
    }
    count += 1;
  }
  return count;
}
```

Fresh repo checks during this triage showed:

- `git rev-list --left-right --count origin/dev...HEAD` => `1 1`, so the repo is `1` commit ahead of `origin/dev`
- `git status --short --untracked-files=no | wc -l` => `18`

That explains the live metric exactly: `1 + 18 = 19`.

This means the alert is not stale and the current breach is real.

## Exact unpublished surface in `/app/projects/aks-rp-e2e`

Fresh `git status --short --untracked-files=no` showed these tracked unpublished changes:

```text
 M features/rp-cluster-lifecycle/compact/staging.diagnostics.json
 M features/rp-cluster-lifecycle/compact/staging.plan.json
 M features/rp-cluster-lifecycle/compact/staging.summary.md
 M features/rp-cluster-lifecycle/specs/rp-available-agent-pool-versions.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-create-get-delete.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-maintenance-state.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-upgrade-k8s-version.json
 M features/rp-cluster-lifecycle/specs/rp-operation-status-polling.json
 M features/rp-cluster-lifecycle/tests/rp-operation-status-polling.test.ts
 M features/rp-cluster-lifecycle/tests/rp-operation-status-polling.ts
 M model/knowledge-map/model.json
 M model/knowledge-map/views/evidence-index.md
 M model/knowledge-map/views/evidence-matrix.json
 M model/knowledge-map/views/graph-view.json
 M model/knowledge-map/views/model.generated.md
 M model/knowledge-map/views/path-summary.json
 M model/knowledge-map/views/status-summary.json
```

Grouped by family, the breach is:

- `11` RP cluster lifecycle compact/spec/test files
- `7` knowledge-map/model projection files
- `1` unpublished local commit ahead of `origin/dev`

A focused diffstat over those same tracked files confirmed this is real domain/project churn, not runtime noise:

```text
18 files changed, 370 insertions(+), 417 deletions(-)
```

## Why this is a wait, not an app-side fix in this session

This metric counts unpublished repo state in the AKS domain workspace.
App-ops can verify and judge the signal, but should not independently publish,
revert, or reinterpret active domain feature/spec/test/model changes from the
metric triage lane.

There is also a concrete publication blocker in this environment. A remote check
against `origin` failed because the Azure DevOps credential helper depends on
`az`, which is unavailable here:

```text
/app/.state/.local/bin/git-credential-azdevops: line 28: az: command not found
fatal: could not read Username for 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner': No such device or address
```

So even if publication were otherwise ready, this session cannot safely validate
or complete a push to the pipeline-visible remote.

## Why `waiting_with_evidence` is the correct operation now

Choose `waiting_with_evidence`.

- Not `resolve_stale`: the repo-local count still explains a live value of `19`.
- Not `calibrate_metric`: threshold `0` is still correct because unpublished changes remain invisible to pipeline runs.
- Not `downgrade_priority`: the signal still represents a real pipeline-visibility gap.
- Not `fix_root_cause`: clearing the metric would require publishing or reverting active domain changes, and this environment cannot authenticate to the Azure DevOps remote.
- Not `upgrade_or_escalate`: this is a bounded known wait with a specific tooling blocker, not a destructive-action or policy emergency.
- Not `document_exception`: this is active unpublished work, not an accepted long-term exception.

## Exact wait, observer, and fallback

### Wait
Wait for one of these exact closure paths:

1. publish the current RP cluster lifecycle and knowledge-map slice so pipeline-visible repo state matches local intended state, or
2. revert/supersede the local slice if it is not ready to publish, or
3. restore an auth-capable publication path for `origin` and then complete the truthful publish/revert decision.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, and
- the domain repo state in `/app/projects/aks-rp-e2e` for the eighteen tracked paths plus the ahead-of-origin branch state.

### Fallback
If the next snapshot still breaches with the same tracked residue and the `az`-backed publication path remains unavailable, treat it as a repeated blocked publication gap and escalate to the owner/runtime lane that can restore auth or decide publish vs revert.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if the tracked slice is published, reverted, or the Azure DevOps auth/runtime path is restored before the next snapshot.
