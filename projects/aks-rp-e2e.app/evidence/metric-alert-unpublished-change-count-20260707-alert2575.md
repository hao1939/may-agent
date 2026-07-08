# Metric alert triage — aks-rp-e2e.process.unpublished-change-count (alert 2575)

- Alert id: `2575`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Direct checks during this triage show the breach is still real and now narrowly concentrated:

- direct domain-repo status in `/app/projects/aks-rp-e2e` shows `## dev...origin/dev [ahead 1]`
- `git status --short | wc -l` in `/app/projects/aks-rp-e2e` returned `8`
- the live unpublished surface is therefore `9`, matching the alert value as `1` unpublished local commit plus `8` dirty tracked paths

## Current dirty surface

`git diff --name-only` in `/app/projects/aks-rp-e2e` now shows only eight modified tracked files:

- `features/aad-rbac/specs/aad-rbac-managed-v2-lifecycle.json`
- `features/bootstrap-profile/compact/staging.summary.md`
- `features/extension-addon/compact/staging.summary.md`
- `features/oidc-issuer/compact/staging.summary.md`
- `features/secure-tls-bootstrap/compact/staging.summary.md`
- `features/serverless-schedulerctrl/compact/staging.summary.md`
- `features/traffic-azure-service-mesh/compact/staging.summary.md`
- `features/workload-identity/compact/staging.summary.md`

The unpublished local commit not yet visible on `origin/dev` is:

- `0f0378fa1` — `Refresh loop evidence and knowledge model`

Representative content checks show these are still active review/writeback outputs rather than one clearly accepted publishable slice:

- `features/aad-rbac/specs/aad-rbac-managed-v2-lifecycle.json` now rewrites the maintained verdict to `owner-response-await` and updates the exception review packet refs to `2026-07-07` owner handoff evidence.
- `features/bootstrap-profile/compact/staging.summary.md` appends four new `## Update` blocks from repeated `reconcile-compact-loop-live-workflow-*` tasks through `202607070629`.

## Why this is waiting, not a root-cause fix

This alert is still **real**, but it is not safely fixable from this triage session:

1. The remaining dirty set is small, but it is still tied to **active project review flow**, not a quiescent done-only slice.
2. Runtime `sessions` shows concurrent `aks-explorer` work is still running in the same project during this triage, including a planner wake and a task-worker run, so publishing now would race in-flight owner decisions.
3. The changed files are not just mechanical residue; they encode current review judgments and repeated compact-loop writebacks that still need owner acceptance or replacement in the task tree.
4. Although the earlier `ahead 1, behind 1` divergence is gone, the root publication question remains unresolved: the repo is still `ahead 1` and has uncommitted active-review edits, so pushing or checkpointing now would still publish mixed in-flight state.

Because of those facts, committing, pushing, reverting, or manually resolving the alert from this session would risk publishing review-state churn before the owner flow settles.

## Concrete state change made by this triage

This triage refreshes the durable evidence at:

- `projects/aks-rp-e2e.app/evidence/metric-alert-unpublished-change-count-20260707-alert2575.md`

The refreshed evidence narrows the current breach from the earlier 47-file mixed frontier to the present 9-change surface and records why the remaining work still waits on owner-flow stabilization rather than blind publication.

## Resume condition

Re-evaluate on the next `metrics-snapshot` after one of these concrete changes occurs:

1. the active planner/review flow accepts or replaces the current AAD-RBAC + compact-summary writeback slice so it becomes one truthful publication candidate, or
2. the eight dirty tracked files are either published or cleared and the ahead local commit is pushed to `origin/dev`.
