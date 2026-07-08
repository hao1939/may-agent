# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3048)

- Alert id: `3048`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-08T07:12:00Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Direct checks during this triage confirm the breach is still real now:

- runtime metric row still shows `current=5`, `threshold=0`, `target=0`, `priority=P0`
- recent `metric_snapshots` stayed flat at `5` for the last ten samples through `measured_at=1783494578892`
- `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` in `/app/projects/aks-rp-e2e.app` returned `{"measuredAt":1783494628769,"value":5}`
- `projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines this metric as `unpublishedGitChangeCount(projectDir)`, which counts tracked dirty git status lines plus any branch-ahead marker
- `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` showed branch `dev...origin/dev` with no `[ahead N]` marker and exactly five modified tracked paths, which matches the measured value `5`

## Current dirty surface

The five tracked unpublished changes are exactly:

1. `features/secure-tls-bootstrap/compact/staging.summary.md`
2. `features/virtualmachines-agentpool/compact/staging.diagnostics.json`
3. `features/virtualmachines-agentpool/compact/staging.plan.json`
4. `features/virtualmachines-agentpool/compact/staging.summary.md`
5. `features/virtualmachines-agentpool/specs/virtualmachines-accelerated-networking.json`

Current diffs show one bounded package-partial repair surface rather than stray repo residue:

- `features/virtualmachines-agentpool/specs/virtualmachines-accelerated-networking.json` moves the spec from `blocked/environment-blocked` to `pass/verified` with returned Azure DevOps rerun evidence `171317806`
- the three `virtualmachines-agentpool/compact/*` files regenerate the feature package to reflect the updated current-head split frontier after that returned proof
- `features/secure-tls-bootstrap/compact/staging.summary.md` records the same-run artifact recovery and review for run `28676958643`, replacing the older "artifact missing" posture with a reviewed runtime/environment blocker (`ImagePullBackOff` after the disable-network-isolated transition)

## Why this is waiting, not a root-cause publish/revert from this session

This alert is real, but the right process move is to wait on the active bounded owner lane instead of committing or reverting from this triage session:

1. runtime `sessions` currently show active `aks-explorer` task-worker sessions for the relevant repair frontier, especially `s_task_reconcile-compact-loop-package-partial-202607080710`, started at `1783494658729` with recent `lastActivityAt=1783494659204`
2. the assigned package-partial task explicitly covers both `feature:secure-tls-bootstrap` and `feature:virtualmachines-agentpool`, matching the exact five-file dirty surface seen in git
3. the branch is still `dev...origin/dev` with no ahead commits, so this is not a simple "push what is already committed" hygiene breach; it is active uncommitted work inside a running bounded repair lane
4. forcing a commit or revert from app-ops triage would race the domain owner and risks publishing a partial checkpoint that mixes in-progress compact/spec updates before the running repair family reaches a truthful stop point

## Concrete state change made by this triage

This triage refreshes the durable alert evidence to match the current `5`-file breach and ties the accepted wait to the live `reconcile-compact-loop-package-partial-202607080710` owner lane instead of the older now-stale seven-file VM-runner slice description.

## Resume condition

Re-evaluate on the next `metrics-snapshot` after one of these happens:

1. `s_task_reconcile-compact-loop-package-partial-202607080710` finishes and the same five-file slice remains stable for publication or cleanup review, or
2. the running owner lane intentionally publishes or clears this package-partial slice and the metric returns to `0`, or
3. the dirty set widens beyond these five files, which would mean the accepted bounded wait no longer explains the full breach.
