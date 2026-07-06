# Metric alert triage — aks-rp-e2e.process.unpublished-change-count

- Alert id: `2416`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-04T19:16:15Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

The metric samples `git status --porcelain=v1 --branch` inside `/app/projects/aks-rp-e2e` and counts both local dirty paths and local commits ahead of origin.

Current direct repo check in this session showed:

- branch: `dev...origin/dev`
- ahead count: `0`
- dirty tracked paths: `23`
- computed unpublished-change count now: `23`

## What is in the dirty surface now

Breakdown from `git diff --name-only` in `/app/projects/aks-rp-e2e`:

- `19` compact summary markdown files under `features/*/compact/staging.summary.md`
- `1` feature packet YAML:
  - `features/managedsystem-pool/packets/create-time-initial-pool.yaml`
- `1` spec JSON:
  - `features/virtualmachines-agentpool/specs/virtualmachines-managedsystem-combined.json`
- `2` TypeScript files:
  - `features/virtualmachines-agentpool/tests/virtualmachines-managedsystem-combined.ts`
  - `runner/execute-vitest-plan.ts`

## Judgment

This is a **real** breach, not a stale alert and not a measurement bug.

However, it is **not safe to fix from this triage session** because the current dirty surface is owned by active in-flight work rather than one isolated forgotten file:

1. Recent owner sessions show multiple still-running task-worker sessions tied to compact-loop reconciliation work.
2. The 19 compact summary edits are repeated worker writebacks across multiple feature families, not one self-contained repo-hygiene mistake.
3. The remaining YAML/JSON/TS changes are substantive active feature/spec/runner edits, not obvious trash files safe to revert.
4. Several touched summary files contain appended blocks with visible NUL padding in the current diff output, which means a safe cleanup likely needs the owner workflow to stop or serialize writers before any publish/cleanup step.

Because of that, committing, reverting, or force-cleaning from this triage would risk overwriting active task-worker outputs or bundling unrelated work into one misleading checkpoint.

## Required unblock before a root-cause fix

A safe reducer action should happen only after the compact-loop writers are serialized and the domain repo is sliced by ownership:

1. stop or drain the currently running compact-loop task-worker sessions that are still appending feature summaries;
2. isolate the 19 compact-summary writebacks from the 4 substantive packet/spec/runner edits;
3. publish or checkpoint each slice intentionally, instead of one broad hygiene commit.

## Next validation signal

