# AKS App Design

Status: convention-first reconciliation is the current operating model.

The canonical cross-app design is
[`task-resource-engine.md`](../../may-agent.app/docs/2a-design/task-resource-engine.md).
This directory contains AKS domain history and older migration notes; when a
note conflicts with the canonical model or current `app.ts`, the canonical
model wins.

The implemented AKS-specific task-state cleanup is recorded in
[`task-graph-integrity-and-simplification-proposal.md`](task-graph-integrity-and-simplification-proposal.md).

The implemented standing-loop contract and liveness refinement is recorded in
[`loop-task-contract-and-liveness-proposal.md`](loop-task-contract-and-liveness-proposal.md).

The implemented AKS-local workspace cleanup and task-owned Git lifecycle is
recorded in
[`task-workspace-and-git-lifecycle-proposal.md`](task-workspace-and-git-lifecycle-proposal.md).

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

The standing loop workflows observe their domain ledgers, count only actionable
pending/running leaves against their bounded frontier, and converge once the
current pass is synced. Exact waits preserve coverage without consuming an
actionable slot. A reconciled structured leaf wakes its loop through one app
event fan-in; periodic pulses remain recovery. External waits belong to finite
leaves and use exact typed Conditions.

For strict scenario-test inventory, the cleanliness standard is row coverage:
zero missing adapters, or every current missing adapter represented by exact
actionable work, exact accepted wait, reviewed terminal disposition, or
escalation. Do not keep the loop in attention merely because all current rows
are covered by exact waits and there are no runnable leaves; that is a truthful
wait-covered frontier, not a process failure. The runnable minimum is only a
refill target when unrepresented rows remain.

A spec-loop row with a reviewed disposition is not enough by itself. If the
agent decides a spec should not rerun, that decision must be controller-visible
as either `terminalDisposition: true` or one exact live holder task referenced
by the row. If a row has structured disposition fields but no visible holder
and no terminal flag, the controller routes a bounded representation-repair task
instead of recreating generic verification work.

## Learned workflow rules

When repeated work teaches a better path, put the lesson into the reusable
workflow that creates the next task. Do not add a separate checklist that the
worker may never read, and do not make code guess AKS product truth from prose.
Code should collect facts and route work; the domain agent decides from current
evidence.

The canonical learned checklists live with the standing-loop contract in
`task-loops.ts`. The loop task itself and every bounded leaf created by the
controller should reuse the same checklist, so a human pulse, a watchdog pulse,
and an automatic refill all create work with the same expectations.

Spec-loop leaves must push the agent toward a self-contained live proof: inspect
current spec/model/runner/result facts first, compare nearby good and bad
same-family examples, keep the staging target explicit, create owned resources
when the spec needs real AKS behavior, prefer shared runner helpers and repo
REST/API helpers over new `az` shell behavior, avoid mounted private AKS RP
source and hidden precreated clusters, verify the branch/commit ADO will run
before dispatch, queue a fresh ADO run after any meaningful carrier/spec/model
change, and return exact structured ADO waits. A fast no-cluster pass is not
live AKS proof unless the spec is explicitly source-only. A terminal ADO run is
not automatically a spec verdict: queued runs wait, terminal runs without
artifacts need timeline/log inspection, and artifact reviews must preserve the
structured pass/fail/error status separately from reviewer acceptance.

Compact-loop leaves must push the agent toward useful compaction: cover every
feature-owned spec or explain its exclusion, group only compatible route shapes,
prefer one or two real clusters when shapes are compatible, show selected specs
plus required/saved clusters, run through the same live target wiring as single
specs, ingest mixed live results per spec branch, preserve branch passes from
nonpassing aggregates, and repair the smallest failing branch or selection
blocker before rerunning an unchanged feature package. A package that selects
many specs but still needs nearly one cluster per spec is not really compacted;
the worker should split by compatible route group or repair eligibility before
spending another live run.

The practical loop is simple: learn from one real pass or failure, update the
shared standing-loop checklist in `task-loops.ts`, and let the controllers put
that checklist into every future spec or compact leaf. The app stays the
organizer; the domain agent still decides from hot facts and current evidence.

## Experience and finished work

Experience is retained where it can improve future work:

- workflow code and tests for repeatable process;
- skills and design for reusable judgment;
- domain specs, models, and evidence for AKS facts; and
- compact completion receipts for dependency wakeup and audit.

Keeping finished task nodes in the live graph, or maintaining a second mutable
archive tree, is not an experience mechanism.
