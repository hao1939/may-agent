# Proposal: App Task Reconciliation Model

**Design status:** Pilot.
**Implementation status:** The shared reconciler is in production.
`evaluation.app`, `may-agent.app`, and `scout-knowledge-lib.app` route their
organized work through task reconciliation. `aks-rp-e2e.app` is migrating by
bounded cohorts. Feature-compact maintenance, task execution, completion
review, reviewed-result application, problem investigation, approval dispatch,
Condition owner fallback, stall review, and focus review now use the
reconciler; legacy planner, watchdog, and unfinished loop responsibilities
retain authority for their existing cohorts. `gym.app` remains a direct
immutable request/result pipeline pending extraction of the shared agent
runner.

## Executive Decision

Use one event-driven task reconciliation model for every Agent App:

> The app organizes work. Agents and workflows provide capabilities. A task
> records desired and observed state. An event wakes one generic reconciler,
> which invokes the task's workflow or falls back to its accountable owner.

```text
event
  -> app identifies a task or Condition
  -> task reconciler compares desired and observed state
  -> bound workflow, otherwise resolved owner agent
  -> structured result and evidence
  -> app validates and applies commands
  -> updated task/Condition state and follow-up events
```

This proposal refines the boundaries in
[agent-app-runtime-model.md](agent-app-runtime-model.md). It does not introduce
a second runtime, a generic request lifecycle, or a new workflow engine.

## Mental Model

The public unit is the app. Internally, the pieces have distinct jobs:

| Concept     | Responsibility                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| App         | Organizes goals, tasks, ownership, workflows, knowledge, events, permissions, and durable state.                    |
| Task        | Records one desired outcome, its relationships, and observed reconciliation state.                                  |
| Owner agent | Makes adaptive semantic decisions and is the guaranteed accountability fallback.                                    |
| Workflow    | Preserves a learned, repeatable process for a known task shape.                                                     |
| Skill       | Gives an agent reusable judgment guidance inside a task or workflow step.                                           |
| Tool        | Performs one atomic operation.                                                                                      |
| Runtime     | Delivers events, leases attempts, invokes capabilities, validates commands, persists state, and recovers mechanics. |

The compact rule is:

> Tools can act. Agents can figure things out. Workflows know a proven way.
> Apps organize everything toward a goal.

The app owns the organization and its durable state. The owner agent authors
semantic changes to that organization through typed decisions. App code does
not become a second planner merely because it applies those decisions.

## Agent Core And Infrastructure

The reusable agent execution core has one dependency direction:

```text
model + prompt + context + supplied tools
  -> run the agent loop
  -> result + neutral execution notifications
```

It does not import the EventBus, task model, scheduler, metrics service, or
SQLite helpers. Neutral notifications such as message produced, tool called,
and run completed are observations of execution rather than application
events. Infrastructure may subscribe to them to persist a transcript, update
session metadata, emit application events, or collect evaluation evidence.

This boundary does not prohibit database-backed capabilities. A supplied tool
may read or mutate durable state through its explicit capability contract, and
a skill may teach an agent when and how to use that tool. The execution core
only knows the supplied tool interface; it does not know that the tool is
implemented with SQLite, an EventBus command, a remote API, or an in-memory
test double.

```text
agent execution core
  -> invokes supplied capability interfaces

autonomous infrastructure wrapper
  -> supplies production tools
  -> persists sessions and transcripts
  -> translates neutral notifications into EventBus events
  -> manages timeout, recovery, and durable run identity

gym wrapper
  -> supplies sandbox tools
  -> collects transcript and scoring evidence
```

There is one agent implementation. Gym invokes it directly with lightweight
observers; the autonomous system wraps it with durable infrastructure. Prompt
construction and tool-policy resolution must also be shared so Gym does not
approximate production behavior by duplicating runtime logic.

`SubagentManager` may remain the compatibility facade while this boundary is
extracted. Its durable session coordination belongs to the infrastructure
wrapper, not to the agent execution core.

## One Task Resource

A task follows the Kubernetes `spec`/`status` shape. Exact serialized field
names may remain compatible during migration; the authority boundary is the
important decision.

