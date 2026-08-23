# May-Agent SDK

**Design status:** Accepted.
**Implementation status:** Every current App uses `task(input)` and Task
reconciliation, and the request-disposition surface has been removed. The
shared bounded Task collection is exposed as `read.tasks.list/get`. Public App
and Task intent use `agent` to select a managed agent. The Host accepts the old
`owner` spelling only at compatibility boundaries for retained state.

`@may-agent/sdk` is the narrow boundary between an App and the Host. It
describes meaning, inputs, results, facts, and desired work; it does not expose
Host storage or execution mechanics.

```text
App definition -> input-to-task policy + task reconciliation
workflow       -> one bounded task step using scoped capabilities
Runtime        -> task lifecycle, execution, reads, retries, and recovery
Host           -> ingress, persistence, scheduling, capacity, and delivery
```

See [App Contract](agent-app.md) and
[Task Resource Engine](task-resource-engine.md).

## Stable root surface

The root package exports:

- `defineApp`, `Type`, and App declaration types;
- `AppInput`, `TaskIntent`, task reconciliation results, and `AppResult`;
- `AppEvent`, `EventSelector`, and pure selector matching;
- input/event schedules, subscriptions, observation-only selectors, observers,
  actions, and workspace policy;
- task policy, `TaskAction`, Conditions, reconciliation and verification
  results; and
- bounded workflow, read, logging, metric, and execution contracts.

It does not export raw SQL, task-state files and locks, scheduler handles,
global runtime paths, queue/lease/recovery APIs, prompt packets, request
dispositions, or a generic event handler context.

The Host's generic `publish/get/subscribe` interface is also not an SDK
capability. Apps use only narrow typed capabilities during a task attempt:

- call an agent or bounded workflow;
- read scoped resources;
- request a typed cross-App dependency when the outcome crosses ownership;
- emit facts or record metrics; and
- return the task's observed state, evidence, and desired changes.

All reach the same persistence path after the App boundary accepts them, but
App code cannot forge provenance, control sessions, or publish arbitrary
required event types.

There is one App declaration function: `defineApp`. The former
`defineProjectApp` declaration and `@may-agent/sdk/legacy` entry point have been
removed.

## App declaration

```ts
defineApp({
  id,
  version: 1,
  agent,
  inputSchema,
  task,
  subscriptions,
  observations,
  schedules,
  observers,
  actions,
  workspace,
});
```

The declaration is data and pure policy. Importing it cannot start sessions,
register global handlers, write storage, or inspect runtime state.

### Task resolution

`task(input)` is pure policy. It receives one validated App input and returns
the stable existing task reference or desired `TaskIntent` that owns the work.
The Runtime persists the link before waking the task. The App never handles the
Host request record, delivery state, claim, lease, channel, or retry metadata.

The resolver must not call an agent, inspect mutable context, or guess semantic
references. When free-form input such as human feedback needs judgment, it
creates a stable input task first. That task's ordinary reconciliation may then
return a typed revision, wake, or dependency for the referenced work. Exact
structured task references may wake their task directly.

This rule has no fast-path exception. A simple input resolves to a task whose
first bounded attempt can converge immediately. A hard input resolves to a task
that may require later attempts, Conditions, child tasks, or agent judgment.

### Fact Event policy

A subscription combines a stable ID, selector, and pure `toInput(event)`
translator. The translated input uses the same `task(input)` resolver as every
other App input. A fact that already identifies a task or satisfies one of its
Conditions wakes that task directly; it does not pass through a second
subscription or execution model.

No SDK callback receives a generic mutable event context. App policy cannot
launch an agent or workflow while deciding how a fact routes.

### Timed and external input

An App schedule contains exactly one of:

- `input`, which the Host admits through the same input-to-task path, with
  optional catch-up; or
- `event`, for a fact published by the Host scheduler.

An observer receives only `ObserverContext` and returns facts for the Host to
publish after a successful run. An action validates parameters and translates
them to App input. Neither can run App work directly.

## Workflow contract

App-owned workflows receive one typed input and scoped capabilities:

```ts
type WorkflowContext<TInput> = {
  input: TInput;
  reconciliation: TaskReconciliationContext<TInput>;
  read: AppRead;
  agents: {
    call(agent: string, task: string): Promise<ExecutionResult>;
  };
  workflows: {
    run(name: string, input: unknown): Promise<ExecutionResult>;
  };
  events: {
    emit(event: AppEvent): Promise<void>;
  };
  metrics: {
    record(id: string, value: number, note?: string): Promise<void>;
  };
  workspace?: { root: string; output: string };
  log: Logger;
  done<T>(summary: string, output?: T): ExecutionResult<T>;
  blocked(reason: string, evidence?: unknown): ExecutionResult;
};
```

The workflow input is App-owned. The Host carries it across the execution
boundary without parsing prompts or reconstructing it from global task state.

