# Work Graph And Project Supervisor V2

Status: approved model; staged implementation in progress, revisioned
review-handoff canary live

Implementation status is tracked in
`design/work-graph-supervisor-v2-implementation.md`. The shared snapshot/read
convergence is live. The first two-stage review-handoff supervisor canary is
live only for revisioned work behind an explicit mode gate; compatibility
revision `0` remains on the legacy path after the first live observation proved
that its recycled phase/attempt identities are unsafe for V2 authority.

## Review Decision

Adopt a smaller project-control model built from four concepts:

1. **Work items** record owner intent and accepted project meaning.
2. **Conditions** record exact prerequisites, external waits, and process
   invariant violations.
3. **Attempts and reviews** remain runtime execution facts linked to a work-item
   revision; they are not embedded task history.
4. **Controllers and one project supervisor** reconcile observed facts into
   work-item and Condition transitions.

The current tree and event vocabulary remain compatible during migration. This
proposal does not require a new workflow engine, a new app, or permanent event
sourcing.

Review scope is intentionally staged:

| Decide in this review                            | Defer until shadow evidence exists               |
| ------------------------------------------------ | ------------------------------------------------ |
| Work-item/Condition/attempt authority boundaries | Final serialized field names                     |
| Recovery applies only to invariant violations    | Whether persisted `blocked` can later be derived |
| Mandatory revision matching                      | Condition file versus co-located storage         |
| One shared snapshot and one supervisor policy    | Physical storage backend changes                 |
| Phase 0/1 shadow implementation                  | Retirement of any existing handler or schedule   |

The most important scope correction is:

```text
normal domain failure -> ordinary review/rework in the work loop
expected external wait -> Condition in the work loop
broken process invariant -> project supervisor recovery
```

Recovery is therefore a narrow exception path around normal work, not a second
general-purpose work system.

## Why Change

The accepted task-tree design describes the tree as the project owner's durable
thinking map, not a scheduler queue, retry log, workflow-attempt history, or
runtime trace. The live implementation has accumulated all of those roles.

At the review snapshot on 2026-07-16:

- the live tree had roughly 140 nodes but only three nodes with children;
- no live item used `depends_on`, while almost every leaf carried a
  `conflict_scope`;
- more than one hundred nodes were blocked wait/hold records rather than work;
- blocked refresh, session, review, repair, and rollup history was embedded in
  task `trace` and `context`;
- the planner repaired thousands of parent rollups per day;
- watchdog, metrics, health, stall review, blocked-frontier review, heartbeat,
  and planner code independently rediscovered overlapping symptoms.

This creates two forms of work amplification:

```text
one domain fact -> several state copies -> drift -> repair tasks
one process symptom -> several observers -> planner wakes -> duplicate ops work
```

The V2 model removes duplicated state and gives every kind of fact one owner.

## Live Validation Against The Current Frontier

A read-only comparison at `2026-07-16T04:22Z` found:

- 2 active leaves;
- 8 review leaves;
- 126 blocked leaves;
- no runnable leaves;
- 5 accepted domain outcomes in the prior 30 minutes;
- 20 planner runs, 12 reviewer runs, 7 parent rollups, 6 child-blocked
  parent-result repairs, 2 blocked-wait refreshes, and 2 watchdog completion
  re-emissions in the prior 30 minutes.

The snapshot demonstrates that V2 must preserve productive domain work while
removing control-plane work amplification.

| Live example                                                                             | Current behavior                                                                                                                                                                                                       | V2 behavior                                                                                                                                                                | Intended problem resolved                                              |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `domain/author-egress-lockdown-windows-baseline-20260716` active                         | A normal bounded domain worker owns a clear contract, but session and assignment history are copied into the task                                                                                                      | Preserve the WorkItem contract; link the current attempt externally with matching revision                                                                                 | Reduce task payload/drift without changing productive domain execution |
| Windows egress-lockdown follow-up lineage                                                | Domain review proposed an exact successor, an ops memo task proposed it again, a second review requested it again, and the planner eventually created the intended domain leaf                                         | `work.applyReview` atomically creates the validated successor from structured `reviewAction`                                                                               | Remove memo-only/apply-task chains and shorten domain feedback         |
| `ops/repair-project-root-frontier-review-parity-20260716` and its retry/apply successors | Stored root readout arrays drifted from the live frontier, creating diagnosis, retry, and apply work; one retry also encountered an expired auth token                                                                 | Root/frontier readout is derived from `ProjectSnapshot`; no parity repair work exists. An unrelated provider failure uses one attempt recovery key if it occurs elsewhere  | Eliminate repair work caused solely by duplicated projections          |
| `fix-network-acns-retina-enterprise-run-172450674`                                       | Accepted repair queued ADO run `172459471`; watchdog later reused the same task for terminal artifact review and reviewer rejected the completion because old fix-forward and new artifact-review contracts were mixed | Owner revises the same WorkItem to a new artifact-review phase/revision, or creates one typed verification child; the new attempt receives only the current phase contract | Prevent continuation-contract contamination and repeated redo          |
| `wait-traffic-api-proxy-enable-lifecycle-ado-run-172463356-result` in review             | A wait is represented as a task and moves through synthetic completion/review handling                                                                                                                                 | ADO run is a Condition; terminal event resolves it and activates one typed artifact-review phase/item                                                                      | Remove polling/wait tasks while retaining exact artifact review        |
| Escalation resume-condition hygiene tasks                                                | Invalid/missing resume metadata is detected after creation and repaired through ops tasks                                                                                                                              | Condition schema rejects incomplete external waits at write time; overdue conditions use declared fallback                                                                 | Prevent malformed waits instead of repairing them later                |
| Completed feature-reference controller                                                   | The completed 307/307 loop is still pulsed and rewrites progress metadata                                                                                                                                              | Completed controller lane is a read projection and receives no routine pulse until its source generation changes                                                           | Remove no-op controller and rollup churn                               |
| Watchdog completion re-emissions                                                         | Lost/late completion symptoms may be re-emitted by several wakes                                                                                                                                                       | Stable invariant recovery key permits one idempotent re-emission per subject revision                                                                                      | Deduplicate recovery and owner wakes                                   |

