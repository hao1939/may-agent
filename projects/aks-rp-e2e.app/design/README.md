# AKS App Design

Status: convention-first reconciliation is the current operating model.

The canonical cross-app design is
[`task-resource-engine.md`](../../may-agent.app/docs/2a-design/task-resource-engine.md).
This directory contains AKS domain history and older migration notes; when a
note conflicts with the canonical model or current `app.ts`, the canonical
model wins.

The implemented AKS-specific task-state cleanup is recorded in
[`task-graph-integrity-and-simplification-proposal.md`](task-graph-integrity-and-simplification-proposal.md).

The current audit and incremental plan for removing AKS-specific scheduling in
favor of the unified controller is recorded in
[`unified-task-reconciliation-review.md`](unified-task-reconciliation-review.md).

The implemented standing-loop contract and liveness refinement is recorded in
[`loop-task-contract-and-liveness-proposal.md`](loop-task-contract-and-liveness-proposal.md).

The implemented AKS-local workspace cleanup and task-owned Git lifecycle is
recorded in
[`task-workspace-and-git-lifecycle-proposal.md`](task-workspace-and-git-lifecycle-proposal.md).

The finite edit, exact live-test, fix-forward, PR, and merge process for AKS
spec changes is defined in
[`spec-live-reconciliation.md`](spec-live-reconciliation.md).

The autonomous six-hour `main` master-validation cycle, progressive failure
handling, exact test-fix proof, and product-recovery rules are defined in
[`master-validation-reconciliation.md`](master-validation-reconciliation.md).
Its runner-to-ADO-to-watcher live progress convention is defined in
[`live-test-progress-observability-proposal.md`](live-test-progress-observability-proposal.md).

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

AKS owns neither May Runtime source nor its deployment. An AKS compatibility
task may test the current Host and reload current App definitions. A Runtime
change is a request to the `may-agent` App and is deployed only by a May-owned
task from a candidate containing current canonical May source. An old release,
worktree, receipt, or previously working event is diagnostic evidence, not
rollout authority.

## Domain task reconciliation

The task owns the durable loop; one workflow run is one bounded iteration:

```text
same AKS task
  -> read current repository/provider/artifact facts
  -> aks-explorer chooses and performs the next in-scope move
  -> workflow verifies mechanically
  -> local failure feeds a changed repair iteration
  -> external fact becomes an exact Condition
  -> later fact wakes the same task and workflow
  -> accepted proof converges the task
```

Domain workflows handle the work they know how to do. Merge conflicts, test
failures, stale implementations, and rejected hypotheses are feedback for the
agent inside the same task; they are not `blocked`, `attention`, or a reason to
create a repair task. A workflow run remains bounded and yields while ADO, a
pull request, or another external fact is pending. Escalation is reserved for
a required action outside `aks-explorer` ownership. `needs-owner` is only the
exceptional same-owner fallback after the learned workflow has exhausted its
safe in-scope moves.

## AKS conventions

- `app-ops` owns app organization and unfamiliar semantic events.
- `aks-explorer` owns AKS domain judgment.
- A wait remains owned by the agent that must act after the Condition wakes.
  `needs-owner` returns to the task owner, so a domain repo-ref wait explicitly
  keeps `owner: "aks-explorer"`; attaching a wait workflow must not transfer it
  to `app-ops`.
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
- `spec-live-reconciliation`
- `master-validation-cycle`
- `master-validation-failure`

Focus planning reads the current task projection and durable local runtime
evidence. Its live-run metrics count aggregate pipeline result artifacts kept
by the app observer as well as repository execution results; they do not query
the provider or infer "no live work" merely because the repository has no
local `runs/executions` copy.

The standing loop workflows observe their domain ledgers, count only actionable
pending/running leaves against their bounded frontier, and converge once the
current pass is synced. Exact waits preserve coverage without consuming an
actionable slot. A loop-owned leaf is a direct child; its meaningful transition
wakes the loop through the generic controller. Periodic pulses remain recovery.
External waits belong to finite leaves and use exact typed Conditions.

A standing-loop leaf represents only the `workRevision` in its task input.
Materially changed feature/spec facts create a new revision even when an older
subset wait remains true; that wait is preserved, but it cannot hide newly
runnable work in the same feature.