For App-owned work, `reconciliation` supplies bounded current facts:
App/task identity, generation, selected agent, mode, outcome, acceptance, typed input,
live/completed child views, a bounded snapshot of other live App tasks for
frontier-health review, and the ordered unobserved event batch that drove this
attempt. Snapshot entries carry only planning facts: identity, parent,
generation, bounded outcome, status, category, readiness, and compact Condition
references. They do not copy every other Task's input, acceptance, result
evidence, or attempt detail into each execution. The current task is omitted,
the list is capped at 64, and `truncated` makes an incomplete view explicit.
When one exact Task matters, the workflow calls `read.tasks.get(taskId)`. This
is not a global task-tree or storage API.

The event batch has `items`, `throughEventId`, and `truncated`. `items` are
ordered by durable event identity. `throughEventId` is the highest event in the
presented batch, not a caller-controlled acknowledgment. Runtime advances the
task checkpoint only when it accepts the reconciliation result. A failed,
interrupted, rejected, or stale result observes nothing. Compatibility may
exist only in retained Host persistence; App code reads the ordered `events`
batch and uses its final item when it needs the most recent event.

`read` contains exact bounded projections. Ordinary resources use one
collection shape: bounded summary pages from `list` plus explicit detail from
`get`. Large desired input and exact Conditions cross the boundary only for the
named Task. The runtime binds both reads to the current App:

```ts
type AppRead = {
  appResult(itemId: string): Promise<AppResult | null>;
  tasks: {
    list(options?: TaskListOptions): Promise<TaskPage>;
    get(taskId: string): Promise<TaskDetail | null>;
  };
  execution(executionId: string): Promise<ExecutionView | null>;
  metric(metricId: string): Promise<MetricView | null>;
};
```

The current shared `TaskView` contains `id`, `status`, `generation`, `outcome`,
and bounded summary, response, and evidence fields. SDK, HTTP, socket, and the
agent tool return that same projection. The current `task(taskId)` method is a
compatibility alias during migration.

There is no unrestricted or cross-App query surface and no database escape
hatch. Lists use typed filters, hard page caps, and opaque continuation tokens.
Genuine new read requirements become narrow resource projections with explicit
scope and shared contract tests.

### Host-private maintenance is not an SDK extension

A scheduled system job that must query runtime-owned ledgers, use global host
paths, or deliver an operational report is not an App workflow and does not
justify widening `WorkflowContext`. It uses a host-private adapter contract and
is scheduled by the host. If it discovers actionable domain work, it publishes
a fact into a declared App route; it does not mutate App inbox/task state or
become another controller.

Host-handler source may live near the operations agent that owns the diagnosis,
but it is not exported from `@may-agent/sdk`. A repository-local structural type
exists only to typecheck that host integration against the paired Runtime.

## One execution result

Agent calls and nested workflows return the same bounded terminal shape:

```ts
type ExecutionResult<T = unknown> = {
  id: string;
  kind: "agent" | "workflow";
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  evidence?: unknown;
};
```

`done` and `blocked` end the current bounded workflow run. They do not mutate or
complete a task by themselves. The Runtime validates the result against the
owning task and App acceptance policy before admitting it.

A durable wait is represented by a task dependency or Condition, not by holding
a workflow open or resuming it as a hidden controller.

## Task contracts

`TaskIntent` declares desired work:

```ts
type TaskIntent = {
  id: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  mode: "achieve" | "maintain";
  agent?: string; // selected agent for bounded attempts
  owner?: string; // deprecated input alias; normalized at the Host boundary
  workflow?: string;
  executor?: string;
  input?: Record<string, unknown>;
  outputs?: string[];
  dependsOn?: string[];
  priority?: "P0" | "P1" | "P2" | "P3";
  category?: string;
};
```

The App owns this Task. `agent` selects a managed agent for the attempt,
inheriting from the parent Task and then the App default; it is not a second
work owner. Runtime may retain `owner` in stored rows and projections during
migration, but that storage name must not leak back into the mental model.

`executor` selects a lowercase registered adapter name. Omitted or `agent`
uses the App's default agent; `codex` and `claude` are built-in native CLI
adapters. A Task cannot set both `workflow` and `executor`. An unknown name
becomes visible attention instead of silently falling back.

All executor adapters translate one small contract:

```ts
type TaskAttempt = {
  appId: string;
  task: TaskDetail;
  cwd: string;
  events: TaskReconciliationEvents;
  publish(localKey: string, event: AppEvent): Promise<{ eventId: number }>;
  onEvent(listener: (event: AppEvent) => void): () => void;
};

type TaskExecutor =
  (attempt: TaskAttempt) => Promise<TaskReconcileResult>;
```

`appId` scopes the Task identity and `cwd` is the attempt working directory.
`publish` is immediate, durable, idempotent within the Task generation, and
rejected after the attempt fence expires. `onEvent` is only a live convenience;
the addressed event is also durable Task input for replay on a later attempt.
Task-owned workflows expose these as `ctx.events.emit` and
`ctx.events.onEvent`; Runtime removes live listeners when the bounded workflow
ends. The returned result is the only Task state transition.

Runtime creates one fenced attempt, then hands that same object to the selected
adapter. Omitted or `agent` selects the managed-agent adapter. For another
name, a Host registration takes precedence over the built-in `codex` and
`claude` adapters, so either native CLI can be replaced without changing Task
state or reconciliation. Registering an executor adds a function, not a queue,
worker lifecycle, retry policy, or store.

