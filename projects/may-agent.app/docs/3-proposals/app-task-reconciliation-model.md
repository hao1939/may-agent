# Proposal: App Task Reconciliation Model

**Design status:** Canonical convergence target.
**Implementation status:** Convention-first app/task reconciliation is the
production contract as of 2026-07-19. Every active app has one resolver, one
deduplicating controller queue, convention workflow discovery, and owner
fallback. AKS live state has been transformed to resources, attempts,
Conditions, and completion receipts. Legacy task routes, capability maps,
owner-entry wrappers, synthetic task Cron handlers, tree mirroring, and the
AKS assignment/review/planner scheduler have been removed.

Imperative `onEvent` remains only for deterministic filtering or translation;
it does not execute project work. The infrastructure-independent agent runner
is implemented. Converging direct and hosted definition/tool preparation is a
separate follow-up in [implementation-simplification.md](implementation-simplification.md),
not an app/task reconciliation compatibility requirement.

## Executive Decision

Use one event-driven task reconciliation model for every Agent App:

> The app organizes work. Agents and workflows provide capabilities. A task
> records desired and observed state. An event wakes one generic reconciler,
> which invokes the task's workflow or falls back to its accountable owner.

```text
event or periodic resync
  -> identify one task or update one Condition
  -> enqueue task key
  -> one task reconciler compares spec with status
  -> invoke bound workflow, otherwise resolved owner agent
  -> validate and atomically apply the structured result
  -> update status and enqueue affected tasks
```

This proposal refines the boundaries in
[agent-app-runtime-model.md](agent-app-runtime-model.md). It does not introduce
a second runtime, a generic request lifecycle, or a new workflow engine.

## Mental Model

The public unit is the app. Internally, the pieces have distinct jobs:

| Concept     | Responsibility                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| App         | Organizes goals, tasks, workflow bindings, knowledge, events, permissions, watchers, and durable state.             |
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

## Convention-First Contract

The normal app declares less than the runtime derives. Required semantics do
not imply repeated configuration.

| Concern | Convention | Explicit configuration is needed only when |
| --- | --- | --- |
| App owner | Declare one `app.owner`; `agents/owner/` is the conventional local implementation directory. | Never; ambiguous ownership is a manifest error. |
| Task owner | Inherit from the nearest explicit ancestor, then the app owner. | A task has a different accountable owner. |
| Handler | Use `task.workflow` when present; otherwise invoke the resolved owner through the standard agent runner. | Never. There is no separately configured owner handler. |
| Workflow | Resolve `workflow: "name"` from the resolved agent's local `workflows/name` module. | A deliberately external workflow needs a qualified name. |
| Task mode | `achieve`. | The desired state is standing, so use `maintain`. |
| Parent | The app's root containment. | The task belongs under a more specific decomposition. |
| Priority | `P2`. | The owner intentionally raises or lowers it. |
| Event routing | A targeted task event reconciles `target.taskId`; a Condition event updates the Condition and reconciles its dependents. | An external event must be correlated into a new or standing task identity. |
| Concurrency and timeout | Use runtime and workflow defaults. | A proven domain constraint requires a narrower bound. |
| Context | Supply the task, linked Conditions, app context, and trigger observation automatically. | A workflow declares additional domain inputs in its own module. |

An app is invalid only when these rules cannot produce one owner or resolve an
explicit workflow under that agent. It should not repeat derived owner, handler, context,
timeout, route name, or event-graph metadata merely to satisfy the runtime.

The target manifest surface is correspondingly small:

```ts
defineProjectApp({
  id: "example",
  owner: "example-owner",

  tasks: {
    accepts: [
      { type: "project.owner.requested", target: { project: "example" } },
    ],
    resolve: resolveTask,
  },

  schedules: [/* emit events only */],
  actions: {/* action name -> event */},
  onEvent: projectReadModels, // optional deterministic projection only
});
```