```ts
type Task = {
  metadata: {
    id: string;
    generation: number;
  };

  spec: {
    outcome: string;
    acceptance: string[];
    mode: "achieve" | "maintain";

    owner?: string;
    workflow?: {
      name: string;
      input?: Record<string, unknown>;
    };

    parentId?: string;
    dependsOn?: string[];
    outputs?: string[];
    priority?: "P0" | "P1" | "P2" | "P3";
  };

  status: {
    observedGeneration: number;
    phase: "pending" | "running" | "waiting" | "converged" | "attention";
    currentAttempt?: string;
    blockedBy?: string[];
    summary?: string;
    evidence?: string[];
  };
};
```

`spec` is owner intent. `status` is an observation written through app/runtime
commands. `generation` changes whenever owner intent changes in a way that can
invalidate execution. Attempts and results carry the task generation and cannot
close or rewrite a newer generation.

Task modes are intentionally small:

- `achieve` converges once. Its outcome is absorbed and it then leaves the live
  graph.
- `maintain` expresses a standing desired state. Convergence means no action is
  needed now; a later event may wake the same task again.

Loops are ordinary `maintain` tasks. Focus plans and normal bounded work are
normally `achieve` tasks. There is no separate loop-task scheduler or focus-task
lifecycle.

The phase vocabulary above is the logical target, not an immediate persistence
cutover. Existing project apps may map `backlog`, `active`, `blocked`, `review`,
and `done` at compatibility boundaries while the new authority model is proven.

## Task Authoring Contract

The shared SDK type is the schema authority. Project docs may explain their
tasks, but must not define incompatible app-specific task shapes.

| Field        | Authoring rule                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Stable business identity. Sanitized or shortened external identifiers retain a digest so distinct inputs cannot collide.               |
| `parentId`   | Durable decomposition or containment only; it is not a scheduling edge.                                                                |
| `outcome`    | One desired end state, written as an outcome rather than an activity such as "investigate" or "monitor".                               |
| `acceptance` | One or more observable postconditions that can prove convergence from artifacts, records, events, or external state.                   |
| `mode`       | `achieve` for a bounded outcome; `maintain` for standing desired state. No other task kind is needed.                                  |
| `owner`      | Optional explicit accountability override. Otherwise ownership resolves from the nearest ancestor and then the app.                    |
| `workflow`   | Optional explicit binding to a known reusable process. Absence means owner handling; an invalid binding is visible failure.            |
| `input`      | Stable desired configuration needed by the handler. It participates in the spec hash and therefore must not contain wake observations. |
| `outputs`    | Durable artifacts or records into which the outcome is absorbed. Do not list transient logs as project output.                         |
| `dependsOn`  | True ordering constraints only. External facts and waits are Conditions, not dependency prose.                                         |
| `priority`   | A bounded scheduling hint, not a substitute for ownership, acceptance, or a deadline.                                                  |

Task status is not authored as intent. Event payloads, timestamps, metric
samples, latest evidence, attempts, workflow runs, summaries, and current
Condition values are observations. They belong in status or linked resources.
Copying them into `input` creates a false generation on every wake and prevents
the reconciler from distinguishing a changed goal from a changed observation.

### Authoring Rules

1. Start novel bounded work as an `achieve` task handled by the owner. Bind a
   workflow only after the process and postconditions are stable enough to
   reuse.
2. Use `maintain` only for a responsibility that remains true after the current
   pass. A successful pass means "nothing else is needed now," not permanent
   completion.
3. Give every task acceptance criteria that can be checked without trusting the
   worker's prose. "Reviewed," "investigated," and "monitoring" are activities,
   not sufficient postconditions.
4. Keep event data in the trigger packet. Put only stable handler configuration
   in task input.
5. Represent a durable external wait with a Condition. A task may reference the
   Condition but must not copy its changing observation into a blocker story.
6. Keep completed migrations, incidents, and retired ideas out of seed trees.
   Seed files contain only standing desired state; bounded completed work is
   absorbed and compacted.
7. Parent tasks express meaningful outcomes and acceptance. Their displayed
   state is derived from children and linked ledgers; parent summaries are not
   a second writable rollup authority.
