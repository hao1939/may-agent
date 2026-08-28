# Architecture

**Design status:** Accepted.
**Implementation status:** The canonical path is active for every installed
App. Request storage correlates Task results; it does not execute App policy.
Installed descriptors require resource authority and normal routing, recovery,
and reads have no JSON fallback. Generic store/reconciler code still retains
JSON compatibility for the guarded offline importer and focused fixtures.

Read [system-model.md](system-model.md) first. The architecture follows one
split:

```text
Infra   = ingress, persistence, scheduling, capacity, and delivery
Runtime = task lifecycle, execution, scoped capabilities, and recovery
App     = resolve inputs to tasks and reconcile those tasks
```

## Composition

`app-runtime.ts` is the composition root. It constructs one Host, loads one
generation of Apps, and wires the Host parts directly.

```text
app-runtime.ts
  -> App registry
  -> request correlation and delivery store
  -> fact store and declared routes
  -> scheduler and observers
  -> task controller
  -> bounded agent/workflow execution
  -> delivery adapters
```

These are modules inside one Host, not independently discovered services. They
do not have separate lifecycles or exchange live objects through a service
locator.

The module names describe code organization only. `runtime`, `inbox`,
`controller`, and `reconciler` are not extra architectural layers. The useful
question is always simpler: is this mechanical Host code, or meaning owned by
an App?

The same rule governs decisions: code collects bounded trustworthy context and
executes a schema-validated decision; the LLM decides meaning. Code may handle
an explicit deterministic case, but it must not become a second intent
classifier, keyword router, or conversation state machine.

## App shape

```text
projects/<id>.app/
  app.ts
  project.json                 optional durable goal and posture
  tasks/seed.json              optional initial desired state
  agents/<agent>/
    agent.json
    AGENTS.md
    workflows/<name>.ts
  .state/                      managed by the Host
```

`app.ts` is the only App manifest. There is no parallel inbox manifest,
ProjectApp manifest, App-specific daemon, or App-specific scheduler.

## One App work path

```text
input
  -> Host validates ingress and stores caller correlation when needed
  -> Runtime resolves, creates, revises, or wakes one task
  -> App reconciles that task in one bounded attempt
  -> Runtime validates and persists task state
  -> Host schedules another wake or delivers the accepted result
```

The request remains the caller's correlation and result identity. The Task
is the App's work identity. A session or trace can explain an attempt but
cannot replace either record.

## Task path

```text
desired task (`TaskIntent` in code)
  -> Host stores desired state and trigger
  -> Host queues one attempt within App and Host limits
  -> an isolated worker claims current state and runs the selected handler
  -> App says done, waiting, needs-agent, or requests a typed change
  -> Host validates, stores, and applies the result
```

Attempt-handler selection is direct:

```text
agent = task agent, else nearest parent agent, else App default agent
workflow present = run that agent's named workflow
executor present = run that named Host adapter
neither present = run that agent once
```

The public SDK calls this field `agent`. Retained Task rows and private Host
state still call it `owner`; that is migration vocabulary for execution
selection, not durable ownership. The App always owns the Task.

Missing workflows or unavailable executors become visible attention. The Host
does not silently choose another executor or agent. Codex and Claude are the
built-in native CLI adapters; a Host extension registers another name against
the same `TaskExecutor` function contract.

## Events and schedules

Fact Events are stored observations. They become work only through an App's
declared input translator, exact task target, or matching Task Condition.

Schedules either admit an App input or publish a fact. Observers read external
state and publish facts. Neither starts an agent directly.

Host maintenance may inspect and repair Host state. If it discovers domain
work, it publishes a fact addressed to an App. It cannot launch an App workflow
or mutate App task state.

## Execution

All Task executors enter and leave through one bounded Task-attempt contract.
Managed agents and workflows use the agent runtime; Codex, Claude, and any
registered replacement use thin adapters. No path creates another Task
lifecycle.

Each expensive Task attempt runs in an isolated worker process. The parent
controller schedules only the exact persisted Task identity; the worker claims
that Task, builds context, executes, and persists its fenced result. Events
produced by the attempt are appended once by the worker and relayed to the
parent for local listeners and routes without a second append. A worker exit
therefore loses neither the Task nor its durable Events, and CPU-heavy work
cannot block interface commands or message admission.

One `HostCapacity` object limits task attempts. Each App may declare a smaller
local limit. Request correlation and delivery do not run a second App worker.

Capacity applies after durable admission. A Task attempt or May decision may
wait for execution capacity, but event publication, resource reads, and
interface commands do not acquire that capacity. Conversation ordering is a
message-handler concern; Task ordering is a Task-handler concern. Neither is an
EventHub queue.

## Startup and reload

```text
open storage
  -> load and validate Apps
  -> prepare all routes
  -> publish one complete generation
  -> recover retained request correlations and tasks
  -> open external ingress
```

A failed reload leaves the previous generation active. Shutdown stops new
dispatch and preserves unfinished work.

Deployment readiness includes a bounded control-socket read, not only process
and HTTP liveness, so an event-loop-starved Host is unhealthy and rolls back.

App source changes are activated deliberately: `/reload` validates and
publishes one new generation atomically, while a deployment restart performs
the same startup publication. The Host does not poll and hash every App,
watcher, agent configuration, or workflow. This keeps idle hosting cheap and
makes the active generation explicit. Workflow source is loaded when that
workflow is invoked.

## Code map

| Responsibility                   | Code                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| Host composition                 | `src/app/app-runtime.ts`, `daemon*.ts`                                       |
| App contract                     | `packages/sdk/src/app.ts`, `task.ts`                                         |
| App loading                      | `src/app/app-registry.ts`, `src/app/loader/`                                 |
| Request correlation and delivery | `src/app/app-inbox-host.ts`, `app-inbox-runtime.ts`                          |
| Tasks                            | `src/app/app-task-runtime.ts`, `app-task-controller.ts`, `app-task-store.ts` |
| Events                           | `src/app/event-bus.ts`                                                       |
| Execution                        | `src/app/task-attempt-process.ts`, `src/lib/agent-execution.ts`, `manager.ts`, workflow runner files |
| Delivery and interfaces          | `src/app/transport/`, `src/app/http/`, `packages/webui/`                     |

## Dependency rule

Host modules may depend on smaller Host utilities. Apps depend only on the
public SDK. The SDK does not expose the event bus, database, manager, queues,
leases, scheduler, recovery APIs, or global paths.
