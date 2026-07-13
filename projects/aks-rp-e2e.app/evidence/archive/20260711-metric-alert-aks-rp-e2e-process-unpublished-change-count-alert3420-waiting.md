# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3420)

- Alert id: `3420`
- Judged at: `2026-07-11T17:23:55Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `1`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

The runtime metric row still reports a live breach:

- metric `aks-rp-e2e.process.unpublished-change-count`
- `current = 1`
- `threshold = 0`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count`

Fresh recompute from `/app/projects/aks-rp-e2e.app` matched the runtime row exactly:

```json
{"measuredAt":1783760164027,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1}
```

Fresh repo status from `/app/projects/aks-rp-e2e` also matched the metric surface exactly:

```text
## dev...origin/dev
 M model/knowledge-map/model.json
```

So this alert is not stale and not a measurement bug.

## Exact unpublished surface

The only current unpublished domain-repo change is `model/knowledge-map/model.json`.

Current diff content is limited to path-model wording for two already-represented domain families:

1. `row-161` / `path.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease`
   - changes the draft path wording to require exact same-run artifact review for rerun `28592745619` before any unchanged rerun.
2. `path.rp-nodepool-lifecycle.multi-agentpool-runner`
   - changes the path wording to preserve the carrier as `source-check-only/nonlive` rather than a standalone live replay.

These are real domain-truth edits, not app-state/runtime cache noise.

## Current task-tree context

The current active app-ops task is:

- `ops-apply-repair-overdue-compact-frontier-family-20260711-state-repair`

Its accepted outputs are task-tree and `.state/*` repairs only; it does **not** name `model/knowledge-map/model.json` as an output, so it is not a truthful visible owner for this domain-repo diff.

At the same time, the task tree already preserves the affected domain families as blocked frontier holders:

- `hold-compact-rp-nodepool-lifecycle-package-partial-frontier` explicitly names `spec.rp-nodepool-lifecycle.multi-agentpool-runner` in its blocker/resume condition.
- the rp-cluster-lifecycle split frontier blocker explicitly says bounded live authoring/narrowing can change `spec.rp-cluster-lifecycle.new-vnet-lifecycle-vm-prerelease`.

That means the **families** touched by the diff are represented, but the **new local unpublished model edit itself** is not yet visibly owned by a dedicated task or checkpoint.

## Why `waiting_with_evidence` is the correct operation now

Choose `waiting_with_evidence`.

- Not `resolve_stale`: fresh recompute and direct git state both still show `1`.
- Not `calibrate_metric`: threshold `0` remains correct because unpublished domain-repo edits are not visible to pipeline runs.
- Not `downgrade_priority`: this is still a real pipeline-visibility gap.
- Not `fix_root_cause`: the safe root-cause fix would be to publish, revert, or replace the domain-repo model change with a truthful checkpoint/task decision, but that would require changing AKS domain state rather than app-only process state. In this session, there is already a concurrent app-ops planner wake for the same metric breach (`s_project_planner_planning_update_20260711085526_8x2py4`) deciding whether to create visible repo-hygiene ownership or clear the residue.
- Not `upgrade_or_escalate`: the breach is real, but current evidence points to one bounded unpublished domain edit, not a destructive-action emergency.

## Exact wait, observer, and fallback

### Wait
Wait for the current planner wake for this same metric breach to finish and do one of these truthful closures:

1. clear the local domain-repo residue by publication/revert/replacement, or
2. create a visible task/tree carrier that explicitly owns the `model/knowledge-map/model.json` unpublished slice.

### Observer
`app-ops` rechecks via:

- completion of planner session `s_project_planner_planning_update_20260711085526_8x2py4`, and
- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`.

### Fallback
If that planner session finishes and the metric still reads `1` with no visible repo-hygiene/domain owner for the file, reopen as a stronger process action: create the exact owning task immediately if safe, or escalate the unowned domain residue as `upgrade_or_escalate`.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner after planner session `s_project_planner_planning_update_20260711085526_8x2py4` ends.