### Expected Effect During Migration

The approved first slice is read-only. Currently active and review tasks must
experience no behavioral change:

- existing active attempts continue under compatibility revision `0`;
- existing review claims continue through the current reviewer/planner path;
- no blocked task is converted while active/review work references it;
- shadow snapshot/invariant mismatches are reported but cannot dispatch,
  requeue, block, close, or create work;
- no existing handler or schedule is retired.

Later phases migrate by state:

1. new assignments and reviews gain mandatory revisions;
2. future exact pipeline waits become Conditions;
3. existing blocked holders migrate in bounded cause-key families;
4. derived readouts replace stored mirrors;
5. recovery branches retire only after incident replay and live shadow parity.

### Problems This Design Does Not Claim To Solve

V2 does not by itself resolve:

- AKS product defects or environment/capacity limitations;
- incorrect specs, tests, fixtures, or compact plans;
- external pipeline duration or artifact availability;
- model/provider availability and authentication outages;
- project strategy choices about which AKS gap to pursue next;
- the substantive disposition of the current pending/blocked catalog.

It makes those facts cheaper and clearer to operate. Domain repair remains
domain work; provider outages remain runtime/attempt conditions; strategy
remains owner judgment.

## Goals

- Preserve project decomposition, assignment, concurrency, dependency,
  independent review, exact waits, loop refill, focus missions, recovery,
  escalation, accepted outcomes, and auditability.
- Make the normal work path explainable without reading recovery code.
- Make every recovery action correspond to one explicit violated invariant.
- Remove repeated rollup, wait-refresh, session-history, and stale-signal repair
  from work-item records.
- Allow health, metrics, UI, and planner packets to use one shared projection.
- Reduce owner/LLM wakes by resolving objective facts deterministically.
- Make migration observable and reversible through shadow projections and
  incident replays.

## Non-Goals

- Replacing May's workflow, session, event, or escalation runtime.
- Adopting Temporal, Airflow, Kubernetes, or another external engine.
- Making events the permanent source of truth.
- Automatically judging AKS behavior or accepting domain correctness.
- Rewriting the three domain loop ledgers in the first migration.
- Changing the storage backend before the logical model is proven.
- Preserving every historical compatibility field in the new canonical shape.

## Mental Model

```text
Project goal
   |
   +-- Mission/work-item graph -------- owner intent and accepted meaning
   |       |
   |       +-- dependencies
   |       +-- locks
   |       +-- blocked-by Condition references
   |
   +-- Conditions --------------------- exact facts that prevent or restore work
   |
   +-- Attempts/reviews --------------- runtime execution facts
   |
   +-- Controllers -------------------- domain-ledger reconciliation
   |
   +-- Project supervisor ------------- process-invariant reconciliation only

Tree, frontier, Kanban, health, and parent rollups are read projections.
```

The word "tree" remains a UI projection and compatibility term. The canonical
relationship model is a graph:

- `parentId` expresses human organization and mission containment;
- `dependsOn` expresses ordering;
- `locks` express exclusive execution resources;
- `blockedBy` references exact Conditions.

These relationships must not substitute for one another.

## Authority Boundaries

| Fact                                   | Authority                                          |
| -------------------------------------- | -------------------------------------------------- |
| Project goal and mission decomposition | Work graph                                         |
| Work-item state and accepted outcome   | Work graph                                         |
| External prerequisite or exact wait    | Condition registry                                 |
| Worker/session lifecycle               | May runtime attempt/session store                  |
| Completion claim                       | Attempt result / completion event                  |
| Independent review judgment            | Review result / reviewed event                     |
| Spec/reference/compact progress        | Owning durable loop ledger                         |
| Domain truth and executable artifacts  | Domain repository                                  |
| UI tree, Kanban, frontier, rollups     | Derived read models                                |
| Operational audit                      | Bounded event/attempt history and durable evidence |

No fact should have two writable authorities. Compatibility mirrors may be
generated, but they are read-only.

### Provisional Storage Rule

Storage backend redesign is not required for the first slice. Until a later
review approves a cutover:

- `.state/tasks/tree.json` remains the sole live task-state write authority used
  by the current runtime;
- `tasks/tree.json` remains a generated durable checkpoint/compatibility input,
  never an independently mutated live authority;
