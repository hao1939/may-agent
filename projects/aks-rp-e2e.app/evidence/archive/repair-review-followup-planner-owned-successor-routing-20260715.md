# Repair review follow-up planner-owned successor routing — 2026-07-15

## Scope
Repair planner/reviewer follow-up routing so planner-owned successor creation stops spawning memo-only worker leaves when the review already says the remaining action is a planner/app-ops mutation.

## Reproductions from current traffic/storage lineages

### Traffic ALB follow-up (`create-domain-followup`)
Current reviewer output in `.state/task-reviewer-runs.jsonl` records repeated `project.task.reviewed` packets for:
- `domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo`
- `domain-reconcile-traffic-draft-frontier-vs-model-20260715-followup-follo-2`

Those packets explicitly set:
- `decision = followup`
- `reviewAction.actionKind = create-domain-followup`
- `reviewAction.idBase = domain/verify-traffic-alb-ready-datapath-pair-20260715`
- `reviewAction.parentId = aks-feature-compact-loop`
- bounded outputs/acceptance/conflict scope for the exact ALB ready-pair child

Before this repair, the planner did **not** recognize `create-domain-followup`, so it created another review/backlog leaf whose goal was still “planner/app-ops should create …” instead of creating the concrete domain child.

### Storage CSI follow-up (`task-tree-followup`)
Current reviewer output in `.state/task-reviewer-runs.jsonl` records repeated `project.task.reviewed` packets for:
- `domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup-`
- `domain-reconcile-storage-csi-holder-vs-model-20260715-followup-followup--2`

Those packets explicitly set:
- `decision = followup`
- `reviewAction.actionKind = task-tree-followup`
- goal text saying planner/app-ops must create `domain/restore-storage-csi-file-nfs-unmount-boundary-executable-split-20260715` under `aks-feature-compact-loop` using the exact recorded add command

Before this repair, the planner did **not** recognize `task-tree-followup`, so it created another `aks-explorer` leaf whose goal again told planner/app-ops to add the child. That is the memo-only loop this task asked to stop.

## Root cause in app code
In `workflows/project-planner.ts`, planner routing already had explicit handling for:
- `app-state-repair`
- `publish-domain-repair-and-rerun`
- `schedule-domain-rerun`

But it had no bounded handling for:
- `create-domain-followup`
- `task-tree-followup`

Because of that, `createReviewedSuccessor()` fell back to generic successor creation using the reviewed leaf’s owner/parent context. For the live traffic/storage reproductions, that meant creating another worker-facing leaf instead of either:
- creating the requested concrete domain child directly, or
- creating one app-owned apply task for planner-owned tree mutation.

## Landed app-side repair
### Code
Updated `workflows/project-planner.ts` to:
1. preserve exact `domain/...` ids when the review explicitly requests a concrete domain successor id;
2. route `reviewAction.actionKind = create-domain-followup` to direct planner creation of the bounded domain child named by the review packet;
3. route `reviewAction.actionKind = task-tree-followup` to one app-owned apply task (`app-ops`) instead of another memo-only domain worker leaf.

### Tests
Added planner regression coverage in `workflows/project-planner.test.ts` for both live shapes:
- storage CSI `task-tree-followup` -> app-owned apply task
- traffic ALB `create-domain-followup` -> direct concrete domain successor task

## Resulting behavior after repair
- Future `create-domain-followup` reviews create the requested concrete backlog child immediately under the specified parent.
- Future `task-tree-followup` reviews create one `app-ops` apply task instead of a new `aks-explorer` memo leaf.
- The planner no longer turns these two planner-owned successor patterns into repeated worker tasks whose only truthful output is “planner should add the successor.”

## Verification
Ran targeted planner tests covering the old and neighboring review-action paths:
- `bun test workflows/project-planner.test.ts -t "app state repair|app-state repair|create-domain-followup|task-tree-followup|origin/dev repairs"`
- Result: 6 pass, 0 fail

The passing set includes:
- existing app-state-repair routing
- existing publish-domain-repair-and-rerun routing
- new `task-tree-followup` routing
- new `create-domain-followup` routing
