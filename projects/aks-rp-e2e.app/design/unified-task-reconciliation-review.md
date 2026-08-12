# Unified Task Reconciliation Review

**Status:** Aligned in source and control flow. AKS live-history cleanup is a
bounded migration through the same shared controller, not a second scheduler.

The canonical model is the shared
[Task Resource Engine](../../may-agent.app/docs/2a-design/task-resource-engine.md).
AKS should use that model directly rather than maintain an app-specific
scheduler around it.

## Decision

Use the same Kubernetes-style contract in every task-enabled app:

```text
task = scoped desired outcome + current observed state

timer, semantic event, or Condition observation
  -> wake the stable task ID
  -> one app controller reconciles current state
  -> workflow or owner performs one bounded iteration
  -> target satisfied, exact wait, live child wait, or visible attention
```

Once awake, a task is hot until it reaches one of those stable levels. A
workflow run remains bounded and never stays suspended across ADO, Git, an
approval, or a timer.

The app remains free to decide:

- which durable outcomes deserve tasks;
- whether a goal is flat or decomposed into parallel children;
- which relationships express containment or ordering;
- whether the owner handles novel work directly or delegates a learned
  workflow; and
- which evidence proves the domain outcome.

The framework decides only task mechanics. There is no second AKS scheduler.

### Owner review is an inbox, not a work parent

`runtime/owner-review` must remain immediately runnable for a new human or
project-owner message. Finite follow-up work belongs under
`group/app-operations` or `group/domain-work`; it must not become a direct
child of the standing owner-review resource. Otherwise one long external wait
can block every later owner instruction even though the event was accepted and
durably attached to the task.

The resource-liveness migration moves any non-running legacy child to its
stable project group. Future owner-review results follow the same grouping
convention.

## What already works

The shared runtime already provides the difficult mechanics:

- one deduplicating task queue and bounded controller per app;
- current-generation claims and stale-result rejection;
- immediate queueing of tasks created or revised by admitted actions;
- atomic parent wait plus child creation;
- durable parent wake after direct-child convergence or attention;
- dependent wake after prerequisite convergence;
- exact Condition correlation and same-task wake;
- achieve receipts and removal from the live graph;
- maintain convergence and later targeted wake; and
- passive resync for recovery rather than domain scheduling.

AKS also has strong domain parts worth keeping: progressive ADO observation,
per-spec repair work, exact live verification, approval correlation, standing
master validation, and reusable workflows for repeated processes.

## Cross-app snapshot

The same 2026-08-03 read-only audit shows that the unified runtime is already
the common base, but conformance and operational health are different things:

| App        | Live resources | Main finding                                                                                                       |
| ---------- | -------------: | ------------------------------------------------------------------------------------------------------------------ |
| Scout      |        Aligned | Stable maintain resources use timer/event wakes and exact external waits.                                          |
| Gym        |        Aligned | Stable learning resources reconcile through the shared controller; legacy residue is retired.                      |
| Evaluation |        Aligned | Finite audits leave receipts and sustained backlog advances through shared capacity.                               |
| May Agent  |        Aligned | Stable maintain resources remain, obsolete tasks are retired, and one truthful finite attention task is preserved. |
| AKS        |        Aligned | Projection-only reconciliation results, generic parent/Condition wakeup, and bounded finite live-history cleanup.   |

The migration therefore converged on one framework rather than an AKS-specific
rewrite. Scout remains the small reference shape; the other apps prove that
legacy cleanup and sustained workloads both fit the shared controller.

## Starting AKS drift (historical baseline)

The pre-migration live audit on 2026-08-03 found:

- `app.ts` has 3,721 lines; the other task-enabled apps have 336–594;
- AKS is the only app that consumes `project.task.reconciled` to schedule or
  repair more work;
- that handler re-emits created-task, loop-refill, owner-handoff, repo-ref,
  task-state, malformed-wait, and waiting-frontier ticks;
- the live graph has 454 resources: 224 maintain tasks, 250 waiting tasks, and
  171 Conditions;
- internal task state is represented as external-looking Conditions, including
  `task-phase`, `task.phase`, `task-field`, and `project.task.tick`; and
- repeated repo-ref changes have produced chains of new wait tasks whose IDs
  contain successive baseline commits.

The counts are observations, not quotas. The structural problem is that
several records and event handlers have become scheduling authorities alongside
the shared controller.

### Why this hurts autonomy

The app can stop even when useful work exists because progress depends on the
right compatibility tick being rediscovered and emitted. Recovery code then
adds more ticks, holders, and review tasks, making the next recovery harder to
reason about. The task tree describes the history of scheduling work instead
of the smallest current desired state.