- all writes continue through one locked mutation adapter;
- shadow V2 projections are read-only;
- before Phase 3 performs Condition writes, review must select either a
  co-located atomic Condition section or a sidecar covered by the same
  transactional write boundary.

This rule prevents the migration from creating a third live authority while
leaving the eventual storage-backend decision open.

## Work Item

### Canonical Shape

```typescript
type WorkItemState = "backlog" | "active" | "review" | "blocked" | "done";

type WorkItem = {
  id: string;
  parentId?: string;
  state: WorkItemState;
  revision: number;
  owner: string;
  priority: "P0" | "P1" | "P2" | "P3";

  contract: {
    goal: string;
    acceptance: string[];
    outputs: string[];
    forbidden?: string[];
  };

  execution?: {
    workflow?: string;
    input?: Record<string, unknown>;
    dependsOn?: string[];
    locks?: string[];
  };

  blockedBy?: string[];

  outcome?: {
    summary: string;
    evidence: string[];
    resolution: "completed" | "replaced" | "cancelled" | "terminal-exception";
    acceptedAt: string;
    acceptedBy: string;
  };
};
```

The exact serialized representation may stay close to the current SDK type
during migration. The important decision is which concepts remain canonical.

### Revision Rule

`revision` increments whenever owner intent changes in a way that can invalidate
execution or judgment, including:

- goal, acceptance, or expected outputs change;
- workflow input changes;
- dependency, lock, or Condition linkage changes;
- a replacement/rework changes the intended artifact or verification surface.

Assignments, attempts, completions, and reviews carry `taskRevision`. A result
may mutate current work only when both attempt identity and task revision match.
Older evidence remains auditable but cannot close newer intent.

This replaces many prose, timestamp, fingerprint, and stale-attempt guards with
one mechanical rule.

### Multi-Phase Continuation Rule

One attempt has one phase contract and one expected structured result shape.
When accepted work establishes a durable continuation, such as queuing a
pipeline run, the owner must choose one explicit representation:

1. **Revise the same WorkItem** when the original outcome is not complete until
   verification returns.
2. **Create one linked verification WorkItem** when verification is independently
   ownable, reusable, or fans out to several results.

For a same-item continuation:

```text
revision 7: fix-forward workflow
  -> accepted repair queues ADO run 172459471
  -> work.revise to revision 8
  -> state=blocked, blockedBy=[ado-run:172459471:terminal]
  -> execution.workflow=spec-result-review
  -> Condition resolves
  -> revision 8 dispatch expects SPEC_RESULT_REVIEW only
```

Revision 8 references revision 7's accepted repair evidence; it does not have
to reproduce the old `FIX_FORWARD_RESULT`. A synthetic terminal-wait attempt
must never reuse a prior phase payload without first revising the work contract.

Use a linked verification item instead when one run covers multiple source work
items or when per-spec review can proceed independently:

```text
repair/authoring item(s) -> verification item -> per-result follow-up(s)
```

The continuation transition and required event/outbox write are atomic. This
preserves durable waits without mixing diagnosis, repair, pipeline observation,
and artifact judgment inside one attempt contract.

### State Transitions

```text
backlog -> active     dispatch current revision
active  -> review     current attempt submits a claim
review  -> done       owner accepts current revision
review  -> backlog    owner requests rework or replacement
review  -> blocked    owner confirms exact unsatisfied Condition(s)
backlog -> blocked    owner records exact unsatisfied Condition(s)
blocked -> backlog    all blocking Conditions resolve or owner changes intent
backlog -> done       cancellation, replacement, or accepted no-execution fact
```

Only `done` is terminal. A blocked work item must reference at least one open
Condition. An active work item must reference exactly one current attempt in the
runtime projection. A review work item must reference a current completion
claim.

### Derived Fields

Do not persist these as independent mutable facts:

- `children`;
- `active_task_id` and `active_task_ids`;
- runnable, waiting, stale, or conflict-blocked status;
- ordinary parent rollup state;
- worker/session history;
- last completion/reviewer trace;
- blocked refresh history;
- controller pulse history;
- loop progress copied from loop ledgers;
- Kanban and health summaries.

Mission nodes may retain explicit owner-judged state. Pure grouping/controller
lanes are projections and do not need ordinary task lifecycle.

## Condition

A Condition is an exact fact that currently prevents work or states that a
project-control invariant is violated. It is not work by itself.

```typescript
type Condition = {
  id: string;
  class: "prerequisite" | "approval" | "external" | "timer" | "invariant";
  type: string;
  subject: {
    kind: "task" | "attempt" | "review" | "controller" | "project" | "external";
    id: string;
    revision?: number;
  };
  status: "open" | "resolved";
  causeKey: string;
  owner: string;
  observer: {
    mechanism: string;
    eventOrProbe: string;
  };
  firstObservedAt: string;
  lastObservedAt: string;
  occurrences: number;
  nextCheckAt?: string;
  fallback?: {
    at: string;
    action: string;
  };
  evidence: string[];
};
```

### Condition Rules

- `causeKey` is stable and deduplicates repeated observations.
- Multiple work items may reference the same shared Condition.
- Resolving a Condition does not automatically accept work; it only makes
  blocked work eligible for owner/controller reconciliation.
- Sending an external ask is work. Waiting for the response after confirmed
  delivery is a Condition.
