# Metric alert triage — `aks-rp-e2e.model.blocked-path-count` — alert `3306`

- Metric id: `aks-rp-e2e.model.blocked-path-count`
- Alert id: `3306`
- Judged at: `2026-07-12T17:59:41Z`
- Chosen operation: `upgrade_or_escalate`

## Judgment

The breach is still real and current (`10 > 9`), and the previous `waiting_with_evidence` posture is no longer sufficient.

This alert has now repeated across multiple owner sessions without recovery, and the live app task tree is no longer showing active or review frontier motion that could reasonably burn the count down on its own. The metric remains correctly calibrated, but the project is motion-starved on this residue. Because this session has no safe runtime write path to reprioritize the metric or dispatch new live task-tree work, the correct final operation is `upgrade_or_escalate`.

## Evidence checked

### The metric still breaches now

Fresh recompute from the metric source command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.model.blocked-path-count
```

Result:

- `10`

That still matches the runtime metric row (`current=10`, `threshold=9`, `target=0`), so this is not a stale alert.

### The metric contract is still narrow and intentional

From `scripts/project-metrics.ts`, `blockedPathCount()` only counts feature paths where:

- `status === "blocked"`
- `terminal !== true`
- `remediationStatus` is neither `terminal` nor `awaiting-external`
- both `resumeCondition` and `retestCondition` are still empty

So the metric is already excluding accepted terminal paths, accepted external waits, and blocked paths that already have an exact wait contract.

### Exact remaining blocked model paths still counted now

Fresh model inspection against `/app/projects/aks-rp-e2e/model/knowledge-map/model.json` returned these exact `10` counted paths:

1. `path.net-integration.multinic-mixed`
2. `path.secops-identity-binding-system-assigned`
3. `path.app-monitoring.appmonitoring-vm-prerelease`
4. `path.ccp.tunnelfront-konnectivity-migration`
5. `path.cluster-autoscaler.vm-prerelease-spot`
6. `path.fleet.auto-upgrade-generate-matrix`
7. `path.localdns.multipool-consistency`
8. `path.localdns.windows-nodepool`
9. `path.network-cni.vm-prerelease-calico-eno-migration-matrix`
10. `path.secops-fips.automatic-sku`

All ten still have empty `resumeCondition` and `retestCondition`, and none are currently represented as accepted terminal or accepted external-wait closures.

### Prior wait judgment has gone stale because frontier motion collapsed

Fresh `bun scripts/task-tree.ts summary` now shows:

- `counts.done = 1`
- `counts.blocked = 129`
- `frontier.active = []`
- `frontier.review = []`
- blocked frontier includes both loop holders and many blocked waits

So unlike the prior `waiting_with_evidence` judgments, the project no longer has active or review frontier motion that could reasonably reduce this metric on the next cycle without intervention.

### Repetition across owner sessions without recovery

The alert has remained open since alert `3306` was created, and the metric snapshots stayed flat at `10` across repeated recent samples. The prior archived triage notes on `2026-07-09`, `2026-07-10`, and `2026-07-11` all chose `waiting_with_evidence`; the current live facts no longer support that same judgment because the count has not recovered and frontier motion has collapsed to zero.

## Why not another operation

- **Not `resolve_stale`**: fresh recompute still returns `10`.
- **Not `calibrate_metric`**: the metric already excludes terminal/external-wait/exact-wait cases and is surfacing exactly the intended residue.
- **Not `fix_root_cause`**: the remaining work is domain/model closure plus project-motion repair, and this session has no safe live task-tree or runtime metric write path to dispatch or reprioritize that work.
- **Not `downgrade_priority`**: the issue is less ignorable now than before because the project has no active/review motion on the residue.
- **Not `document_exception`**: these 10 paths are not documented accepted exceptions.
- **Not `waiting_with_evidence`**: the wait posture depended on ongoing frontier motion, and that factual basis is gone.

## Escalation request recorded in project context

Requested owner/human decision:

1. either restore live motion against these 10 blocked model paths by creating or dispatching bounded domain/model closure work,
2. or explicitly accept/calibrate the metric if some of these paths are intentionally allowed to remain blocked without exact wait contracts,
3. or raise metric priority/blocker text so the project monitor stops treating this as a passive `P3` watch item.

This project-context escalation is recorded here because the current session only has read-only DB inspection and filesystem evidence tools, not a safe runtime write or notification path.

## Next validation

Validate on the next `metrics-snapshot` or sooner after planner/human intervention. If the metric remains `> 9` while `frontier.active` and `frontier.review` stay empty, keep the escalation active rather than reverting to passive waiting.
