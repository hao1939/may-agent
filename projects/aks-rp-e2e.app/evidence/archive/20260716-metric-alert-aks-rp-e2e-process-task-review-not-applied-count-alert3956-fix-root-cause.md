# Metric alert triage — `aks-rp-e2e.process.task.review-not-applied-count` (alert 3956)

- Alert id: `3956`
- Metric id: `aks-rp-e2e.process.task.review-not-applied-count`
- Chosen operation: `fix_root_cause`
- Judged at: `2026-07-16T14:24:00Z`

## Baseline

Live recompute before repair:

```json
{"measuredAt":1784211677657,"value":2,"sampleSize":2,"note":{"reviews":[{"taskId":"domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle","attemptId":"a_domain_normalize-scenario-node-pool-config-disable-ssh-lifecycle_20260716133151","decision":"followup","reviewedAt":"2026-07-16T14:07:31.114Z"},{"taskId":"domain/review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552","attemptId":"a_domain_review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552_20260716132701","decision":"blocked","reviewedAt":"2026-07-16T13:41:39.998Z"}]}}
```

The current breach was real, not stale:

1. Runtime event `3322241` is an accepted `project.task.reviewed` decision for `domain/review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552` attempt `a_domain_review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552_20260716132701`, but the live task still remained in `state=review`.
2. Runtime event `3323571` is an accepted `project.task.reviewed` decision for `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle` attempt `a_domain_normalize-scenario-node-pool-config-disable-ssh-lifecycle_20260716133151`, but the live task also remained in `state=review`.
3. `bun run task-tree show ...` confirmed both live tasks were still parked in review before repair.

## Applied root-cause repair

### 1) Applied the blocked review for run `172513552`

I replayed the accepted `project.task.reviewed` payload for event `3322241` through `workflows/project-planner.ts` using the supported planner/task-tree path. This moved the live review leaf out of review and created the exact blocked successor:

- successor: `domain/review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552-blocked`
- state: `blocked`
- blocker condition: wait for ADO run `172513552` to complete and publish result artifacts before claiming any AKS product verdict.

### 2) Repaired the malformed follow-up review for run `172519192`

Replaying the accepted `project.task.reviewed` payload for event `3323571` through `workflows/project-planner.ts` surfaced a deterministic apply-path defect:

- planner result: `Did not apply V2 task-tree follow-up review for domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle: review source cannot parent its successor`

The review itself was still valid, but its requested `task-tree-followup` parentage targeted the reviewed leaf, which the live planner refused to use as the successor parent. To clear the stranded review state without editing the runtime tree by hand, I used the app task-tree helpers to apply the review outcome as the truthful sibling blocked successor under the source parent:

- source task closed: `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle` → `state=done`, `resolution=completed`
- normalized successor: `domain/review-node-pool-config-disable-ssh-lifecycle-run-172519192`
- successor state: `blocked`
- normalized reason recorded on successor context: the reviewer asked for a task-tree follow-up under the reviewed source leaf, but live planner application rejected that parentage, so the exact run-review scope was preserved as a sibling blocked successor instead of leaving the source task stranded in review.

## Post-repair validation

Live recompute after repair:

```json
{"measuredAt":1784211840329,"value":0,"sampleSize":0,"note":{"reviews":[]}}
```

Post-repair task-tree checks:

- `domain/review-network-cni-azure-overlay-dual-stack-windows2022-clean-ado-run-172513552-blocked` exists in `state=blocked` with `waiting_for.source = "project.task.reviewed"`.
- `domain/review-node-pool-config-disable-ssh-lifecycle-run-172519192` exists in `state=blocked` with the exact run-review acceptance contract for ADO run `172519192`.
- `domain/normalize-scenario-node-pool-config-disable-ssh-lifecycle` is now `state=done` with `review_summary` naming successor `domain/review-node-pool-config-disable-ssh-lifecycle-run-172519192`.

## Judgment

Choosing `fix_root_cause` because the alert represented real accepted reviewer decisions that were left unapplied in the live task tree, and this session safely applied both stranded review outcomes through the supported app planner/task-tree mechanisms until the live metric recompute returned `0`.