- A future-dated exact wait is normal work state, not a recovery incident.
- An overdue or malformed wait creates an invariant Condition for the project
  supervisor; it does not create a second wait task.
- Refreshes append bounded observation evidence to the Condition rather than
  rewriting every dependent task.

### Examples

```text
ado-run:172456518:terminal
capacity:westus2:managed-cluster:create
approval:focus-20260716:owner-response
invariant:review-missing:task-123:r7
invariant:controller-unrepresented:spec.foo
```

## Readiness And Dispatch

```typescript
runnable(item) =
  item.state === "backlog" &&
  isExecutable(item) &&
  dependenciesAreDone(item) &&
  blockingConditionsAreResolved(item) &&
  locksAreAvailable(item);
```

`locks` are runtime mutual-exclusion keys. They must not be used as semantic
coverage, deduplication, or wait-holder identity. If semantic subject identity
is required, put it in workflow input or a typed subject reference.

Dispatch is mechanical once readiness is true. Planner judgment creates or
changes work; it does not need to hand-select already-approved runnable leaves
on every wake.

## Controller Model

The three domain controllers remain intentionally small:

```text
read owning ledger
  -> import objective result facts
  -> reconcile represented work/Conditions
  -> fill bounded executable window
  -> update owning ledger
```

Controllers may:

- create bounded work items from ledger records;
- link work items to shared Conditions;
- settle mechanical ledger facts from accepted results;
- dispatch already-approved runnable children.

Controllers may not:

- decide project strategy;
- judge AKS correctness beyond structured accepted evidence;
- create broad recovery campaigns;
- copy ledger histories into task traces;
- use controller-root state as a second progress authority.

Controller lanes appear in the UI as projections. Existing stable loop task IDs
may remain compatibility anchors until all consumers use lane projections.

## Normal Feedback

The following are part of the ordinary work loop:

| Fact                                                    | Normal response                                |
| ------------------------------------------------------- | ---------------------------------------------- |
| Spec or compact run fails                               | Review then rework/fix-forward work item       |
| Reviewer requests redo                                  | Same item returns to backlog at a new revision |
| Reviewer requests bounded follow-up                     | Create linked work item                        |
| Pipeline is still running                               | External Condition remains open                |
| Capacity or permission is unavailable                   | Shared prerequisite Condition                  |
| Human/product judgment is required                      | Send ask work item, then approval Condition    |
| No runnable work but terminal dispositions are complete | Normal settled project state                   |

These facts do not enter project recovery unless their expected transition or
representation fails.

## Project Supervisor

The project supervisor is a deterministic invariant reconciler. It replaces
the overlapping recovery portions of watchdog, metrics, blocked-frontier
review, stall review, and heartbeat.

It is not a planner, domain judge, or second task controller.

### Shared Snapshot

One `ProjectSnapshot` projection is consumed by supervisor, health, metrics,
planner packets, and UI:

```typescript
type ProjectSnapshot = {
  work: {
    runnable: string[];
    active: string[];
    review: string[];
    blocked: string[];
  };
  currentAttempts: Record<string, AttemptSummary>;
  currentReviews: Record<string, ReviewSummary>;
  openConditions: Condition[];
  controllerRepresentation: ControllerRepresentation[];
  deliveryGaps: DeliveryGap[];
  outcomeDeltas: OutcomeDelta[];
};
```

Consumers may format or threshold the snapshot differently, but they must not
reimplement its state semantics.

### Process Invariants

The supervisor enforces only these invariants:

1. **Attempt ownership:** every active item has exactly one viable current
   attempt for the same revision.
2. **Completion delivery:** every terminal current attempt either produced a
   reviewable claim or was explicitly requeued/failed.
3. **Review delivery:** every review item has a current claim and receives a
   review decision within its grace window.
4. **Readiness explanation:** every open item is active, reviewable, runnable,
   dependency-blocked, or Condition-blocked.
5. **Condition stewardship:** every blocked item references an exact open
   Condition with owner, observer, and fallback policy where required.
6. **Controller representation:** every nonterminal ledger record has current
   work, review, or an exact Condition.
7. **Continuation delivery:** a transition requiring a continuation event has
   a delivered event or durable outbox record.
8. **Single authority:** canonical work state and its projections do not
   disagree about identity or revision.

Parent rollup drift is absent because ordinary rollups are derived.

### Supervisor Strategies

For each invariant Condition, use a stable recovery key:

```text
recoveryKey = invariantType + subjectId + subjectRevision
```

The strategy table is deliberately small:

| Violation                                   | One safe automatic action                          | If still open                               |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| Assignment event missing                    | Re-emit from durable assignment/outbox             | Create one routing repair                   |
| Active attempt is dead                      | Requeue once when policy permits                   | Owner judgment or one worker-adapter repair |
| Terminal attempt lacks completion           | Recover stored claim and emit completion           | One completion-adapter repair               |
| Review delivery missing                     | Re-emit current completion/review request          | One reviewer-routing repair                 |
| Condition resolved but work remains blocked | Reconcile affected items                           | One Condition-observer repair               |
| Condition overdue                           | Execute declared fallback                          | Owner judgment/escalation                   |
| Ledger item unrepresented                   | Pulse owning controller once                       | One controller repair                       |
| Planner session repeatedly times out        | Retry once with same recovery key                  | One planner repair                          |
| Structural schema defect                    | Apply deterministic integrity repair when lossless | One ops repair                              |

