# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3639)

Date: 2026-07-14
Owner: app-ops
Chosen operation: `waiting_with_evidence`

## Metric facts checked

- metric id: `aks-rp-e2e.process.unpublished-change-count`
- alert id: `3639`
- metric row at triage time: `current=10`, `threshold=0`, `target=0`, `priority=P0`
- direct recompute from `/app/projects/aks-rp-e2e.app` returned `value=11`
- domain repo branch relation: `origin/dev...HEAD = 0 0` (no unpublished commits to push)

## Live unpublished surface

Current domain repo status in `/app/projects/aks-rp-e2e` is exactly:

```text
 M evidence/pipelines/virtualmachine-prerelease-coverage.json
 M evidence/pipelines/virtualmachine-prerelease-coverage.md
 M evidence/pipelines/virtualmachine-prerelease.json
 M features/secops/compact/staging.diagnostics.json
 M features/secops/compact/staging.plan.json
 M features/secops/compact/staging.summary.md
 M features/secops/packets/identity-user-assigned-lifecycle-vm-prerelease.yaml
 M features/secops/specs/secops-identity-user-assigned-lifecycle-vm-prerelease.json
 M model/knowledge-map/model.json
 M model/knowledge-map/views/graph-view.json
?? evidence/pipelines/virtualmachine-prerelease-coverage.features.txt
```

That is `10` tracked changes plus `1` untracked artifact, which matches the producer's current `value=11`.

## Why this is a real alert but not a safe immediate publish

This is **not** a stale or miscalibrated metric:

- the threshold `0` is still correct because these domain-repo changes are not visible to pipeline runs until they are checkpointed and pushed;
- the measurement is live and currently breaching (`11`);
- there is no hidden ahead commit backlog to publish right now.

But the current dirty surface is also **not unowned residue**. The current task tree shows the worktree is fully represented by three freshly completed domain review tasks:

1. `domain/refresh-vm-prerelease-mounted-inventory-parity-20260714` (`state=review`)
   - evidence includes `evidence/pipelines/virtualmachine-prerelease-coverage.features.txt`
   - also touches maintained VM-prerelease coverage artifacts
2. `domain/normalize-vmpr-mounted-source-anchors-secops-trusted-access-20260714` (`state=review`)
   - evidence includes the exact five secops files plus the two knowledge-map files
3. `domain/reconcile-vmpr-selector-holder-parity-localdns-managedsystem-20260714` (`state=review`)
   - evidence includes `evidence/pipelines/virtualmachine-prerelease.json` and maintained coverage artifacts

So the breach is currently explained by **review-owned domain output awaiting planner review/checkpoint**, not by a lost owner, a stale DB row, or an already-publishable ahead commit.

## Decision

Choose `waiting_with_evidence`.

Reason: app-ops can prove the breach is real, but the smallest truthful next change is not blind publication or revert. The current 11-file surface is already bounded by exact review tasks whose outputs overlap the dirty files. Publishing before those review tasks are accepted would mix unreviewed domain changes into a checkpoint. The correct next process move is planner review/acceptance of those three review leaves, then a coherent domain checkpoint/push if accepted.

## Not chosen

- Not `fix_root_cause`: there is no safe one-command push or revert available because the repo is not ahead of `origin/dev`; the remaining surface is uncommitted review output, not a publishable local-commit backlog.
- Not `resolve_stale`: live recompute still returns `11`.
- Not `calibrate_metric`: threshold `0` remains correct.
- Not `downgrade_priority`: unpublished domain changes still block pipeline visibility.
- Not `document_exception`: this is temporary review-owned work, not an accepted long-term exception.
- Not `upgrade_or_escalate`: no destructive action or human-only policy decision is required yet.

## Expected next validation

Validate on the next `metrics-snapshot` after planner review/checkpoint of the three review leaves above. If the review tasks are accepted and checkpointed, the expected next result is `metrics.current = 0`; if the next snapshot still reports `>0`, reopen as a fresh unpublished review/checkpoint backlog investigation against the then-current dirty set.