For example, the shared reconciler already queues a newly created child. AKS
also parses `actionsApplied`, reads `tree.json`, and emits a
`created-task-ready` tick. The second path adds latency and failure modes but no
capability. The same duplication exists for child/task-state and repo-ref
continuation.

## Target AKS shape

### Master validation example

```text
master-validation health (maintain)
  schedule every six hours or main-ref change wakes it
  -> create/revise one bounded campaign/run child
  -> pipeline watcher emits progressive semantic observations
  -> each stable failure creates/revises one repair child
  -> independent repairs run in parallel within app capacity
  -> ADO/PR/main facts are exact Conditions on the owning task
  -> child transitions wake the campaign parent
  -> full current-main pass converges the health task
  -> next schedule wakes the same maintain task again
```

The app chooses this decomposition and the domain acceptance rules. The
controller supplies queueing, sleeping, wakeup, concurrency, and recovery.

### Stable wait identity

A wait is not a new unit of work every time its observed baseline changes. Keep
one stable outcome-bearing task:

```text
same task
  -> wait for origin/main to move beyond commit A
  -> wake and inspect commit B
  -> outcome still unmet
  -> replace the consumed Condition with a wait beyond commit B
```

Create a child only when it owns an independently reviewable result. Do not
create `wait-...-<commit>` child chains merely to carry the next observation.

## Incremental convergence

Do not rewrite AKS while critical live attempts are running. Migrate one
behavioral slice at a time and keep current tasks recoverable.

1. **Separate observation from scheduling.** Keep deterministic projections
   such as spec proof and compact status, but make the
   `project.task.reconciled` listener projection-only.
2. **Remove duplicate queue paths.** Delete created-task and loop-refill ticks
   after shared-controller tests and one live canary prove immediate child and
   parent continuation.
3. **Use generic relationships.** Replace `task-phase`, `task.field`, and other
   internal Conditions with direct children or dependencies. Conditions remain
   only for provider, repository, approval, credential, or human facts.
4. **Collapse wait chains.** Reconcile successive repo-ref baselines in one
   stable task instead of generating a new holder per commit.
5. **Reduce holder state.** Convert finite `maintain` and `hold-*` resources to
   achieve tasks, receipts, or evidence on the outcome-bearing parent. Keep a
   maintain task only for a real standing responsibility.
6. **Narrow health review.** Keep one low-frequency app-health responsibility
   for integrity findings. It may wake the accountable task or owner; it must
   not scan the tree and act as a general scheduler.
7. **Keep ledgers as facts.** Spec and compact ledgers remain useful domain
   checkpoints and projections. They do not decide queue eligibility outside
   their owning reconciliation workflow.
8. **Delete compatibility repair.** After live waits are migrated, remove
   malformed-wait and owner-handoff replay code rather than preserving it as a
   permanent runtime path.

### Completed slices

- New spec, compact, and scenario loop leaves are direct children of their
  executable standing loop. Focused loop tests pass.
- Task-handler admission now rejects `project.state`, `project.task.tick`,
  `task-field`, `task-phase`, and `task.phase` as authored Conditions. The
  contract directs agents to a direct child, `dependsOn`, or an external
  observable Condition instead.
- AKS owner guidance and the spec-live workflow use the same rule, removing the
  former instruction that loop leaves must be siblings.
- AKS no longer turns `actionsApplied` into duplicate ready-task ticks. Created
  and revised tasks enter the shared controller queue directly as part of the
  atomic reconciliation result.
- Loop-refill compatibility has been deleted. All spec, feature, and scenario
  leaves now continue through shared direct-parent wakeup; the app no longer
  reconstructs loop ownership from reconciliation results.

The live graph still contains 27 internal Conditions admitted before this
guard. They are migration residue, not accepted future behavior. Retire or
reshape their owning tasks in bounded slices before removing the corresponding
`project.task.reconciled` compatibility replay.

The first live-residue migration is `project-state-holders-v1`. It closes only
a fixed allowlist of childless legacy maintain holders after rechecking their
phase, Condition type, and child topology. Any mismatch remains live, and each
action uses `expectedGeneration` so a concurrent revision is rejected at apply
time. The standing feature loop owns the next observation rather than a
project-state Condition.

The second migration is `task-state-waits-v1`. Seven named live-subject waits
become ordinary `dependsOn` relationships, and one named wait whose subject is
already absent is unblocked for fresh same-task judgment. Both paths remove the
legacy Condition and rely on shared dependency or task reconciliation.

Live proof on 2026-08-03 applied all eight guarded actions through the shared
controller and stored the migration receipt. The internal task-state Condition
count is now zero, so AKS no longer replays task-phase or task-field changes
from `project.task.reconciled`.