Automatic action budget defaults to one per recovery key and revision. A
changed causal fact or revision creates a new key. Repeated observation of the
same key updates `occurrences`; it does not create another task or owner wake.

### When Judgment Is Required

The supervisor wakes the existing planner through
`project.owner.requested` only when:

- the automatic action budget is exhausted;
- the safe action is ambiguous;
- project strategy must choose among domain alternatives;
- authority crosses to a human/product/external owner;
- a terminal exception needs owner acceptance.

The event carries one structured recovery packet. No new general recovery event
vocabulary is required for V2.

### Recovery Exit

Recovery succeeds only when:

1. the violated invariant is true again; and
2. the affected work is returned to normal work state or accepted terminal
   disposition.

Creating a report, refreshing a timestamp, validating a blocked record, or
delivering a notification is not recovery success.

## Component Convergence

| Current component                 | V2 responsibility                                                               |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `project-health`                  | Read-only formatter of `ProjectSnapshot`                                        |
| `project-metrics`                 | Small thresholds/trends over shared projection                                  |
| `project-execution-watchdog`      | Narrow deterministic project supervisor                                         |
| `project-stall-review`            | Removed as a standalone lifecycle; unresolved supervisor packet goes to planner |
| Scheduled blocked-frontier review | Replaced by Condition timers/events and supervisor invariant checks             |
| App-ops heartbeat                 | Focus/digest only; no duplicate liveness decisions                              |
| `problem-solver`                  | Ordinary bounded repair workflow attached to one work item                      |
| Fix-forward                       | Ordinary domain rework workflow, not system recovery                            |
| Planner                           | Owner judgment and validated work-graph mutation                                |
| Loop controllers                  | Owning-ledger reconciliation and bounded refill only                            |

Static failures belong in integrity checks rather than runtime recovery:

- duplicate event routes or schedules;
- missing declared handlers;
- invalid workflow names;
- schema incompatibility;
- impossible parent/dependency references;
- active metrics without owner/threshold/closure contract.

## Command Surface

All canonical mutations should reduce to a small command set:

```text
work.create
work.revise
work.dispatch
work.submit
work.applyReview
work.blockOn
work.complete
work.replace
condition.observe
condition.resolve
```

Commands validate current revision and transition legality, update canonical
state atomically, and place required continuation events in an outbox or
equivalent recoverable handoff.

Compatibility CLIs may translate old operations into these commands. Direct
field patching is migration-only.

## Capability Preservation

| Current ability                | V2 representation                                        |
| ------------------------------ | -------------------------------------------------------- |
| Human-readable hierarchy       | `parentId`, derived children/tree view                   |
| Mid-term focus                 | Mission work item                                        |
| Dependency ordering            | `execution.dependsOn`                                    |
| Concurrent resource protection | `execution.locks`                                        |
| Worker dispatch                | Derived readiness plus `work.dispatch`                   |
| Retry and stale recovery       | Attempt records, revision match, supervisor policy       |
| Independent review             | Review result tied to attempt and revision               |
| Exact waits                    | Shared Conditions                                        |
| External owner handoff         | Send work item plus response Condition                   |
| Durable loop refill            | Controller plus owning ledger                            |
| Accepted knowledge             | Work-item outcome and domain artifacts                   |
| Audit trail                    | Runtime events/attempts plus durable evidence references |
| Kanban and health              | Shared read projections                                  |
| Escalation                     | Existing escalation events linked from Conditions/work   |

## Metrics

### Work Outcomes

- domain outcomes accepted per day;
- specs verified and terminally dispositioned;
- time from actionable gap to accepted result;
- pipeline runs and cluster-hours per accepted result;
- duplicate unchanged rerun rate.

### Supervisor Effectiveness

- invariant Conditions opened by type;
- percentage restored automatically;
- mean and maximum time to restoration;
- recovery keys that recur after an accepted repair;
- repair work items per unique recovery key;
- owner/LLM wakes per unique unresolved invariant;
- domain work restored per ops session.

Planner wakes, wait refreshes, reports, and mechanically valid blockers are
activity metrics only. They do not count as outcomes or restoration.

## Migration Plan

### Phase 0: Contract And Fixtures

- Approve this logical model before changing storage.
- Capture current task, wait, stale-attempt, lost-review, controller-stall, and
  planner-timeout incidents as replay fixtures.
- Define the `ProjectSnapshot` type and invariant results.

Exit gate: reviewers agree on authority boundaries, capability mapping, and
recovery scope.

### Phase 1: Shared Projection In Shadow Mode

- Build `ProjectSnapshot` from the current tree, loop ledgers, runtime sessions,
  assignments, reviews, and events.
- Run current health/metrics/watchdog and V2 invariants side by side.
- Report semantic mismatches without mutating state.

Exit gate: runnable, active, review, blocked, controller representation, and
stale-attempt parity on recorded fixtures and live snapshots.

### Phase 2: Revision-Safe Attempts And Reviews

- Add work-item revision to assignment, completion, and review envelopes.
- Reject stale revision transitions mechanically.
- Stop copying full session/review histories into task `trace`.

Exit gate: replay late completion, duplicate delivery, redo, archived-id reuse,
and reviewer-delay scenarios without stale closure.