Use the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count` after the active compact-loop sessions are drained or after an intentional checkpoint lands in `/app/projects/aks-rp-e2e`.

## Refresh — 2026-07-04T19:16Z triage follow-up

Current direct repo check in `/app/projects/aks-rp-e2e` now shows:

- branch `dev...origin/dev [ahead 2, behind 3]`
- `27` tracked modified files
- computed unpublished-change count still `29` (`27` dirty paths + `2` ahead commits)

This means the alert is **still real**, but the project already has an exact waiting posture rather than an unowned generic hygiene breach:

- accepted owner evidence `evidence/archive/repair-project-unpublished-change-surface-compact-app-routing-20260704.md` records checkpoint commit `45ba66ee0` and reduces the residue into four exact clusters
- current repo status still matches the unresolved active/blocked frontier: 8 app-routing files, 8 live-workflow compact-summary files, 6 blocked-wait compact-summary files, and 5 remaining done-only compact-summary candidates
- the accepted bundle-classification task `package-current-compact-reconciliation-unpublished-change-bundle-20260704` says the compact unpublished bundle should wait for the active app-routing slice to settle rather than be force-published as mixed residue
- a current owner task-worker session is still running (`s_task_repair-compact-workload-identity-runtime-token-projection-windows-carrier-gap-20260704`), so the repo surface is not yet quiescent enough for a safe broad checkpoint from this alert session

Because the remaining metric value is explained by active compact/app-routing output plus exact blocked holders, the correct alert judgment at this moment is **waiting_with_evidence**: keep the breach visible, preserve the exact owner tasks already carrying it, and validate again on the next metric snapshot after the app-routing/compact residue checkpoint successors finish.

## Refresh — 2026-07-04T19:16Z current alert recheck

Current direct repo check in `/app/projects/aks-rp-e2e` now shows:

- branch `dev...origin/dev [ahead 3, behind 3]`
- `52` tracked modified files
- computed unpublished-change count `55` (`52` dirty paths + `3` ahead commits)

Current dirty-surface breakdown from `git diff --name-only`:

- compact files: `20`
  - `storage-csi`: 3 (`staging.diagnostics.json`, `staging.plan.json`, `staging.summary.md`)
  - `app-routing`: 3 (`staging.diagnostics.json`, `staging.plan.json`, `staging.summary.md`)
  - `bootstrap-profile`, `cluster-autoscaler`, `cost-analysis`, `defender-profile`, `deployment-safeguards`, `extension-addon`, `fleet`, `image-cleaner`, `net-integration`, `node-http-proxy`, `oidc-issuer`, `policy-addon`, `secure-tls-bootstrap`, `serverless-schedulerctrl`, `traffic-api-proxy`: 1 summary each
- test files: `19`
  - `storage-csi`: 9
  - `app-routing`: 5
  - `net-integration`: 4
  - `bootstrap-profile`: 1
- spec files: `5` under `features/storage-csi/specs/`
- model/generated view files: `7` under `model/knowledge-map/`
- ahead commits not yet visible on origin: `3`
  - `c863d47ce` checkpoint: land workload-identity windows runtime-token slice
  - `be39ba7d6` checkpoint: land compact candidate five-summary slice
  - `45ba66ee0` checkpoint: land net-integration selected-rerun note

Recent owner session evidence still shows active in-flight writers, not a quiescent repo:

- `s_task_reconcile-compact-loop-live-workflow-202607050318` — `running`, `opCount=24`, `lastActivityAt=1783221591842`
- `s_task_reconcile-compact-loop-package-partial-202607050318` — `running`, `opCount=24`, `lastActivityAt=1783221617967`

### Updated judgment

The alert is still a **real current breach** and the metric is correctly measuring it. But the remaining unpublished surface is still an intentionally unresolved bundle owned by active compact-loop reconciliation plus in-progress app-routing/storage-csi/spec/model work. Because there are live task-worker sessions still mutating this repo surface, forcing a publish, revert, or cleanup from this alert session would risk collapsing multiple ownership slices into one misleading checkpoint.

Therefore the correct final operation remains **waiting_with_evidence**: the wait is explicit, evidence-backed, and tied to exact active sessions plus the next repo-slice checkpoint opportunity. Revalidate on the next metric snapshot after the running compact-loop sessions drain or after one of the active slices lands/publishes.

## Refresh — 2026-07-05T07:24Z current triage verdict

Current direct repo check in `/app/projects/aks-rp-e2e` now shows:

- branch `dev...origin/dev [ahead 6, behind 5]`
- `64` tracked modified paths
- computed unpublished-change count `70` (`64` dirty paths + `6` ahead commits)

Current dirty-surface breakdown from `git diff --name-only`:

- compact files: `26`
- test files: `16`
- spec files: `5`
- model/generated view files: `7`
- other tracked file groups: `10` (`app-routing`/`storage-csi` compact plan+diagnostics files plus `model/knowledge-map/model.json`)

Representative active dirty paths remain concentrated in active feature slices, not one forgotten hygiene tail:

- `features/app-routing/compact/staging.diagnostics.json`
- `features/app-routing/compact/staging.plan.json`
- `features/app-routing/tests/app-routing-custom-domain-ingress.ts`
- `features/storage-csi/compact/staging.diagnostics.json`
- `features/storage-csi/specs/storage-csi-file-private-endpoint-provision.json`
- `features/storage-csi/tests/storage-csi-file-private-endpoint-provision.ts`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/path-summary.json`

Current owner-session evidence still shows in-flight writers rather than a quiescent repo:

- `s_task_reconcile-compact-loop-package-partial-202607050720` — `running`, `opCount=29`, `lastActivityAt=1783236144891`
- `s_project_planner_event_review_20260705072354_2rjyr3` — `running`, `opCount=3`, `lastActivityAt=1783236248289`
- the root task tree still points at active leaf `reconcile-compact-loop-package-partial-202607050720`

### Final judgment for alert 2416

The metric is still measuring a **real current breach**. But the breach is explained by active compact-loop/package work that is still mutating the domain repo, and the repo is also `behind 5`, so a push/publish action from this triage session would not even be the right immediate root-cause fix. The correct operation is therefore still **waiting_with_evidence**: preserve the alert as a visible owner signal, keep the exact active leaf responsible for shrinking this surface, and validate again on the next metrics snapshot after the active compact/package slice either lands a checkpoint or drains.

## Refresh — 2026-07-06T03:35Z current triage verdict

Current direct repo check in `/app/projects/aks-rp-e2e` now shows:

- branch `dev...origin/dev [ahead 13, behind 5]`
- `65` unpublished changes by direct `git status --short` count (`64` modified tracked paths + `1` untracked packet)
- computed unpublished-change metric sample `78`, which matches the metric snapshot because the sampler adds `13` ahead commits to the `65` local path changes

Current dirty-surface breakdown from `git diff --name-only` and `git status`:

- compact summary / diagnostics / plan files across many feature families, with strongest concentrations in `storage-csi` (`6` paths), `traffic-azure-service-mesh` (`4`), `traffic-applink` (`4`), `workload-identity` (`3`), `network-cni` (`3`), and `localdns` (`3`)
- generated knowledge-map files: `7` under `model/knowledge-map/`
- shared runner code: `runner/feature-compact.ts`
- one untracked packet: `features/traffic-azure-service-mesh/packets/vm-prerelease-addonv2-matrix-source-pack-20260705.json`
- ahead commits not yet published on origin: `13`

Representative unpublished work now spans both active compact-loop writebacks and substantive feature/model edits, not one isolated forgotten checkpoint:

- `features/storage-csi/compact/staging.diagnostics.json`
- `features/storage-csi/packets/full-cache-os-disk-negative.yaml`
- `features/network-cni/tests/network-cni-azure-overlay-dual-stack.ts`
- `features/traffic-applink/compact/staging.plan.json`
- `features/traffic-azure-service-mesh/tests/traffic-azure-service-mesh-vm-prerelease-addonv2-matrix.ts`
- `model/knowledge-map/model.json`
- `runner/feature-compact.ts`

Current owner-session evidence still shows in-flight writers rather than a quiescent repo:

- `s_task_reconcile-compact-loop-package-partial-202607060334` — `running`, `opCount=16`, `lastActivityAt=1783308940714`
- `s_task_reconcile-compact-loop-live-workflow-202607060334` — `running`, `opCount=22`, `lastActivityAt=1783308932543`
- `s_project_planner_event_review_20260706033524_ah5nmu` — `running`, `opCount=1`, `lastActivityAt=1783308936120`
- `tasks/tree.json` still names active focus `focus-storage-csi-live-readiness-and-checkpoint-hygiene-20260706`, so repo hygiene reduction is already attached to a live frontier leaf rather than orphaned residue

### Updated judgment

The alert remains a **real current breach**, and the metric is correctly measuring it. But the current unpublished surface is still mixed across active compact-loop outputs, active storage-csi / traffic / workload-identity authoring, generated model refreshes, and 13 unpublished local commits while the repo is also `behind 5`. Because live task-worker and planner sessions are still mutating this same repo surface, forcing a publish, revert, or catch-all checkpoint from this alert session would risk collapsing multiple active ownership slices into one misleading hygiene commit.

Therefore the correct final operation remains **waiting_with_evidence**: keep the alert visible, preserve the evidence refresh in this file, and wait for the next metrics snapshot after the active compact/storage-csi checkpoint-hygiene slice drains or lands a deliberate checkpoint.

## Refresh — 2026-07-06T05:27Z current triage verdict for alert 2575

Current direct checks now show the alert is still real but narrower than the prior 78-count burst:

- runtime metric sample via `bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count` returned `20`
- direct domain-repo status in `/app/projects/aks-rp-e2e` shows branch `dev...origin/dev` with `ahead=0`
- `git status --porcelain=v1 --branch` counts exactly `20` changed paths, matching the metric sample
- all `20` changed paths are tracked feature-owned compact summaries: `features/*/compact/staging.summary.md`

Representative current paths:

- `features/aad-rbac/compact/staging.summary.md`
- `features/localdns/compact/staging.summary.md`
- `features/storage-csi/compact/staging.summary.md`
- `features/traffic-alb-controller/compact/staging.summary.md`
- `features/traffic-applink/compact/staging.summary.md`

A spot diff across multiple affected files shows the same new write shape: each file received a `Worker reconciliation checkpoint 2026-07-06T05:12:49Z` block pointing to `evidence/archive/reconcile-compact-loop-package-partial-attempt-20260706T051249Z-worker.md` and retry attempt `a_reconcile-compact-loop-package-partial_20260706051249`. That means the current breach is not stray forgotten residue; it is the direct output of the still-running compact reconciliation worker.

Current owner-session evidence confirms the writer is still active:

- `s_task_reconcile-compact-loop-package-partial-202607060517` — `running` (`workflow:task-worker`)
- `s_task_reconcile-compact-loop-live-workflow-202607060517` — `running` (`workflow:task-worker`)
- legacy planner session `s_project_planner_planning_update_20260704123650_2aut9d` also still shows `running`

### Updated judgment for alert 2575

The metric is correctly measuring a **real current breach**. But the breach is presently one coherent active-writer surface: 20 tracked compact-summary files written by the current retry worker, with no ahead commits yet published and no evidence that this triage session can safely publish or revert the files without racing the live task-worker sessions. Because the current changes belong to active owner workflows already represented in the project frontier, the truthful final operation is **waiting_with_evidence** rather than a forced checkpoint or stale-resolution claim.

Next validation should occur on the next `metrics-snapshot` after the running compact reconciliation sessions drain or after a deliberate compact-summary checkpoint lands in `/app/projects/aks-rp-e2e`.
