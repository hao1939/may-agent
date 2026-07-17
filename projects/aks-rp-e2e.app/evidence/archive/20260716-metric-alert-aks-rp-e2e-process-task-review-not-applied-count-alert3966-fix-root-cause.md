# Metric alert triage — `aks-rp-e2e.process.task.review-not-applied-count` (alert 3966)

- Alert id: `3966`
- Metric id: `aks-rp-e2e.process.task.review-not-applied-count`
- Chosen operation: `fix_root_cause`
- Judged at: `2026-07-16T16:50:05Z`

## Baseline

Live recompute before repair:

```json
{"measuredAt":1784220416377,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"reviews\":[{\"taskId\":\"domain/normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716\",\"attemptId\":\"a_domain_normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716_20260716160618\",\"decision\":\"followup\",\"reviewedAt\":\"2026-07-16T16:24:44.874Z\"}]}"}
```

The current breach was real, not stale:

1. Runtime event `3332100` is a pending `project.task.reviewed` follow-up decision for `domain/normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716` attempt `a_domain_normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716_20260716160618`.
2. `bun run task-tree show domain/normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716` still showed the source task in `state = review`.
3. The reviewer payload itself proves the remaining work is an exact same-run ADO wait for run `172534702`, not a completed acceptance verdict.

## Root cause

The stored reviewer packet asked planner to apply a `task-tree-followup` successor with:

- `idBase = domain/review-ado-run-172534702-net-integration-outbound-migration-natgw-to-lb-20260716`
- `parentId = domain/normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716`

That parentage is rejected by the current V2 follow-up writer. A supported synthetic replay through `workflows/project-planner.ts` returned:

```json
{
  "status": "done",
  "message": "Did not apply V2 task-tree follow-up review for domain/normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716: review source cannot parent its successor Planner assigned 1 task(s): ops/repair-shared-ado-same-run-stall-family-normalization-20260716."
}
```

So the review itself was valid, but the follow-up parent id targeted the reviewed leaf, which left the review unapplied in the live task tree.

## Applied root-cause repair

To clear the stranded review without editing runtime files by hand, I used the supported task-tree CLI to normalize the follow-up into a truthful sibling blocked successor under the reviewed task's parent:

- created successor: `domain/review-ado-run-172534702-net-integration-outbound-migration-natgw-to-lb-20260716`
- successor parent: `domain/normalize-scenario-tests-repo-frontier-20260715`
- successor state: `blocked`
- blocker contract: exact `ado.pipeline_run.completed` wait for run `172534702` / spec `spec.net-integration.outbound-migration-natgw-to-lb`, with watchdog observation, next check, and fallback timestamps
- source task closed: `domain/normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716` → `state = done`, `resolution = completed`
- source `review_summary`: names the new successor as the truthful same-run ADO review carrier

This preserves the real remaining work: the normalization itself is done, but same-run artifact review for run `172534702` is still externally blocked.

## Post-repair validation

Live recompute after repair:

```json
{"measuredAt":1784220633436,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"reviews\":[]}"}
```

Post-repair task-tree checks:

- `domain/review-ado-run-172534702-net-integration-outbound-migration-natgw-to-lb-20260716` exists in `state = blocked` with `waiting_for.type = "ado.pipeline_run.completed"` and `waiting_for.runId = "172534702"`.
- `domain/normalize-scenario-net-integration-outbound-migration-natgw-to-lb-20260716` is now `state = done` with `review_summary` naming the successor above.
- `ado-run.json` for run `172534702` still shows `state = inProgress`, `result = null`, and `finishedDate = null`, so a blocked successor is the truthful live shape.

## Judgment

Choosing `fix_root_cause` because the alert represented one real accepted reviewer decision stranded in `state = review`, and this session safely applied that review outcome through the supported task-tree control plane until a fresh metric sample returned `0`.