### Phase 3: Conditions

- Introduce the Condition registry behind compatibility blocker APIs.
- Convert exact pipeline waits first, then shared capacity and approval waits.
- Keep current blocker projection readable during migration.
- Deduplicate dependent wait holders by `causeKey`.

Exit gate: every migrated blocked item retains owner, evidence, observer,
resume, next-check, fallback, and escalation behavior.

### Phase 4: Supervisor Convergence

- Move lost completion/review recovery into the supervisor.
- Move stale attempt handling into the supervisor.
- Move overdue Condition handling into the supervisor.
- Move controller representation checks into the supervisor.
- Route unresolved cases to one structured planner packet.

For each migrated class, require one incident replay proving equivalent or
better recovery before disabling the old branch.

Exit gate: no duplicate owner wake or repair task for the same recovery key.

### Phase 5: Derived Tree And Lane Projections

- Derive children, active IDs, readiness, conflicts, rollups, Kanban, and loop
  cards from canonical state.
- Stop persisting ordinary parent rollup repairs.
- Replace controller-root task semantics with lane projections while retaining
  compatibility IDs until consumers migrate.

Exit gate: UI, CLI, metrics, planner, and integrity checks consume the shared
projection.

### Phase 6: Remove Compatibility And Duplicate Schedules

- Retire migrated watchdog and stall-review branches.
- Retire blocked-frontier recovery schedule.
- Narrow app-ops heartbeat to digest/focus concerns.
- Remove obsolete task trace/context fields and repair scripts.
- Confirm the canonical work-state storage authority and remove any remaining
  compatibility path that can still be independently written.

Exit gate: a full project-control replay suite and a live canary show no lost
dispatch, review, wait, escalation, or controller representation.

## Safety And Rollback

- Migration uses one mutation adapter; old and new paths must not both write
  independently.
- Shadow mode compares decisions before cutover.
- Every retired recovery path has an incident replay and explicit replacement.
- Condition conversion preserves raw legacy blocker evidence until accepted.
- A feature flag may route one invariant class back to its old handler during
  the migration window.
- No broad tree rewrite is required; items and blocker families migrate in
  bounded batches.

## Live Migration And Maintenance Mode

Do not pause domain work for Phase 0/1. Shadow projection and invariant work is
read-only, and live concurrency, late completion, reviewer delay, pipeline
return, and blocked-condition behavior are required validation inputs. A quiet
system can produce false confidence because the difficult races disappear.

Use a bounded maintenance window only when canonical writers cut over.

### Recommended Cutover Sequence

```text
build and shadow-validate while work continues
  -> stop new dispatch/planning/controller mutations
  -> let current attempts and reviews drain
  -> checkpoint canonical state and runtime correlations
  -> buffer incoming continuation events
  -> migrate one bounded state family
  -> compare old/new projections and invariants
  -> enable one V2 writer and disable its old writer atomically
  -> replay buffered events through revision/cause-key validation
  -> canary dispatch
  -> resume normal work
```

### Maintenance-Mode Semantics

Maintenance mode freezes mutation, not observation or external reality.

Continue:

- event ingestion into a durable buffer/outbox;
- pipeline, escalation, approval, and message delivery observation;
- session heartbeat and terminal-state recording;
- read-only health, integrity, snapshot, and migration validation;
- human visibility and emergency stop/rollback controls.

Pause:

- new task dispatch;
- planner-created work or task-state judgment;
- controller refill and wait-holder creation;
- automatic recovery mutations;
- scheduled blocked-frontier and heartbeat owner wakes;
- canonical state compaction or archive rewriting.

Do not cancel healthy active attempts merely to reach maintenance mode. Stop new
assignments and let existing attempts submit. Drain their review decisions
through the old writer before checkpointing, or explicitly carry each
active/review attempt into the migration manifest.

### Entry Gate

Before writer cutover, require:

- no queued assignment lacking a recorded attempt;
- active/review items are zero, or every exception is listed with task id,
  attempt id, revision/compatibility revision, session id, and expected next
  event;
- every known nonterminal pipeline run has an exact correlation record;
- old task state, Condition state, assignment/outbox state, and loop ledgers are
  checkpointed with hashes and timestamps;
- the durable event buffer is enabled and replay-tested;
- old and new snapshots agree on frontier and controller representation;
- rollback commands and authority are confirmed.

### Exit Gate

Resume normal work only when:

- exactly one writer owns each migrated state class;
- buffered events replay without uncorrelated or stale transition application;
- no active-without-attempt, review-without-claim, blocked-without-Condition, or
  unrepresented-controller invariant remains;
- old/new capability parity checks pass;
- one bounded canary assignment completes through review under V2;
- rollback checkpoint remains available for the agreed observation window.

### Why Not Pause Until The Entire Migration Is Done

The full migration spans projection, revisions, Conditions, supervisor
convergence, controller lanes, and handler retirement. Freezing domain work for
that entire sequence would:

- turn a staged migration into one large irreversible release;
- accumulate external pipeline and approval events while local state is frozen;
- make active branches, credentials, and evidence stale;
- remove live evidence needed to validate races and recovery;
- delay AKS outcomes for changes that are initially read-only;
- encourage expanding the maintenance window whenever migration scope grows.