`tasks.resolve` correlates non-targeted events with task identities. It does
not execute work. Multiple named task routes, route-local handler timeouts,
capability maps, and manually duplicated event graphs are migration surfaces,
not parts of the target contract.

An action has one conventional path: the host resolves
`app.actions[actionName]`, validates parameters, calls its event factory, and
emits that event once. `project.action.invoked` is an ingress envelope, not an
event every app must redispatch by hand. Read-only actions execute through the
same named action boundary without entering task reconciliation.

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

`agent-runner.ts` and `agent-execution.ts` are the neutral execution boundary.
`SubagentManager` is the current infrastructure facade, not the agent core;
its durable session coordination, event adaptation, timeout, and recovery
belong to the infrastructure wrapper. A rename is not required to preserve
that dependency direction.

## One Task Resource

A task follows the Kubernetes `spec`/`status` shape. Compatibility aliases may
exist only at a bounded migration reader; they are not valid authoring forms.
New writes use this shape.

```ts
type Task = {
  metadata: {
    id: string;
    generation: number;
    resourceVersion: number;
  };

  spec: {
    outcome: string;
    acceptance: string[];
    mode?: "achieve" | "maintain"; // default: achieve

    owner?: string;
    workflow?: string;
    input?: Record<string, unknown>;

    parentId?: string;
    dependsOn?: string[];
    outputs?: string[];
    priority?: "P0" | "P1" | "P2" | "P3"; // default: P2
  };

  status: {
    observedGeneration: number;
    phase: "pending" | "running" | "waiting" | "converged" | "attention";
    currentAttempt?: string;
    conditionIds?: string[];
    summary?: string;
    evidence?: string[];
  };
};
```

`spec` is owner intent. `status` is an observation written through app/runtime
commands. `generation` changes whenever owner intent changes in a way that can
invalidate execution. Attempts and results carry the task generation and cannot
close or rewrite a newer generation. Every mutation also compares
`resourceVersion`, so two reconcilers cannot silently overwrite each other.

Task modes are intentionally small:

- `achieve` converges once. Its outcome is absorbed and it then leaves the live
  graph.
- `maintain` expresses a standing desired state. Convergence means no action is
  needed now; a later event may wake the same task again.

Loops are ordinary `maintain` tasks. Focus plans and normal bounded work are
normally `achieve` tasks. There is no separate loop-task scheduler or focus-task
lifecycle.

The phase vocabulary above is the writable reconciliation authority. The
co-located `backlog`, `active`, `blocked`, `review`, and `done` task view is a
derived human projection for decomposition and existing project views; it is
not another handler result contract or mutation authority.

## Task Authoring Contract

The shared SDK type is the schema authority. Project docs may explain their
tasks, but must not define incompatible app-specific task shapes.

| Field        | Authoring rule                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Stable business identity. Sanitized or shortened external identifiers retain a digest so distinct inputs cannot collide.               |
| `parentId`   | Durable decomposition or containment only; it is not a scheduling edge.                                                                |
| `outcome`    | One desired end state, written as an outcome rather than an activity such as "investigate" or "monitor".                               |
| `acceptance` | One or more observable postconditions that can prove convergence from artifacts, records, events, or external state.                   |
| `mode`       | Omit for the conventional `achieve` mode; write `maintain` only for standing desired state. No other task kind is needed.               |
| `owner`      | Optional explicit accountability override. Otherwise ownership resolves from the nearest ancestor and then the app.                    |
| `workflow`   | Optional local workflow name. Absence means owner handling; an invalid binding is visible failure.                                      |
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
7. A parent task expresses its own meaningful outcome and acceptance; its
   status reflects only its own reconciliation. Child progress is a derived
   branch projection, not writable parent rollup state. A grouping label with
   no outcome is a view, not a task.
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

Use one generic reconciler implementation and one work queue, logically scoped
to each app instance. Event selectors are correlation rules, not separately
scheduled controllers. It performs only mechanical steps:

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