The third migration is `task-tick-holders-v1`. It closes the two fixed,
childless legacy compact holders that wait on `project.task.tick`. Future
review is owned by the stable feature loop, which timers and semantic events
wake directly through the shared controller. Mismatched holders remain
untouched, and `expectedGeneration` protects the read-to-apply boundary.

`project-state-residue-v2` handles the two project-state cases that cannot use
the childless v1 rule. It compacts two exact completed LocalDNS children before
their holder, then closes the exact finite runtime-container repair. Every
action is guarded by identity, topology, mode, phase, and Condition, with
`expectedGeneration` rejecting a concurrent revision.

Legacy repo-ref waits use one older project-scoped Condition shape that the
shared tracker cannot interpret. `legacy-repo-ref-conditions-v1` returns only
the fixed matching waits to their current owners. A truthful replacement uses
the canonical `repoRef:<ref>` subject and `commit notEquals <baseline>` shape;
the app no longer scans and emits duplicate task ticks on every ref observation.

Repo-ref owner handoff and satisfied-Condition continuation now also stay in
the shared controller. A workflow `needs-owner` result immediately requeues the
same task for its resolved owner, and exact Condition satisfaction wakes that
same task through the generic tracker or passive resync. AKS no longer turns
either `project.task.reconciled` result into another app-local task tick.

Loop ownership is migrating from the safest edge inward. The first bounded
slice, `spec-loop-siblings-v1`, reparents only the one child-backed spec wait
that has no external Condition and compacts two exact completed childless
holders. The remaining approval/pipeline-backed sibling stays unchanged until
its exact wait resolves; migration never clears a truthful external wait just
to reshape the tree.

Feature-loop migration follows the same boundary in two stages. First,
`feature-loop-current-v1` reparents only the current pending or waiting tasks
still named by the compact domain state and turns finite maintain carriers
into achieve tasks. Their Conditions and children are preserved. Stale
completed siblings are compacted separately, so moving current work and
removing history remain independently verifiable changes.

The live `feature-loop-current-v1` run moved all 16 matching current resources.
The standing loop now owns those continuations directly; no current pending or
waiting compact resource remains a group sibling.

The second feature slice, `feature-loop-history-v1`, is a guarded sequence of
stable batch resources. Each reconciliation compacts at most 16 stale,
converged, childless maintain holders, matching the shared action limit. A
current reference, open Condition, child, unfinished phase, changed
generation, or different parent excludes the resource. Git and the resulting
receipts retain history; the active task graph does not. Batch resources run
one by one so every bounded result is proven before the next wake.

The final feature topology slice, `feature-loop-residue-v1`, uses two stable
bounded batch resources to move every remaining pending, waiting, or
child-backed group sibling under the standing feature loop. Each reconciliation
changes at most 16 resources. It does not reinterpret the work: children and
Conditions stay attached, while finite maintain carriers become achieve tasks.
Once both batches converge, the feature group contains only the standing loop
and generic parent wakeup replaces sibling reconstruction.

Scenario normalization follows the same ownership rule. The standing
`scenario-normalization` task is the executable parent; two bounded migration
resources move legacy pending, waiting, or child-backed group siblings beneath
it without changing their learned workflows or external Conditions. New
normalization leaves already use this shape, so the migration removes history
drift rather than adding a second scheduling path.

With spec, feature, and scenario leaves owned by their executable parents,
AKS no longer reconstructs loop ownership from `project.task.reconciled`.
Shared parent wakeup now owns continuation; the app keeps that event only for
deterministic spec-proof and feature-compact read-model projections.

The final scheduling cleanup removes the general
`runtime/waiting-frontier-review` lane, its 30-minute schedule, attention
replay, malformed-approval replay, handler-recovery replay, and
already-satisfied pipeline-Condition replay. These were all second scheduling
paths over mechanics already owned by the shared runtime. Scenario inventory
still wakes `scenario-normalization` directly when the observation changes;
an identical wait-only observation is a no-op rather than a reason to scan the
task tree. Because `runtime/*` specifications are reconciler-owned and reject
handler mutation, one app-resolver event changes the existing waiting-frontier
resource into a finite achieve task. Existing children remain ordinary
outcome-bearing tasks; a deterministic workflow observes only those direct
children, creates nothing, and relies on shared parent wakeup until it can
converge.

