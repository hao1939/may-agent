# AKS App Design

Status: convention-first reconciliation is the current operating model.

The canonical cross-app design is
[`task-resource-engine.md`](../../may-agent.app/docs/2a-design/task-resource-engine.md).
This directory contains AKS domain history and older migration notes; when a
note conflicts with the canonical model or current `app.ts`, the canonical
model wins.

The implemented AKS-specific task-state cleanup is recorded in
[`task-graph-integrity-and-simplification-proposal.md`](task-graph-integrity-and-simplification-proposal.md).

## Current model

```text
semantic event
  -> app resolves desired task
  -> one controller queue per app
  -> workflow by filename, otherwise owner
  -> structured result
  -> generic reconciler atomically applies actions and Conditions
```

Responsibilities are deliberately narrow:

- App: organizes goals, ownership, relationships, events, and reusable
  workflows.
- Task: records desired and observed state. It is not a job or scheduling
  queue.
- Workflow: preserves a repeatable process learned from prior work.
- Agent: provides adaptive capability and the accountability fallback.
- Runtime: schedules attempts, enforces concurrency, persists state, rejects
  stale results, wakes Conditions, and performs recovery.

## AKS conventions

- `app-ops` owns app organization and unfamiliar semantic events.
- `aks-explorer` owns AKS domain judgment.
- Repeated domain processes become workflows; one-off work can go directly to
  its owner.
- Finished achieve tasks are absorbed into receipts and removed from the live
  graph.
- Exact external waits are typed Conditions, not polling tasks.
- Parent/child views are derived from canonical resources and structural
  groups; they do not acquire independent scheduling state.
- Workflows and agents never edit `.state/tasks/tree.json` directly.

## Active reusable processes

- `focus-plan`
- `project-stall-review`
- `approval-dispatch`
- `problem-solver`
- `spec-loop-controller`
- `feature-compact-loop-controller`
- `normalize-scenario-frontier`
- `wait-for-repo-ref-advance`

The standing loop workflows observe their domain ledgers, declare only the
free-capacity portion of bounded sibling work, and converge once current work
is represented. External waits belong to finite leaves and use exact typed
Conditions. Several loop or focus task instances may use the same workflow
independently.

A spec-loop row with a reviewed disposition is not enough by itself. If the
agent decides a spec should not rerun, that decision must be controller-visible
as either `terminalDisposition: true` or one exact live holder task referenced
by the row. If a row has structured disposition fields but no visible holder
and no terminal flag, the controller routes a bounded representation-repair task
instead of recreating generic verification work.

## Experience and finished work

Experience is retained where it can improve future work:

- workflow code and tests for repeatable process;
- skills and design for reusable judgment;
- domain specs, models, and evidence for AKS facts; and
- compact completion receipts for dependency wakeup and audit.

Keeping finished task nodes in the live graph, or maintaining a second mutable
archive tree, is not an experience mechanism.