Events are hints that enqueue resource keys. Persisted task and Condition
resources are truth. Duplicate or lost events therefore do not change the
answer: reconciliation is level-based and idempotent. A bounded periodic
resync enqueues live tasks to recover missed delivery and configuration drift;
it feeds the same path and does not make scheduling decisions from the tree.

Cron owns time only. It may emit a wake event or request a resync, but task
selectors must not be installed as synthetic Cron handlers. Workflow names
such as `spec-loop-controller` describe legacy implementation history; in the
target model they are ordinary domain workflows such as `spec-verification`.

## Uniform Handler Contract

Owner agents and workflows return one app-level result envelope:

```ts
type HandlerResult = {
  state: "converged" | "waiting";
  summary: string;
  evidence: string[];
  actions?: AppAction[];
  conditions?: ConditionSpec[];
} | {
  state: "needs-owner";
  reason: string;
  evidence?: string[];
};
```

Handlers do not write the task graph directly. The app validates action scope,
expected generation, authorization, budget, idempotency, and evidence before
applying commands.

The states have one meaning each:

- `converged`: the handler finished the current reconciliation and may include
  bounded follow-up task actions;
- `waiting`: no run should remain open; exact Conditions identify what can
  change the answer; and
- `needs-owner`: a workflow declines semantic authority and hands the same task
  to its resolved owner once.

`needs-owner` is valid only from a workflow. An owner that needs human or
external input returns `waiting` with a Condition or emits an escalation
action; it cannot hand the task back to itself.

Failure is not a task state and is not a successful result envelope. A thrown
error or invalid result fails the attempt. Infrastructure may retry the same
handler with bounded backoff; exhaustion records `attention` and wakes the
owner. If the owner attempt fails, the task remains in `attention` for a later
event or human intervention. It never recursively falls back to itself.

External continuation is always `waiting` with an exact Condition. A domain
watcher owns monitoring and emits the matching event; the task reconciler only
persists the correlation and wakes the task. `converged` is still a claim: the
app checks generation, authorization, command validity, and declared
postconditions before accepting it. A workflow should expose a deterministic
`verify` function beside its handler when its postconditions can be checked
mechanically; the runtime calls it by convention without a separate manifest
entry. Otherwise semantic acceptance belongs to the owner.

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
task created or spec generation changes
  -> reconcile that task

task-targeted event
  -> reconcile that task

Condition event
  -> update the Condition
  -> reconcile affected tasks

known mechanical app event
  -> deterministic projection or explicitly bound task/workflow

novel app-level event accepted by the task resolver
  -> task without workflow binding
  -> resolved app owner

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

### One Feedback And Recovery Loop

All continuation returns through the same resource reconciliation path:

```text
result commands change resources
  -> commit once
  -> enqueue changed task and affected dependents
  -> reconcile from fresh state

handler error
  -> retry same generation and handler with bounded backoff
  -> on exhaustion, record attention and enqueue owner handoff

owner error
  -> record attention
  -> wait for resync, new evidence, or human action
```

There is no separate reviewer-applier loop, recovery controller, watchdog task,
or result event required for the normal path. Independent review is a domain
workflow step or a separate task only when the task's acceptance policy truly
requires a different authority. Watchdogs observe controller health and enqueue
keys; they do not mutate task meaning or invent work.

The controller may retry transport and lease failures because those are
mechanical. It may not retry a rejected domain result, rewrite acceptance,
create a blocker, or choose a different workflow. Those are owner decisions.

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

A Condition is another small `spec`/`status` resource:

```ts
type Condition = {
  metadata: { id: string; generation: number; resourceVersion: number };
  spec: {
    type: string;
    subject: string;
    expected: unknown;
    owner?: string;       // default: referencing task owner
  };
  status: {
    observedGeneration: number;
    state: "unknown" | "false" | "true";
    observed?: unknown;
    observedAt?: string;
    evidence?: string[];
  };
};
```