If a long project pause is required for business reasons, treat it as an
explicit project lifecycle decision with external-event stewardship, not as a
technical shortcut for V2 implementation.

## Risks

| Risk                                                      | Mitigation                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| Shared Condition is too broad and unblocks unrelated work | Exact subject refs, cause key, and revision constraints                    |
| Old completion closes revised work                        | Required task revision on attempts and reviews                             |
| Derived projections hide owner judgment                   | Mission state remains explicit; only ordinary grouping rollups derive      |
| Removing trace loses auditability                         | Runtime attempts/events plus durable evidence refs remain linked           |
| Automatic recovery hides recurring defects                | One-action budget and circuit breaker to one repair item                   |
| Supervisor becomes another planner                        | Fixed invariant list and strategy table; judgment always routes to planner |
| Dual authority during migration                           | One write adapter and read-only compatibility projections                  |
| Conditions become a second task tree                      | Only open/resolved state; work is always represented by WorkItem           |

## Failure Modes Introduced By V2

V2 removes existing duplication, but its new abstractions introduce their own
failure modes. Implementation must prove these are controlled before any old
path is retired.

### Additive-Control-Plane Failure

The highest risk is deploying Conditions, revisions, a shared snapshot, and a
supervisor while leaving old wait tasks, task traces, readout mirrors, watchdog
branches, metrics, and schedules writable.

That would produce:

```text
old task control plane + new V2 control plane = more drift, not less
```

Guardrails:

- every V2 cutover names the old writer/handler it replaces;
- only one path may mutate a migrated invariant class;
- shadow paths are structurally read-only;
- migration tests fail when both old and new paths emit an action for the same
  recovery key;
- code deletion/retirement is part of each migration slice's definition of
  done, not an optional cleanup phase.

### Shared-Condition Blast Radius

A Condition may be keyed too broadly and unblock unrelated tasks, or keyed too
narrowly and preserve the current duplicate-holder problem.

Examples:

- `capacity:westus2` is probably too broad;
- `capacity:westus2:managed-cluster:create:<exact contract family>` may be
  appropriate;
- resolving a pipeline-run Condition must not resolve a sibling run or a task
  at a newer revision.

Guardrails:

- exact typed subject and contract-family identity;
- resolution event must match Condition type, subject, and observed revision;
- dry-run impact list before resolving a shared Condition;
- maximum fan-out threshold requiring owner review;
- canary shared Conditions begin with exact pipeline-run identities, not broad
  environment families.

### Revision Churn And False Staleness

If every metadata edit increments revision, useful in-flight work becomes stale
and the system may repeatedly cancel or ignore valid evidence. If too few edits
increment revision, old results may close changed intent.

Guardrails:

- define a canonical intent fingerprint over contract, executable input,
  dependencies, locks, and blocking subject—not timestamps, summaries, or
  observation metadata;
- increment revision only when that fingerprint changes;
- preserve older evidence as input to newer review without permitting stale
  closure;
- test harmless metadata edits, meaningful contract edits, late completion,
  and concurrent owner revision.

### Multi-Phase Outcome Loss

Revising a WorkItem from repair to artifact review can overwrite or obscure the
accepted repair outcome. Conversely, splitting every phase into a child item can
recreate task proliferation.

Guardrails:

- retain immutable accepted phase-result references on the WorkItem;
- define when continuation stays on the same item versus becomes a child;
- final acceptance checks the end-to-end WorkItem contract, not only the latest
  phase;
- one phase has one result schema, and the next revision explicitly references
  required prior phase evidence.

### Central Projection Correlated Failure

One `ProjectSnapshot` removes semantic drift, but a bug in it can make planner,
health, metrics, supervisor, and UI all agree on the same wrong answer. Existing
duplication occasionally exposes disagreement; centralization removes that
accidental cross-check.

Guardrails:

- snapshot is pure, versioned, and fixture-tested;
- integrity checks compare raw authorities with projection invariants;
- keep a small independent safety query for critical facts such as active
  attempts, unreviewed claims, and undelivered outbox records;
- include source timestamps/generations and projection version in every packet;
- never allow a UI/read projection to write canonical state.

### Supervisor Becomes A Hidden Planner

Rule accumulation may cause the deterministic supervisor to make domain or
strategy judgments under the label of recovery.

Guardrails:

- fixed invariant list and enumerated mechanical actions;
- supervisor cannot alter goal, acceptance, domain artifacts, terminal domain
  disposition, or priority;
- unknown invariant/action combinations route to owner judgment;
- every automatic action records invariant, precondition, action budget, and
  postcondition;
- review supervisor rule growth as an API change.

### Recovery-Key Failure

An overly broad key suppresses distinct incidents; an unstable key bypasses the
circuit breaker and recreates alert storms.

Guardrails:

- typed key builder per invariant class;
- key includes subject identity and intent revision but excludes volatile
  timestamps/messages;
- fixture tests for same incident, changed causal fact, changed revision, and
  sibling incident;
- surface suppressed occurrence counts so deduplication does not hide severity.

### Event-Only Wakeup Loss

Replacing polling with pipeline/approval/condition events reduces churn but can
strand work when an external event is delayed, dropped, or lacks correlation.

Guardrails:

- durable outbox/delivery evidence for project-originated continuations;
- expected external Conditions retain `nextCheckAt` and an idempotent fallback
  probe;
- event-first, bounded-poll fallback rather than event-only operation;
- correlation validation before resolving a Condition.

### `blocked`/Condition Dual-State Drift

During migration a WorkItem persists `state=blocked` while Condition is the
authority for why it is blocked. A resolved Condition and still-blocked item can
become another duplicated-state contradiction.

Guardrails:

- Condition resolution and dependent-item reconciliation share one atomic
  command/outbox boundary where feasible;
- supervisor invariant explicitly detects resolved Conditions referenced by
  blocked items;
- UI displays Condition status and pending reconciliation separately;
- evaluate deriving `blocked` only after Condition migration is proven.

### Attempt/State Atomicity Failure

Dispatch spans canonical work state, runtime attempt creation, assignment, and
event delivery. Partial writes can produce active-without-attempt or
attempt-without-active contradictions.

Guardrails:

- transactional command or durable outbox around state and assignment event;
- idempotent attempt creation keyed by work item, revision, and attempt id;
- supervisor repairs only from recorded command/outbox facts;
- no inference from session-name prose.

### Lock-Semantics Regression

Current `conflict_scope` is used for mutual exclusion, semantic representation,
deduplication, and holder identity. Migrating it directly to `locks` could
either under-protect shared resources or serialize unrelated work.

Guardrails:

- inventory each current conflict key's actual use;
- split resource locks from subject identity and recovery cause keys;
- shadow-compare runnable frontiers under old conflict and new lock semantics;
- migrate one key family at a time.

### Lost Visibility And Ownership

Replacing wait/repair tasks with Conditions may make important waits less
visible, less reviewable, or apparently ownerless in existing UI and operator
habits.

Guardrails:

- first-class Condition UI with owner, affected work, evidence, next check, and
  fallback;
- Conditions appear in health and focus views without pretending to be work;
- human/external handoff remains linked to delivery evidence;
- operator actions can inspect, recheck, escalate, supersede, or resolve a
  Condition through validated commands.

### Performance And Freshness

A shared snapshot that scans large task, ledger, event, and session surfaces on
every consumer request can become slow or stale through caching.

Guardrails:

- one incremental/versioned snapshot builder;
- explicit captured-at and source-generation fields;
- bounded indexes for open work/Conditions/attempts;
- freshness requirements differ for dispatch, health, UI, and historical
  metrics;
- dispatch revalidates canonical state even when selected from a snapshot.

### Premature Handler Retirement

Shadow agreement on normal snapshots may miss rare recovery classes. Removing
old watchdog/stall paths too early could lose the only fallback for a real
incident.

Guardrails:

- replay the exact historical failure each handler was created to catch;
- observe live shadow parity across at least one full fallback/check window;
- retire one invariant class at a time;
- retain an explicit rollback flag during the bounded migration window;
- do not use lower event volume alone as proof of equivalent coverage.

## Alternatives Considered

### Keep The Current Tree And Improve Repair Logic

Rejected. The main cost comes from duplicated responsibilities and authorities;
more repair logic reinforces that structure.

### Full Event Sourcing

Rejected. May events are bounded operational evidence, and rebuilding project
meaning from a permanent event log would introduce a larger migration and
retention problem.

### Adopt A General Workflow Engine

Rejected. May already supplies workflows, sessions, events, ownership, and
durable continuation boundaries. The missing abstraction is a smaller project
state model, not another executor.

### Add A Recovery Task Tree

Rejected. It recreates the current problem. An invariant is a Condition; a
repair becomes an ordinary work item only when real work is required.

### Remove Persisted `blocked` Immediately

Deferred. In principle blocked can be derived from open Conditions, but keeping
the five-state lifecycle during migration greatly reduces compatibility risk.
After Condition adoption, a separate proposal may evaluate deriving blocked.

## Review Questions

Reviewers should explicitly answer:

1. Is a work item correctly defined as owner intent plus current judgment,
   excluding attempt and review history?
2. Should `revision` be mandatory for every assignment, completion, and review?
3. Is Condition the right shared representation for external waits and process
   invariant violations?
4. Are normal domain failure, redo, fix-forward, and expected waits correctly
   excluded from project recovery?
5. Is the supervisor's invariant list complete but narrow enough to prevent it
   becoming a planner?
6. Is one automatic action per recovery key/revision the right default circuit
   breaker?
7. Which mission/container nodes require explicit owner state, and which should
   be pure projections?
8. During migration, should Conditions live beside work items in the existing
   task state file or in a separate canonical file behind the same atomic write
   adapter?
9. Which current recovery class should be the first canary: missing review,
   stale attempt, overdue wait, or controller representation?
10. Are the migration exit gates sufficient to retire old schedules without
    losing a recovery capability?

## Recommended Review Outcome

Approve the logical model and Phase 0/1 only. Do not approve broad mutation or
handler retirement yet.

The first implementation slice should produce:

1. a typed, read-only `ProjectSnapshot`;
2. typed invariant findings with stable recovery keys;
3. replay fixtures for current recovery incidents;
4. a shadow comparison report against current health, metrics, and watchdog;
5. no change to dispatch or recovery behavior.

That slice will give reviewers empirical evidence for the later storage,
Condition, and handler-convergence decisions.