A repo-ref wait is scoped to both the ref and the commit being waited past.
Its Condition identity includes that baseline commit, and its expected fact is
`observed commit != baseline commit`. When multiple unrelated holders can wait
on the same repo ref from the same baseline, the Condition identity must also
include holder scope (for example the waiting task id) so those waits can sleep
independently without colliding on one shared condition row. An event that
advanced the ref _to_ the baseline cannot satisfy a later wait for the next
advance. Reusing a generic "origin/dev changed" Condition across baselines or
across unrelated same-baseline holders creates stale-true waits or rejected
rebinds and must not be used.

A master-validation capacity wait follows the same rule. The finite task
records the current six-hour `cycleSlot`, waits for
`aks.master-validation.capacity-pulse` with `cycleSlot != baseline`, and gives
the Condition a task-scoped identity. Capacity pulses are fresh level
observations: an older journal pulse or a duplicate pulse from the baseline
slot cannot wake a newly established wait; the next slot wakes it once.

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

Representation repair is still spec-loop domain work, so it receives the same
current-evidence and live-verification guidance as an ordinary spec leaf. A
workflow or authentication failure from a retired execution backend is stale
process evidence, not a current terminal blocker. After the move to ADO, a
ready spec previously stopped by GitHub Actions authentication must be
re-evaluated on ADO or retain one exact blocker that still exists on ADO.

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

For an ordinary finite spec leaf, `spec-live-reconciliation` keeps source edit,
exact live proof, fix-forward, direct integration into `dev`, and ancestry
verification on the same task generation and task branch. If current `dev`
advanced, the workflow merges it into the tested task branch so the tested
commit remains in ancestry; a conflict returns to agent repair and requires a
fresh live run. Pull requests are reserved for promotion into `main`. Pipeline
and PR watchers emit provider facts where those facts are actually needed; the
generic Condition tracker performs correlation. Disposition repair and
read-only investigations do not use this workflow.

Executable compact-package repair uses the same workflow boundary. Bind the
same compact task to `spec-live-reconciliation` with the complete feature
`specIds`, checked-in `livePlanPath`, fixed target, and any prepared
`sourceBranch`/`sourceCommit`. The workflow reconciles that prepared source into
the current task worktree, publishes the exact resulting commit, runs the
compact plan, validates every selected spec and cleanup artifact, and integrates
only the passing tested source into `dev`. `domain-task-execution` remains for
source-only patches whose acceptance does not require live behavior proof; it
must not be used as an intermediate publication step for an executable compact
package.

The pipeline observer polls represented ADO runs every minute. A terminal run
is a wake fact for an occupied live slot, so leaving it unseen for a five-minute
cadence adds avoidable dead time to every normalization wave. The observer only
collects provider state; the domain agent still judges the returned evidence.

For bounded source-only patches, `domain-task-execution` lets the agent judge
and commit the change, then workflow code integrates the clean branch directly
into `dev`. Direct integration replays only commits created by the current
bounded agent turn onto current `origin/dev`; a stale task branch is never
published wholesale, and a no-change review cannot advance `dev`.

Any newly declared task whose acceptance requires a generic bounded repository
patch must bind `workflow: "domain-task-execution"` when it is created. An
unbound owner task is shared/read-only; it may inspect and route work, but it
must not edit or publish from the canonical checkout and must not rely on a
later recovery pass to add the missing workflow.

Scenario normalization is source-only only when every consuming
spec has explicit structured nonlive policy and the domain agent confirms that
posture from current evidence; code validates the policy and records no live
pass. A changed runnable scenario carrier instead uses the same exact lifecycle
as spec reconciliation: push the task branch, queue ADO pipeline `467665` for
every consuming spec at that commit, wait on the exact run, let the agent
diagnose and repair any failure in the same worktree, and integrate only the
passing tested commit into `dev`. A local check or an untested merge cannot
converge runnable normalization work.

A conflict returns to the same agent and task for repair; an unintegrated task
branch cannot converge. Its structured result is the current task's state
transition, so typed actions may change other tasks but must never target the
currently running task; an invalid self-action is fed back to the same agent for
correction before the result reaches the reconciler.

## Experience and finished work

Experience is retained where it can improve future work:

- workflow code and tests for repeatable process;
- skills and design for reusable judgment;
- domain specs, models, and evidence for AKS facts; and
- compact completion receipts for dependency wakeup and audit.

Keeping finished task nodes in the live graph, or maintaining a second mutable
archive tree, is not an experience mechanism.