One fenced reconciliation attempt returns a typed state, summary, evidence,
optional caller-facing response, task changes, Conditions, and typed cross-App
dependencies. The
current compatibility field and type are `actions` and `TaskAction`; they mean
task changes, not App commands or a separate action lifecycle. Runtime
admission validates generation, change scope, Conditions, dependencies, and
verification evidence before any mutation becomes authoritative.

`summary` describes the task decision for operators and later reconciliation.
`response` is optional semantic content for callers linked to the task. Runtime
stores it with the accepted task result and Infra projects it to those requests;
an App never names console, Telegram, web, or delivery receipts in the result.

A cross-App dependency is valid only with `state: "waiting"`:

```ts
type TaskAppDependency = {
  id: string; // stable within this task generation
  appId: string;
  input: AppInput;
};
```

Runtime derives the initial child request ID from the parent App, task
generation, dependency ID, target App, and input. It admits the request
idempotently and adds the exact completion Condition. Later attempts retain
every open child-request Condition. They reuse a request by returning its
durable request ID, or by repeating the exact target input; changed prose does
not create another request when the durable ID is named. To add genuinely new
work for the same target App, return both the existing durable request and a
new stable dependency ID and input. A replacement that omits the open request
fails before publication. The completion Event is part of a later
`reconciliation.events` batch, including the child summary, optional response,
and evidence. There is no imperative `delegate()` capability.

Apps may supply pure task-change validation and bounded verification policy.
They do not save task state, acquire locks, edit projections, or manufacture
attempts.

## Fact Events and metrics

`ctx.events.emit` publishes facts only. It cannot attach a task or directly
schedule another workflow. If a published fact is actionable, the destination
App must translate it to input, or the fact must identify an exact task or
Condition to wake.

`ctx.metrics.record` records a domain sample. Thresholding, hysteresis,
deduplication, storage, and Host health metrics belong to the Host. A
metric event remains a fact/wake, never desired state.

## Workspace and paths

Workflows receive only the workspace allocated to their execution and an
output path. Portable domain code resolves from that workspace. App code must
not derive daemon, repository, agent, or persistent-state roots from the process
working directory.

Offline repair or migration that genuinely needs storage access belongs in an
explicit maintenance CLI, not a runtime workflow import.

## Agent tools and SDK

Agent tools and SDK capabilities may share runtime implementations, but they
serve different boundaries:

| Intent                                         | Model tool                   | Workflow capability        |
| ---------------------------------------------- | ---------------------------- | -------------------------- |
| Ask another agent and await its bounded result | agent call                   | `ctx.agents.call`          |
| Run a reusable bounded workflow                | workflow tool                | `ctx.workflows.run`        |
| Publish a fact                                 | event tool where authorized  | `ctx.events.emit`          |
| Publish from the current fenced Task attempt   | `tasks` publish              | `ctx.events.emit`          |
| Record a domain sample                         | metric tool where authorized | `ctx.metrics.record`       |
| Read this App's Tasks                          | `tasks` list/get             | `ctx.read.tasks.list/get`  |
| Finish this bounded execution                  | finish/result                | `ctx.done` / `ctx.blocked` |

Background forks, session steering, cancellation, process control, and human
delivery are host/agent-tool capabilities only when explicitly granted. They
are not generic workflow SDK methods.

## Extension rule

Extend the SDK only when a task cannot be reconciled through the existing
semantic contracts:

1. identify the exact App-owned question;
2. add the narrowest typed capability or projection answering it;
3. keep persistence, retry, delivery, and recovery mechanics host-private;
4. prove scope, restart behavior, and idempotency; and
5. avoid generic list, query, command, path, or database escape hatches.

App growth should normally add input schemas, task policy, acceptance rules,
workflows, or domain projections—not another lifecycle. A capability may make
one task attempt more capable; it must not give the App storage ownership,
background loops, scheduling, retries, recovery, or delivery mechanics.

The SDK does not expose `defineService`, a service locator, or generic
`provides`/`inject` composition. App-local pure code is an ordinary module
import. Cross-App work is requested as a typed Runtime-owned dependency in the
task result, and cross-App facts use declared subscriptions. Runtime subsystem
composition remains Host-private.

## Integrity checklist

- The root package is the only authoring entry point.
- App definitions are pure to import and validate.
- Every actionable App input resolves to or wakes exactly one task.
- Task reconciliation is the only App work loop.
- Workflow input is typed and never reconstructed from prompt text.
- Every capability is bounded to one semantic responsibility.
- Reads are exact typed projections; writes are expressed as typed results or
  facts.
- Execution results are bounded claims admitted against the owning task.
- No App/workflow receives raw SQL, global paths, task storage, scheduler,
  queue, lease, delivery, or recovery access.
- Host-private maintenance handlers remain outside the public SDK and cannot
  provide a parallel App work lifecycle.
- No application or runtime package exposes or imports a legacy SDK entry point.
