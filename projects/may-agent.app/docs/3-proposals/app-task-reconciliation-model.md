# Proposal: App Task Reconciliation Model

**Design status:** Draft proposal.
**Implementation status:** Not implemented as one coherent path. Existing
project apps already provide tasks, owners, workflows, events, Conditions, and
revisioned attempts, but route them through several app-specific controllers.

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

| Concept | Responsibility |
| --- | --- |
| App | Organizes goals, tasks, ownership, workflows, knowledge, events, permissions, and durable state. |
| Task | Records one desired outcome, its relationships, and observed reconciliation state. |
| Owner agent | Makes adaptive semantic decisions and is the guaranteed accountability fallback. |
| Workflow | Preserves a learned, repeatable process for a known task shape. |
| Skill | Gives an agent reusable judgment guidance inside a task or workflow step. |
| Tool | Performs one atomic operation. |
| Runtime | Delivers events, leases attempts, invokes capabilities, validates commands, persists state, and recovers mechanics. |

The compact rule is:

> Tools can act. Agents can figure things out. Workflows know a proven way.
> Apps organize everything toward a goal.

The app owns the organization and its durable state. The owner agent authors
semantic changes to that organization through typed decisions. App code does
not become a second planner merely because it applies those decisions.

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
    | "converged"
    | "progressing"
    | "waiting"
    | "needs-owner"
    | "failed";

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

| Current AKS mechanism | Converged responsibility |
| --- | --- |
| Task-worker event adapter | Generic task reconciler invokes the resolved handler. |
| Task reviewer and reviewed-task applier | Bound workflow contract or owner fallback, followed by generic command application. |
| Planner dispatch, refill, and result-application mechanics | Generic reconciliation. |
| Planner decomposition and strategy | Smaller owner-entry workflow. |
| Watchdog and stall-review overlap | Reconciler delivery/attempt invariants plus exact Conditions. |
| Spec/reference/compact loop controllers | Reusable `maintain` workflows with domain logic preserved. |
| Blocked holder tasks and refresh schedules | Conditions and event-driven wakeup. |
| Stored parent rollups | Derived projections. |

This proposal does not claim that all existing workflow code disappears. The
valuable spec verification, feature reference, compact planning, review, and
repair experience stays. The change removes duplicated control-plane roles and
makes that experience directly bindable to tasks.

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
