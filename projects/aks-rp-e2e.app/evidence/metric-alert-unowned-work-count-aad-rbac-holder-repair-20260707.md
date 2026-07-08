# Metric alert triage — aks-rp-e2e.process.unowned-work-count (alert 2859)

- Alert id: `2859`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-07T04:06:34Z`
- Chosen operation: `fix_root_cause`

## Current measurement

A fresh direct recompute still showed a real current breach at triage time:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json
```

Observed result:

```json
{
  "measuredAt": 1783397099080,
  "value": 1,
  "sampleSize": 1,
  "note": "{\"sampledAt\":\"2026-07-07T04:04:59.098Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[],\"assignmentMismatchTasks\":[],\"recoveryUnownedSpecIds\":[\"spec.aad-rbac.nonaad-to-aadv2-migration\"]}"
}
```

So this was not a stale alert row. The only current contributor was `recoveryUnownedSpecIds=["spec.aad-rbac.nonaad-to-aadv2-migration"]`.

## Root cause

The spec-loop state still points `spec.aad-rbac.nonaad-to-aadv2-migration` at task id `hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707k`, but that task is already `done` and has no structured blocker. The later replacement tasks (`...20260707m` and the active shared diagnosis leaf) also no longer preserve a blocked owner task with the exact spec conflict scope in an open state.

Direct inspection at triage showed:

- `.state/spec-loop/state.json` entry for `spec.aad-rbac.nonaad-to-aadv2-migration`:
  - `status: pending`
  - `taskId: hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707k`
  - `review.pendingReviewTaskId: hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707k`
- task `hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707k` in `.state/tasks/tree.json`:
  - `state: done`
  - `blocker: null`
  - replaced by a later holder, so it no longer counts as a live owner representation for the sampler.

That combination makes the metric correctly treat the spec as recovery-unowned.

## Concrete repair applied

I restored an explicit open holder task for the exact spec frontier using the project task-tree safe write path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree add hold-spec-aad-rbac-nonaad-to-aadv2-self-contained-create-frontier-20260707n \
  --parent aks-spec-verification-loop \
  --state blocked \
  --priority P2 \
  --goal "Preserve the exact blocked frontier for spec.aad-rbac.nonaad-to-aadv2-migration after terminal run 28618780143 proved the shared recovery carrier was not self-contained and never reached managed-cluster create or migration assertions." \
  --output ../aks-rp-e2e/evidence/archive/metric-alert-unowned-work-count-aad-rbac-holder-repair-20260707.md \
  --acceptance "Run 28618780143 remains the controlling witness and no unchanged rerun is truthful until a self-contained create-reaching carrier exists or stronger evidence reclassifies the branch." \
  --conflict-scope spec:spec.aad-rbac.nonaad-to-aadv2-migration \
  --blocker "Blocked on the reviewed nonaad-to-aadv2 self-contained-create frontier: terminal run 28618780143 proved the shared recovery carrier was not self-contained and never reached managed-cluster create or migration assertions. Resume: Resume only when a self-contained create-reaching carrier exists for spec.aad-rbac.nonaad-to-aadv2-migration or stronger accepted evidence reclassifies the same branch." \
  --blocker-category external-wait \
  --blocker-owner human \
  --resume-condition "Resume only when a self-contained create-reaching carrier exists for spec.aad-rbac.nonaad-to-aadv2-migration or stronger accepted evidence reclassifies the same branch."
```

This changed the live tree from "spec points at a done placeholder" to "spec now has an open blocked holder with exact `spec:spec.aad-rbac.nonaad-to-aadv2-migration` scope and structured blocker metadata".

## Why this is `fix_root_cause`

The metric breach was real and locally fixable. The problem was not the metric definition; it was missing live task-tree ownership for an exact pending spec-loop frontier. The repair was to re-establish that owner representation in the canonical task tree.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unowned-work-count`.

Expected result: the metric should return to `0` because `spec.aad-rbac.nonaad-to-aadv2-migration` now has an open blocked holder task again.