The event source is the observer by convention. Domain watchers own polling,
provider retries, and replay of current external state; the task controller
never substitutes age for an observation. A task references Condition IDs; it
does not copy their changing state into a blocker narrative. `waiting_for`,
`blocker`, refresh schedules, and status aliases are legacy representations,
not alternate authoring forms.

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

A parent task has status only for its own desired state and attempt. Branch
health such as "three children waiting" is a projection and never overwrites
that status. If a node exists only to label a group and has no outcome to
reconcile, it is a view/category, not a fake task. The app root is the default
containment parent and does not need a schedulable root-task record.

## Completion And Experience

An `achieve` task that converges goes through a short absorption boundary:

1. validate the generation, result, declared postconditions, and output
   absorption;
2. atomically apply its commands and durable output references;
3. retain one minimal completion receipt for lineage and deduplication;
4. remove it from the live graph; and
5. enqueue dependents from the committed state.

This is the task equivalent of one runtime-owned finalizer. Apps do not
configure finalizer lists or write deletion hooks for ordinary tasks; the
controller performs this same absorption transaction for every `achieve`
task.

The system does not need a full task archive to remember experience. Attempt
and evidence records keep bounded operational provenance. Durable value is
promoted into the surface where future work actually consumes it.

Experience promotion is not allowed to hold a completed task in the live
graph. Completion receipts carry the task shape, workflow, outcome, evidence,
and failure fingerprints needed to detect repetition. A bounded observer may
suggest a skill, workflow, test, or `maintain` task when the same useful shape
recurs; the owner decides whether to promote it. This retains learning without
turning every completion into another mandatory review loop.

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
11. Finished work leaves the live graph only after outcome absorption and a
    completion receipt make dependent wakeup and later learning safe.
12. No fact has two writable authorities.

## AKS-RP-E2E Convergence

The AKS cutover is the production proof for this model. While paused, the
authoritative 315-node legacy graph was atomically transformed into 169 live
nodes, 154 executable resources, 133 typed Conditions, 162 durable attempts,
and 1,156 completion receipts. Ninety-nine finished leaves were absorbed and
47 assignment/review/application wrapper tasks were retired. The transform
reported zero invalid tasks.

The target mapping is:

| Current AKS mechanism                                      | Converged responsibility                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Task-worker event adapter                                  | Generic task reconciler invokes the resolved handler.                               |
| Task reviewer and reviewed-task applier                    | Bound workflow contract or owner fallback, followed by generic command application. |
| Planner dispatch, refill, and result-application mechanics | Generic reconciliation.                                                             |
| Planner decomposition and strategy                         | Resolved owner agent; bind a workflow only after that process becomes reusable.     |
| Watchdog and stall-review overlap                          | Reconciler delivery/attempt invariants plus exact Conditions.                       |
| Spec and compact loop controllers                          | Reusable `maintain` workflows that return actions and Conditions.                   |
| Blocked holder tasks and refresh schedules                 | Conditions and event-driven wakeup.                                                 |
| Stored parent rollups                                      | Derived projections.                                                                |

Only six AKS workflows remain executable: focus review, stall review, approval
dispatch, problem solving, spec-loop reconciliation, and compact-loop
reconciliation. They preserve reusable domain process while the generic
controller owns claims, retries, task changes, Conditions, completion
absorption, and dependent wakeup. Unbound work always resolves to the app or
task owner.

## Implementation Status

The convention-first contract is implemented across the active Agent Apps:

| App | Current state |
| --- | --- |
| `evaluation.app` | One resolver/controller, workflow discovery, and owner fallback. |
| `may-agent.app` | Standing platform responsibilities use scoped semantic events and the same controller. |
| `scout-knowledge-lib.app` | Research, digest, health, and owner work use maintain tasks and learned workflows. |
| `gym.app` | Incident, regression, and proposal work use the shared app contract. |
| `aks-rp-e2e.app` | Graph migrated to resources, attempts, Conditions, and receipts; active on the convention controller. |

