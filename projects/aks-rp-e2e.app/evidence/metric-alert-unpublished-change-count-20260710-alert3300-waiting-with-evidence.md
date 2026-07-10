# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3300)

- Alert id: `3300`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-10T17:23:55Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `9`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

The metric implementation in `projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines `aks-rp-e2e.process.unpublished-change-count` as `unpublishedGitChangeCount(projectDir)`.

That helper runs `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e`, counts every non-branch status line, and adds any `ahead N` divergence from the branch header.

Fresh checks in this session produced:

- direct recompute from `/app/projects/aks-rp-e2e.app` via `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` returned `{"measuredAt":1783711278784,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":9}`
- direct `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` returned `## dev...origin/dev [ahead 1, behind 2]`
- the same repo status showed exactly eight path lines:
  - `features/cluster-autoscaler/compact/staging.diagnostics.json`
  - `features/cluster-autoscaler/compact/staging.plan.json`
  - `features/net-integration/compact/staging.diagnostics.json`
  - `features/net-integration/compact/staging.plan.json`
  - `features/rp-nodepool-lifecycle/compact/staging.diagnostics.json`
  - `features/rp-nodepool-lifecycle/compact/staging.plan.json`
  - `runner/plan-run.ts`
  - `ci/feature-sets/master-validation.txt` (untracked)

That is a truthful metric value of `9`: `ahead 1` plus `8` repo-local status entries.

## Current unpublished surface is represented by live holders

The task tree already carries exact active/waiting holders for the measured surface:

- `compact-feature-cluster-autoscaler` is active and explicitly owns the checked-in compact artifact slice for `features/cluster-autoscaler/compact/staging.plan.json` and `features/cluster-autoscaler/compact/staging.diagnostics.json`.
- `compact-feature-net-integration` is an active frontier holder in `tasks/tree.json`, covering the current net-integration compact staging slice.
- `compact-feature-rp-nodepool-lifecycle` is an active frontier holder in `tasks/tree.json`, covering the current rp-nodepool-lifecycle compact staging slice.
- `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` is a blocked leaf whose blocker text still explicitly names the remaining publication/auth surface: `dev ahead 1 and behind 1 with dirty compact plan/diagnostics files plus runner/plan-run.ts and ci/feature-sets/master-validation.txt` and preserves the exact auth-capable runtime wait needed before authoritative `origin/dev` publication can happen.

So the breach is not orphaned: the six compact files are already owned by three live domain leaves, and the remaining ahead/unpublished/auth-sensitive slice is already held by the shared Azure DevOps auth/runtime wait.

## Why the correct operation is `waiting_with_evidence`

Choose `waiting_with_evidence`.

- Not `resolve_stale`: a fresh recompute still returns `9`, and direct repo state explains it exactly.
- Not `calibrate_metric`: threshold `0` is still correct because these repo-local changes are not yet visible to pipeline runs.
- Not `fix_root_cause`: app-ops should not publish, revert, or rewrite active `aks-explorer` domain slices by hand just to clear the metric, and authoritative remote publication is still coupled to the existing Azure DevOps auth-capable runtime wait.
- Not `upgrade_or_escalate`: the human/runtime escalation already exists as a live blocked leaf with resume/fallback conditions, and this session found the current breach is smaller (`9`, not `28`) and still fully represented by those active/waiting holders.

This session’s concrete change is this refreshed durable evidence note recording the current `9` measurement, exact dirty repo surface, and the exact task-tree holders that justify keeping the alert open as a bounded wait instead of escalating again.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if any of these happen:

1. one of the three active compact holders publishes or replaces its exact current dirty slice;
2. the shared Azure DevOps auth-capable runtime wait materially changes and permits authoritative `origin/dev` publication checks;
3. `runner/plan-run.ts` or `ci/feature-sets/master-validation.txt` is either published, removed, or re-attributed by the owning bounded task.