8. Prefer clear local code for one-off work. Promote proven repeated execution
   into a workflow; do not add an envelope or abstraction merely to make unlike
   tasks look uniform.
9. A handler result is evidence, not self-approval. The app validates task
   generation, action scope, Conditions, and declared postconditions before
   changing observed state.

Shared integrity checks should validate task intents, seed files, and live task
resources against this contract. At minimum they reject missing outcomes or
acceptance, unsupported modes, unstable or duplicate identities, invalid
parents/workflow bindings, waits without Conditions, and status-only fields in
authored task input.

## Ownership And Handler Resolution

Ownership and execution are separate questions.

The accountable owner resolves deterministically:

```text
task.spec.owner
  -> nearest ancestor with an explicit owner
  -> app.owner
```

Every Agent App must have an owner, so every task has a resolved owner even
when it stores no owner field. The read model should show the resolved owner and
its source, but that projection is not another writable authority.

The execution handler resolves per reconciliation:

```text
task needs semantic fallback
  -> resolved owner agent

otherwise task.spec.workflow exists
  -> bound workflow

otherwise
  -> resolved owner agent
```

There is no separately persisted `handler` field. It is derived from task
intent, current observations, and the ownership chain.

Workflow binding is explicit. The runtime must not guess a workflow from prose,
similarity, or a global registry. A task template may materialize a workflow
binding when it creates a child, but workflow binding does not silently inherit
from a parent. This prevents a loop's reconciliation workflow from accidentally
becoming its children's domain workflow.

An invalid explicit workflow binding is not equivalent to an absent binding.
It produces a visible `HandlerUnavailable` observation and wakes the owner to
repair, replace, or remove the binding. Silently executing the original task by
a different process would hide a configuration failure.

## One Generic Task Reconciler

Use one generic reconciler implementation, logically scoped to each app
instance. It performs only mechanical steps:

```text
load -> compare -> resolve -> lease -> invoke -> validate -> apply -> emit
```

It may:

- coalesce and deduplicate wake events by task and generation;
- check dependencies and exact Conditions;
- resolve the owner and handler;
- ensure at most one current attempt for a task generation;
- invoke a workflow or owner session with a versioned context packet;
- validate a structured result against the handler contract;
- apply allowed commands atomically through the app command service;
- emit typed continuation events;
- repair narrowly defined delivery and attempt invariants.

It must not:

- decide project decomposition or priority;
- select a workflow by interpreting task prose;
- judge domain correctness;
- invent retries, blockers, or acceptance policy;
- encode AKS-, Scout-, or other app-specific strategy;
- scan the task graph as a scheduling queue.

Events are wakeups. Persisted task and Condition resources are truth. A bounded
recovery scan may detect missed delivery or broken invariants, but it feeds the
same reconciliation path and does not become a second scheduler.

## Uniform Handler Contract

Owner agents and workflows return one app-level result envelope:

```ts
type HandlerResult = {
  disposition:
    "converged" | "progressing" | "waiting" | "needs-owner" | "failed";

  summary: string;
  evidence: string[];
  actions?: AppAction[];
  conditions?: ConditionSpec[];
};
```

Handlers do not write the task graph directly. The app validates action scope,
expected generation, authorization, budget, idempotency, and evidence before
applying commands.

`progressing` must identify an observable continuation. `waiting` must reference
or create exact Conditions. `failed` ends the current attempt but does not by
itself decide the task's semantic disposition. `needs-owner` selects the owner
fallback on the next safe reconciliation boundary.

## Workflow Versus Agent

A workflow is not merely deterministic plumbing. It is executable experience
learned from prior agent work:

```text
observe
  -> perform a proven bounded sequence
  -> use skills and agents where judgment is still needed
  -> verify declared evidence
  -> return one structured disposition
```

A workflow may combine functions, tools, domain commands, agent steps, bounded
retries, independent review, and terminal checks. It owns how that known work
is performed, not the app's durable task storage.

Use the owner directly when the work is novel, ambiguous, preference-sensitive,
or still being learned. Bind a workflow when evidence shows that:

- the sequence should be consistent across runs;
- omitting or reordering steps creates meaningful risk;
- inputs, outputs, and terminal conditions are explicit;
- bounded checks or retries improve reliability; and
- the process is stable enough to test and maintain.

Worker output inside a workflow is evidence, not task authority. A bound
workflow's terminal result may be applied only within the dispositions granted
by its declared contract. Binding that contract is owner delegation. Anything
outside the contract returns `needs-owner` rather than silently expanding the
workflow's authority.

This preserves both accepted principles:

- worker completion alone does not define project truth;
- the owner need not reconstruct or personally handle every established
  process on every event.

## Events And Fallback

Event routing stays small:

```text
task-targeted event
  -> reconcile that task

Condition event
  -> update the Condition
  -> reconcile affected tasks

known mechanical app event
  -> deterministic projection or explicitly bound task/workflow

novel app-level event
  -> app owner entry

read-only query
  -> projection, no agent turn
```

An event does not need to invoke an agent merely because an agent owns the app.
Known work follows its workflow. Unknown meaning reaches the owner. The owner
may create or revise a task, bind a workflow, record a no-op judgment, ask a
human, or escalate.

Fallback is semantic recovery, not a retry loop:

```text
no workflow                       -> owner
workflow returns needs-owner      -> owner
workflow binding unavailable      -> owner repairs the binding
result violates its contract      -> owner with violation evidence
Condition becomes ambiguous       -> owner
strategy or acceptance must change -> owner
```

Repeated delivery of the same fallback packet is deduplicated by task,
generation, handler revision, and failure identity.

## Conditions And Durable Waits

Workflows and agent sessions remain bounded. They never sleep across a durable
external wait:

```text
handler run
  -> records an exact Condition
  -> returns waiting
  -> run ends

external event
  -> resolves or changes the Condition
  -> affected task is reconciled again
```

A Condition records the exact fact, observer, owner, freshness, and fallback
policy. A task references it; the task does not copy its changing state into a
large blocker narrative.

## Tree And Graph

The task tree is a human projection of task relationships, not an execution
engine:

```text
parentId   -> decomposition and containment
dependsOn  -> ordering
Condition  -> exact wait or prerequisite
```

Tree, graph, frontier, Kanban, rollups, and health are derived views over the
same resources. They do not own scheduling or duplicate parent/child state.
Attempts, sessions, workflow runs, reviews, and delivery traces remain runtime
facts linked by task ID and generation.

## Completion And Experience

An `achieve` task that converges goes through a short absorption boundary:

1. validate and apply its outcome to the parent, domain state, plan, or loop
   ledger that required it;
2. extract reusable experience into knowledge, a skill, a workflow, a test, or
   a workflow improvement task;
3. wake dependents;
4. retain a minimal completion reference for lineage and deduplication; and
5. remove it from the live graph.

The system does not need a full task archive to remember experience. Attempt
and evidence records keep bounded operational provenance. Durable value is
promoted into the surface where future work actually consumes it.

The learning path is:

```text
novel task
  -> owner handles it adaptively
  -> good and bad attempts produce evidence
  -> reusable judgment becomes a skill
  -> stable execution becomes a workflow
  -> future tasks bind that workflow
  -> workflow failures create focused improvement work
```

Repetition classification matters:

- the same unfinished goal is another attempt, not a new workflow;
- the same shape with new inputs is a workflow or task template candidate;
- a stable standing responsibility is a `maintain` task;
- an external wait is a Condition;
- repetition caused by controller defects means repair the reconciler or
  workflow rather than generating more project tasks.

## Loops And Focus Plans

A loop is a `maintain` task bound to a workflow:

```yaml
spec:
  outcome: Keep the selected AKS specs verified with current live evidence.
  mode: maintain
  workflow:
    name: spec-verification-loop
    input:
      concurrency: 3
```

Each event causes one bounded reconciliation pass. Several loop tasks may use
the same workflow with different inputs. Convergence means the desired state is
currently satisfied, not that the standing responsibility is complete.