The 2026-08-03 post-change source proof is the complete AKS check: 497 app
tests plus 2 workflow-input tests, clean syntax bundling, formatting, and
type-checking. The live graph at the cutover has zero internal
task/project Conditions, `group/feature-compact` contains only
`aks-feature-compact-loop`, and `group/scenario-normalization` contains only
`scenario-normalization`. The pre-cutover waiting-frontier resource still has
live children, so it is retained without any producer until those children
finish; it must then leave the live graph as finite migration residue rather
than regain a schedule.

The final graph cleanup treats names as a guarded migration signal, not a new
runtime convention. A non-runtime `hold-*` or `wait-*` resource in maintain
mode is finite legacy residue. Bounded 16-action batches close only converged,
childless, condition-free holders; unfinished pending or waiting holders keep
their full specification and external waits but change to achieve mode. Every
action rechecks the current generation. This removes history from the live
graph while leaving Git, journal records, and task receipts as the audit trail.

Live batches 1 through 8 completed through the shared controller. They applied
117 guarded actions: 103 obsolete holders became receipts and 14 unfinished
holders changed from maintain to achieve. The final live audit has 259
resources (245 achieve and 14 genuine maintain responsibilities), 113 external
Conditions, zero internal task/project Conditions, and zero non-runtime
`hold-*`/`wait-*` maintain resources. The retired waiting-frontier is an achieve
resource with two existing children; it has no schedule or producer and will
leave the graph through generic parent wakeup after those children finish.

Attention is not a completion state. Each attention resource must retain an
accountable owner, exact failure evidence, and a truthful next wake or
escalation path. Generic mechanical recovery may requeue it when the failed
capability is proven healthy; deterministic invalid decisions remain visible
for owner correction rather than being retried forever.

## Cross-app conformance

The shared conformance suite runs against every task-enabled app. It proves
the common manifest boundary directly, while shared controller and parent
semantics tests prove the runtime mechanics. Together they check that:

- timers and semantic events resolve or wake stable task identities;
- created tasks enter the shared queue without an app-generated tick;
- direct-child convergence and attention wake the parent;
- every wait has a live direct child or an exact external Condition;
- no app schedules work from `project.task.reconciled`;
- repeated delivery is idempotent and restart resync recovers lost queue hints;
- achieve tasks leave receipts rather than live archive nodes; and
- maintain tasks sleep after convergence until a real event or schedule wakes
  them.

App-specific tests continue to prove domain policy. The shared suite proves the
unified control-loop behavior.

### Fresh conformance proof: 2026-08-04

The final audit reran the common suite and every app's own normal check after
the migration. Scout and Evaluation previously had test files that their
`check` commands did not execute; their checks now include those existing test
suites by convention.

| Proof                              | Result                                                         |
| ---------------------------------- | -------------------------------------------------------------- |
| Shared cross-app conformance       | 3 tests pass: stable timer identity, stable semantic-event identity, and no scheduling from reconciliation results |
| Scout app check                    | syntax, types, format, and 61 tests pass                       |
| Gym app check                      | syntax, types, format, and 74 tests pass                       |
| Evaluation app check               | syntax, types, format, and 83 tests pass                       |
| May Agent app check                | syntax, types, format, and 25 tests pass                       |
| AKS app check                      | syntax, types, format, 512 app tests, 2 workflow-input tests, and current bundle verification pass |

The hosted event trace also proves current runtime use rather than only source
shape:

- Scout's `scout.digest` timer reconciled `daily-digest`, and a later
  `credential.state` observation reconciled the same `explore-xhs` resource.
- Gym's refill event reconciled `improve/may`; repeated improvement wakes reuse
  that resource while its resource-local training checkpoint advances.
- Evaluation's periodic `evaluation.aftermath.scan` reconciled
  `runtime/aftermath-backfill`, while target review events reconciled stable
  per-project audit resources.
- May Agent's ops-health and daily-digest timers reconciled their two stable
  runtime resources independently.
- AKS's direct loop pulse reconciled the named standing loop, while pipeline
  failure and completion observations reconciled the matching stable failure
  or scenario resource without an app-generated refill tick.

A read-only live-graph audit found no waiting resource in any app without at
least one exact Condition, dependency, or live direct child. Attention remains
visible owner work; it is not treated as successful convergence and does not
justify restoring an app-local recovery scheduler.

## Success criteria

AKS is aligned when:

- useful work does not require a manual or compatibility tick;
- the only task scheduler is the shared app controller;
- `app.ts` primarily declares correlation, schedules, actions, and
  deterministic observations;
- workflows own repeatable AKS execution and agents own judgment;
- the live graph represents current outcomes rather than prior wake chains;
- every sleeping task can explain the exact external fact or live child it is
  waiting for; and
- a master-validation campaign can schedule, observe, repair, verify, and
  return to its six-hour sleep without operator steering.