Steady state has no task routes, owner-entry wrapper, workflow registry,
manual event graph, assignment/review pipeline, task archive, mirrored
`tasks/tree.json`, or app-specific scheduler. Declared actions are translated
once by infrastructure. Targeted events, Condition observations, restart
recovery, and resync all enqueue the same task key in one app work queue.

AKS retains six reusable workflows: approval dispatch, focus review, project
stall review, problem solving, spec-loop reconciliation, and feature-compact
reconciliation. Other work resolves directly to its accountable owner. Exact
external waits are Conditions; completed achieve tasks are receipts; parent
and Kanban views are projections.

AKS was reactivated after the paused transform. Live owner-fallback and active
restart probes on 2026-07-20 showed one controller runtime generation, one
session per claimed task, no duplicate attempts, and no generic resumption of
task-bound sessions. Task session recovery is explicitly owned by the app task
reconciler; the generic session runtime interrupts prior task sessions while
the controller re-enqueues their persisted resource keys.

The neutral agent core is also implemented. Direct/hosted agent-definition and
tool-construction parity remains a separate simplification proposal, not an
alternate Agent App execution path or unfinished task-reconciliation cutover.

## Migration

Migration must replace paths rather than add a permanent V3 layer:

1. Fix single-authority defects first: scoped selectors, action translation,
   acknowledgement after successful handling, and atomic result application.
2. Introduce the convention-first surface: one app owner, one task resolver,
   local workflow discovery, one result contract, and one selector matcher.
3. Make targeted task events, Condition events, and periodic resync enqueue the
   same app work queue; remove synthetic task Cron handlers.
4. For AKS, pause new assignment, drain or settle current attempts, and take a
   migration snapshot. Do not transform live task generations underneath
   running workers.
5. Transform the live graph once: retain desired tasks, convert exact waits to
   Conditions, derive parent views, write completion receipts, and move leases,
   assignments, review delivery, and retries into runtime state.
6. Start the generic controller, enqueue every live task, and verify replay of
   assignment, completion, Condition, restart, and stale-result incidents.
7. In the same cutover, delete task-tree scheduling APIs, state aliases,
   `tasks/tree.json` mirroring, archive/restore support, capability maps,
   owner-entry wrappers, duplicated event graphs, and retired handlers.
8. Use the extracted neutral agent runner from both durable sessions and Gym;
   keep direct/hosted definition and capability convergence in its separate
   implementation proposal.

Across apps, migration may proceed in bounded cohorts. Within one app/task
generation, cutover is singular: old and new paths must never both hold
mutation authority. A completed cohort keeps no indefinite compatibility
writer or mirror.

## Acceptance Tests

The design is proven when:

1. A task with a valid workflow is handled without an owner turn.
2. A task without a workflow reaches its explicit, inherited, or app owner.
3. A workflow returning `needs-owner` reaches the same resolved owner exactly
   once.
4. A missing explicit workflow becomes `HandlerUnavailable`; the owner may
   repair the binding, but the task is not silently executed as if unbound.
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
13. Gym and durable sessions invoke the same neutral agent preparation and
    execution core; caller-specific persistence remains outside it.
14. The agent runner imports no EventBus, task, scheduler, metrics, or database
    implementation; explicitly supplied tools may still provide those
    capabilities.
15. One app task controller handles targeted events, correlations, Condition
    changes, and resync without installing task routes as Cron handlers.
16. Removing one wake event does not change eventual convergence because a
    resync reaches the same result from persisted resources.
17. An app action is translated through its declared action exactly once; apps
    do not reimplement action-name dispatch in `onEvent`.
18. The normal app needs no owner-entry wrapper, workflow capability map,
    manual event graph, route name, or duplicated context declaration.

## Non-Goals

- Replacing the storage technology merely to rename the model. Schema and
  authority cleanup are in scope; a new database product is not.
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
