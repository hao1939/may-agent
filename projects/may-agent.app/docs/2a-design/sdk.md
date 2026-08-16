# May-Agent SDK

**Design status:** Accepted.
**Implementation status:** Implemented. The package contains only stable App,
task, bounded workflow/guard, and testing authoring contracts.

`@may-agent/sdk` is the narrow boundary between an App and the Host. It
describes meaning, inputs, results, facts, and desired work; it does not expose
Host storage or execution mechanics.

```text
App definition -> pure policy and capability declarations
workflow       -> bounded input + scoped capabilities -> ExecutionResult
Host           -> admission, storage, delivery, execution, and recovery
```

See [Agent App Contract](agent-app.md) and
[Task Resource Engine](task-resource-engine.md).

## Stable root surface

The root package exports:

- `defineApp`, `Type`, and App declaration types;
- `AppInput`, `AppRequest`, `AppDisposition`, and `AppResult`;
- `AppEvent`, `EventSelector`, and pure selector matching;
- input/event schedules, subscriptions, observation-only selectors, observers,
  actions, and workspace policy;
- optional task policy, `TaskIntent`, `TaskAction`, Conditions, reconciliation
  and verification results; and
- bounded workflow, read, logging, metric, and execution contracts.

It does not export raw SQL, task-state files and locks, scheduler handles,
global runtime paths, queue/lease/recovery APIs, prompt packets, or a generic
owner-inbox/event handler context.

The Host's generic `publish/get/subscribe` interface is also not an SDK
capability. Apps keep narrow typed operations:

- return a `delegate` disposition and let the Host publish the child App input;
- return facts from observers;
- use fact-only `ctx.events.emit` inside a bounded workflow; and
- return results/intents for Host admission.

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
  owner,
  inputSchema,
  route,
  subscriptions,
  observations,
  inbox,
  schedules,
  observers,
  actions,
  workspace,
  tasks,
});
```

The declaration is data and pure policy. Importing it cannot start sessions,
register global handlers, write storage, or inspect runtime state.

### Request policy

`route(request)` receives an immutable author-visible `AppRequest` and returns
`complete`, `delegate`, `task`, or `null`. `null` asks the App owner for one
bounded judgment. The request exposes typed input and a bounded dependency
observation, never its database row, claim, lease, channel, or delivery fields.

### Fact policy

A top-level subscription combines a stable ID, selector, and pure
`toInput(event)` translator. It explicitly creates a correlated App request.

`tasks.subscriptions` combines selectors with pure `resolve(event)` policy. It
returns the latest `TaskIntent` or `null`; the Host persists it before waking
the task reconciler.

No SDK callback receives a generic mutable event context. App policy cannot
launch an agent or workflow while deciding how a fact routes.

### Timed and external input

An App schedule contains exactly one of:

- `input`, which the Host turns into a correlated `app.input.requested` event
  with optional catch-up; or
- `event`, for a fact published by the Host scheduler.

An observer receives only `ObserverContext` and returns facts for the host to
publish after a successful run. An action validates parameters and translates
them to App input.

## Workflow contract

App-owned workflows receive one typed input and scoped capabilities:

```ts
type WorkflowContext<TInput> = {
  input: TInput;
  reconciliation?: TaskReconciliationContext<TInput>;
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

When a task owns the attempt, `reconciliation` supplies bounded current facts:
App/task identity, generation, owner, mode, outcome, acceptance, typed input,
live/completed child views, a bounded snapshot of other live App tasks for
frontier-health review, and the exact triggering event. Snapshot entries carry
typed status, category, readiness, Conditions, and bounded attempt evidence;
the current task is omitted, the list is capped at 64, and `truncated` makes an
incomplete view explicit. This is not a listing API and does not expose the
task tree, mutation handles, queue, or task files.

`read` contains exact bounded lookups only:

```ts
type AppRead = {
  appResult(itemId: string): Promise<AppResult | null>;
  task(taskId: string): Promise<TaskView | null>;
  execution(executionId: string): Promise<ExecutionView | null>;
  metric(metricId: string): Promise<MetricView | null>;
};
```

There is no unrestricted list/query surface and no database escape hatch.
Genuine new read requirements become narrow typed projections with explicit
scope and tests.

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

`done` and `blocked` end the current bounded workflow run. They do not complete
an App request or task by themselves. The calling App/task boundary validates
and admits the result.

A durable wait is represented by an App dependency or task Condition, not by
holding a workflow open or resuming it as a hidden controller.

## Task contracts

`TaskIntent` declares desired work:

```ts
type TaskIntent = {
  id: string;
  parentId: string;
  outcome: string;
  acceptance: string[];
  mode: "achieve" | "maintain";
  owner?: string;
  workflow?: string;
  input?: Record<string, unknown>;
  outputs?: string[];
  dependsOn?: string[];
  priority?: "P0" | "P1" | "P2" | "P3";
  category?: string;
};
```

One fenced reconciliation attempt returns a typed state, summary, evidence,
optional desired task actions, and Conditions. Runtime admission validates
generation, action scope, Conditions, and verification evidence before any
mutation becomes authoritative.

Apps may supply pure action validation and bounded verification policy. They do
not save task state, acquire locks, edit projections, or manufacture attempts.

## Facts and metrics

`ctx.events.emit` publishes facts only. It cannot address an App request,
attach a task, or directly schedule another workflow. If a published fact is
actionable, the destination App must declare a subscription, task subscription,
or exact target.

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
| Record a domain sample                         | metric tool where authorized | `ctx.metrics.record`       |
| Finish this bounded execution                  | finish/result                | `ctx.done` / `ctx.blocked` |

Background forks, session steering, cancellation, process control, and human
delivery are host/agent-tool capabilities only when explicitly granted. They
are not generic workflow SDK methods.

## Extension rule

Extend the SDK only when an App responsibility cannot be expressed through the
existing semantic contracts:

1. identify the exact App-owned question;
2. add the narrowest typed capability or projection answering it;
3. keep persistence, retry, delivery, and recovery mechanics host-private;
4. prove scope, restart behavior, and idempotency; and
5. avoid generic list, query, command, path, or database escape hatches.

App growth should normally add schemas, pure policy, observers, workflows, or
domain projections—not runtime APIs.

The SDK does not expose `defineService`, a service locator, or generic
`provides`/`inject` composition. App-local pure code is an ordinary module
import. Cross-App work uses typed delegation, and cross-App facts use declared
subscriptions. Runtime subsystem composition remains host-private.

## Integrity checklist

- The root package is the only authoring entry point.
- App definitions are pure to import and validate.
- Workflow input is typed and never reconstructed from prompt text.
- Every capability is bounded to one semantic responsibility.
- Reads are exact typed projections; writes are expressed as typed results or
  facts.
- Execution results are bounded claims admitted by the owning App/task.
- No App/workflow receives raw SQL, global paths, task storage, scheduler,
  queue, lease, delivery, or recovery access.
- Host-private maintenance handlers remain outside the public SDK and cannot
  provide a parallel App work lifecycle.
- No application or runtime package exposes or imports a legacy SDK entry point.