A focus plan is normally an `achieve` parent task. Its children express the
current decomposition. It may be handled directly by the owner while the plan
is novel, then bind a reusable workflow if its operating process stabilizes.
Several focus plans may coexist when their dependencies and locks allow it.

No loop controller type, focus controller type, or controller-owned task state
is required. Their domain process is represented by workflows; generic task
mechanics remain in the reconciler.

## Core Invariants

1. Every live task resolves to exactly one accountable owner.
2. Every actionable reconciliation selects at most one handler.
3. A task generation has at most one current attempt.
4. A stale-generation result is evidence and cannot change current intent.
5. Handlers return structured results and commands; the app alone applies task
   and Condition mutations.
6. Every durable wait references an exact Condition.
7. Every workflow run and agent session is bounded.
8. Every semantic exception eventually resolves to the accountable owner.
9. Events wake reconciliation; the task graph is not a scheduling queue.
10. Workflow binding is explicit and invalid binding is observable.
11. Finished work leaves the live graph only after outcome absorption,
    dependent wakeup, and experience extraction.
12. No fact has two writable authorities.

## AKS-RP-E2E Convergence

The current AKS app validates the need for this model. At the design review
snapshot it had 127 live tasks, 117 blocked tasks, an explicit owner on every
task, and only eight workflow-bound tasks. App routing separately invokes a
planner, reviewed-task applier, task reviewer, task worker, problem solver,
watchdog, stall review, three loop controllers, and focus-plan handling.

The target mapping is:

| Current AKS mechanism                                      | Converged responsibility                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Task-worker event adapter                                  | Generic task reconciler invokes the resolved handler.                               |
| Task reviewer and reviewed-task applier                    | Bound workflow contract or owner fallback, followed by generic command application. |
| Planner dispatch, refill, and result-application mechanics | Generic reconciliation.                                                             |
| Planner decomposition and strategy                         | Smaller owner-entry workflow.                                                       |
| Watchdog and stall-review overlap                          | Reconciler delivery/attempt invariants plus exact Conditions.                       |
| Spec/reference/compact loop controllers                    | Reusable `maintain` workflows with domain logic preserved.                          |
| Blocked holder tasks and refresh schedules                 | Conditions and event-driven wakeup.                                                 |
| Stored parent rollups                                      | Derived projections.                                                                |

This proposal does not claim that all existing workflow code disappears. The
valuable spec verification, feature reference, compact planning, review, and
repair experience stays. The change removes duplicated control-plane roles and
makes that experience directly bindable to tasks.

## Evaluation App Pilot Evidence

The `evaluation.app` pilot was deployed on 2026-07-18. Seven direct workflow
handlers were replaced by task routes, four explicit workflow capabilities,
and one owner entry. Live evidence showed:

- known session aftermath and pipeline work resolved through their bound
  workflows without an owner turn;
- unfamiliar owner work resolved through `owner:evaluator`;
- concurrent session aftermath work used independent `achieve` tasks;
- completed `achieve` tasks left the live graph and retained bounded
  tombstones;
- recurring pipeline and backfill responsibilities remained as `maintain`
  tasks; and
- evaluator/judge terminal events were filtered before they could create
  self-evaluation tasks.

A production owner-action canary first exercised the proposed authority
boundary twice. Generation 3 asked the owner to create a canary task; the
evaluator session was persisted with `toolPolicy: readonly`, invoked only
`finish`, and returned a typed `create-task` action. Generation 4 returned a
typed `close-task` action with `expectedRevision: 0`. The owner sessions made no
direct file or task-tree mutation.

The follow-up implementation removed the evaluation-specific action applier.
Workflow completion now carries the structured handler result through the
typed workflow runner. The generic reconciler verifies the task generation,
attempt, and handler, validates the complete action batch, applies it, and
records the reconciliation outcome under one task-tree lock and save. A stale
claim exits before action validation or mutation, and one invalid action rejects
the whole batch. The boundary enforces action scope, expected revision, a
16-action budget, non-empty evidence, and protection for reconciler-owned
`runtime/*` tasks. `progressing` and `waiting` also end their attempts through
this boundary; `waiting` requires an identified Condition.

