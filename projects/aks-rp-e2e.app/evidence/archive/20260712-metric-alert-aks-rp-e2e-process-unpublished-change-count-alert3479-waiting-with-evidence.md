# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3479)

- Alert id: `3479`
- Judged at: `2026-07-12T17:59:41Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `2`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real and currently worse than the snapshot

Runtime metric state at alert time was:

- metric `aks-rp-e2e.process.unpublished-change-count`
- `current = 2`
- `threshold = 0`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count`

Fresh recompute during this triage returned:

```json
{"measuredAt":1783867590421,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":6}
```

So this is not a stale alert row and not a measurement bug. The breach is real, and the unpublished surface has increased since the last metric snapshot.

## Exact unpublished surface in the domain repo

Fresh `git status --short` in `/app/projects/aks-rp-e2e` showed six tracked modified files:

```text
M features/rp-cluster-lifecycle/compact/staging.diagnostics.json
M features/rp-cluster-lifecycle/compact/staging.plan.json
M features/rp-cluster-lifecycle/compact/staging.summary.md
M features/rp-cluster-lifecycle/specs/rp-available-agent-pool-versions.json
M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json
M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-upgrade-k8s-version.json
```

The diff is coherent RP cluster lifecycle domain work, not app-runtime noise:

- compact summary/plan/diagnostics reclassify the family frontier from `7` quarantined members to `5`
- `spec.rp-cluster-lifecycle.stop-start` is being reclassified from `draft/source-grounded` to `environment/reviewed-exception`
- the new stop-start reason explicitly waits on exact Azure DevOps run `171798563` artifact recovery
- `upgrade-k8s-version` and `available-agent-pool-versions` are removed from the compact frontier's current quarantined branch

## Why this is a wait, not an app-side fix

This metric counts unpublished domain-repo changes or unpushed local commits in `/app/projects/aks-rp-e2e`.

The owner can verify the process signal, but app-ops should not independently publish or revert AKS domain truth in feature/spec/compact files. The current edits are domain judgments about RP cluster lifecycle classification, not app orchestration residue.

The app-side task tree already carries matching process context that explains why stop-start is not ready for blind publication:

- `hold-compact-rp-cluster-lifecycle-package-partial-frontier` remains blocked on the RP cluster lifecycle compact frontier changing truthfully
- the current focus branch states that RP cluster lifecycle stop-start stays on one exact artifact-classification wait
- archive evidence repeatedly ties the stop-start branch to authenticated artifact recovery for Azure DevOps run `171798563`

So the right app-ops action is to keep the alert visible as a real wait on domain publication/classification, not to hide it or to publish domain changes from the wrong owner lane.

## Why `waiting_with_evidence` is the correct operation now

Choose `waiting_with_evidence`.

- Not `resolve_stale`: a fresh recompute returned `6`, so the breach is live.
- Not `calibrate_metric`: threshold `0` is still correct because unpublished domain repo changes are not visible to pipeline runs.
- Not `downgrade_priority`: this is still a real pipeline-visibility gap.
- Not `fix_root_cause`: clearing the metric would require publishing, reverting, or replacing domain-repo RP lifecycle classification work. That is AKS domain ownership, not app orchestration repair.
- Not `upgrade_or_escalate`: the current breach is bounded and already tied to an exact domain wait shape, not a destructive-action or policy emergency.
- Not `document_exception`: this is not an accepted long-term exception; it is active unpublished domain work.

## Exact wait, observer, and fallback

### Wait
Wait for the RP cluster lifecycle owner lane to do one truthful closure:

1. publish the six-file RP cluster lifecycle slice into the pipeline-visible repo state, or
2. revert/supersede the local slice if the classification is not ready, or
3. replace it with a sharper exact domain/task carrier that leaves no ambiguous unpublished residue.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, and
- the domain repo state in `/app/projects/aks-rp-e2e` for the six listed RP cluster lifecycle files.

### Fallback
If the next snapshot still breaches and the same six-file RP cluster lifecycle slice remains unpublished, escalate from passive wait to explicit domain-owner action request because the repo-local classification work is continuing to diverge from what the pipeline can see.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if the RP cluster lifecycle slice is published/reverted before the next snapshot.