The post-deployment production canary then exercised this generic boundary in
both directions. Generation 5 used evaluator session `s_1784371353696_1` to
propose creation of `atomic-owner-action-canary-20260718`; event `3470662`
recorded `proposedActions`, and reconciliation event `3470665` recorded
`actionsApplied: ["created atomic-owner-action-canary-20260718"]`. Generation 6
used session `s_1784371415872_2` to propose its revision-checked closure; events
`3470744` and `3470747` recorded the proposal and applied action respectively.
Both sessions persisted `toolPolicy: readonly` and invoked only `finish`. The
task state records `created_by` and `done_by` as
`project-app-task-reconciler`, and no workflow-side task mutation occurred.

Two limitations remain explicit:

1. Condition identity validation and waiting-attempt termination have focused
   coverage, but end-to-end Condition event materialization and affected-task
   wake filtering are not yet proven in production.
2. `SubagentManager` is still the durable infrastructure facade and Gym still
   enters through the full May binary. Extracting the shared agent runner and
   moving Gym to direct runner use remain separate runtime work.

## Current Rollout And App Decisions

Migration is based on work semantics, not on making every event look alike.

| App                       | Current decision                                                           | Reason                                                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluation.app`          | Migrated; harden exact Condition authoring and owner-result quality.       | Session aftermath, scans, pipeline observation, project audits, and owner review all have durable desired-state identities.                                                                                                        |
| `may-agent.app`           | Migrated organized work; retain small deterministic event adapters.        | Ops observations, digest creation, and owner review are standing responsibilities; comment persistence and event filtering are projections, not tasks.                                                                             |
| `scout-knowledge-lib.app` | Migrated; keep independent source tasks and one owner fallback.            | Each source is a separate `maintain` task, digest and health are reusable workflows, and novel library maintenance belongs to Scout.                                                                                               |
| `aks-rp-e2e.app`          | Continue cohort migration.                                                 | It has the largest duplicated control plane and therefore the largest benefit, but live attempts and AKS-specific Condition behavior require incremental replacement.                                                              |
| `gym.app`                 | Do not task-migrate yet. Extract and reuse the neutral agent runner first. | Incident intake, benchmark execution, and review already form an immutable request/result pipeline. A task layer adds value only where deduplication, resumption, owner fallback, or desired-state observation is actually needed. |

The first AKS cohorts validate both task modes. The feature-compact controller
is a standing `maintain` task. Completion review and reviewed-task application
are paired `achieve` tasks whose stable identities are derived from the task
attempt and review identities. In production, review event `3489482` was
claimed through `aks-rp-e2e-task-reviewed-application`, invoked
`workflow:reviewed-task-applier`, and converged at event `3489531`. Completion
event `3490789` was then claimed through
`aks-rp-e2e-task-completion-review`, invoked `workflow:task-reviewer`, emitted
its structured decision, and converged at event `3490862`. Both tasks left the
live graph with bounded completion tombstones.

The completion-review cutover also exercised restart recovery. The reconciler
now persists the authored intent and trigger observation with each attempt,
distinguishes attempts from the current runtime instance, resumes a prior
runtime attempt through the same route, and releases older attempts that lack
a recoverable trigger into visible owner attention. Active-task projection is
derived from executable leaves and active workflow controllers rather than all
active parent rollups.

Task execution has now crossed that boundary. New `project.task.assigned`
events resolve to revision-and-attempt-stable `achieve` tasks bound to
`workflow:task-execution`; `task-worker` returns a typed disposition, and the
legacy direct assignment handler is absent from the manifest. The temporal
cutover allowed an already-running legacy workflow to finish at event
`3491771`, while assignment `3491801` was claimed only by route
`aks-rp-e2e-task-execution` at `3491803`. It emitted the normal completion
handoff, converged at `3491907`, passed through task review at `3491974`, and
through reviewed-result application at `3492038`. The execution, review, and
application tasks all left the live graph with bounded completion tombstones.

The next bounded cohorts are represented directly by their semantics:

- approval dispatch is an `achieve` task keyed by its path-and-packet approval
  lineage, with malformed or failed delivery returning `needs-owner`;
- each exact Condition fallback is an `achieve` task with no workflow binding,
  proving that semantic recovery resolves through the accountable owner;
- project stall review is one standing `maintain` task rather than a stream of
  repeated review jobs; and
- strategy and progress focus reviews are two independent `maintain` tasks
  using the same learned focus workflow, while the focus branches they create
  remain ordinary project tasks.

These four cohorts have manifest, stable-identity, typed-result, syntax, and
integrity coverage. Their natural-event production proof remains pending; the
old direct handlers have been removed, so each event cohort still has only one
authority during that observation window.

The next recommended AKS boundary is the spec loop, but only after its
watchdog-owned external waits are represented as exact Conditions. Do not
recreate the already-complete feature-reference loop as standing backlog.
Retire planner refill, watchdog, and stall-review overlap only after incident
replay and live parity prove that the reconciler and Condition wake path cover
the same recovery cases.

## Migration

Migration must replace paths rather than add a permanent V3 layer:

1. Compute `resolvedOwner` and `resolvedHandler` as read-only shadow
   projections for current tasks.
2. Treat existing task `workflow` values as explicit workflow bindings and
   report missing/invalid bindings without changing execution.
3. Require one app-owner fallback and prove owner inheritance in shadow.
4. Add the uniform handler-result envelope and generation checks at current
   task command boundaries.
5. Route a bounded cohort of new task wakes through the generic reconciler.
6. Convert future exact waits to Conditions and stop creating equivalent wait
   tasks for the cohort.
7. Move loop-controller domain behavior behind `maintain` task workflow
   bindings while preserving current ledgers and evidence.
8. Absorb task review into workflow contracts or owner fallback for the cohort.
9. Retire overlapping task-worker, reviewer-applier, watchdog, stall, and
   controller routes only after live parity and incident replay.
10. Remove compatibility fields and old routes once no active attempt depends
    on them.
11. Extract the May-specific agent runner from durable session coordination;
    move Gym to the same runner with sandbox observers before deleting its
    duplicated prompt construction.

During migration, old and new paths may coexist only behind an explicit cohort
gate. They must not both hold mutation authority for the same task generation.

## Acceptance Tests

The design is proven when:

1. A task with a valid workflow is handled without an owner turn.
2. A task without a workflow reaches its explicit, inherited, or app owner.
3. A workflow returning `needs-owner` reaches the same resolved owner exactly
   once.
4. A missing explicit workflow becomes `HandlerUnavailable` and does not
   silently execute through another process.
5. Two events for one task generation create at most one current attempt.
6. A stale result cannot change a newer task generation.
7. A waiting handler run ends and resumes only after its Condition changes.
8. Two `maintain` tasks can use one workflow independently.
9. Two focus plans can progress concurrently when their dependencies and locks
   permit it.
10. A completed `achieve` task leaves the live graph only after its outcome is
    absorbed and dependents are woken.
11. A workflow can be invoked both from a tracked task and directly with the
    same domain input and result contract.
12. Disabling the compatibility route for a migrated cohort does not change its
    accepted outcomes or evidence quality.
13. The same agent runner produces equivalent prompt, tool policy, and result
    behavior under Gym and autonomous infrastructure wrappers.
14. The agent runner imports no EventBus, task, scheduler, metrics, or database
    implementation; explicitly supplied tools may still provide those
    capabilities.

## Non-Goals

- Replacing the existing event, session, workflow, or task persistence engines.
- Making the task graph a queue or adding a durable generic request object.
- Routing every event through an LLM.
- Automatically selecting workflows from natural-language similarity.
- Treating workflow frequency alone as proof that a process is reusable.
- Moving app strategy into the generic reconciler.
- Retaining full completed task trees as the primary learning mechanism.

## Recommended Decision

Adopt this as the convergence target for task execution and app organization:

> An Agent App owns the organization. Each task records desired and observed
> state, resolves one accountable owner, and uses an explicitly bound workflow
> or that owner as its handler. One generic event-driven reconciler invokes the
> capability and applies its structured result. Workflows preserve learned
> execution; agents provide adaptive judgment; the app retains durable meaning.
