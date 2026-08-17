# Architecture

**Design status:** Accepted.
**Implementation status:** Implemented.

Read [system-model.md](system-model.md) first. The architecture follows one
split:

```text
Host = persist, schedule, run, recover, deliver
App  = define meaning, policy, desired outcomes, acceptance
```

## Composition

`app-runtime.ts` is the composition root. It constructs one Host, loads one
generation of Apps, and wires the Host parts directly.

```text
app-runtime.ts
  -> App registry
  -> request store and workers
  -> fact store and declared routes
  -> scheduler and observers
  -> optional task workers
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

## Request path

```text
input
  -> Host validates and stores an App request
  -> App route completes, delegates, or attaches a task
  -> Host runs bounded work when needed
  -> App accepts the result
  -> Host stores and delivers it
```

The request remains the identity of the obligation. A session or trace can
explain an attempt but cannot replace the request.

## Task path

```text
desired task (`TaskIntent` in code)
  -> Host stores desired state and trigger
  -> Host queues one attempt within App and Host limits
  -> App workflow or owner checks current state
  -> App says done, waiting, needs-owner, or requests a typed change
  -> Host validates, stores, and applies the result
```

Task handler selection is direct:

```text
owner = task owner, else nearest parent owner, else App owner
workflow present = run that owner's named workflow
workflow absent  = run that owner once
```

Missing workflows become visible attention. The Host does not silently choose
another owner.

## Facts and schedules

Facts are stored observations. They become work only through an App's declared
subscription or exact task target.

Schedules either admit an App input or publish a fact. Observers read external
state and publish facts. Neither starts an agent directly.

Host maintenance may inspect and repair Host state. If it discovers domain
work, it publishes a fact addressed to an App. It cannot launch an App workflow
or mutate App task state.

## Execution

All agent and workflow calls use one bounded execution implementation. Direct
CLI and Gym calls reuse it without starting App hosting.

One `HostCapacity` object limits App request owner runs and task attempts.
Request and task workers use it directly; each App may declare a smaller local
limit.

## Startup and reload

```text
open storage
  -> load and validate Apps
  -> prepare all routes
  -> publish one complete generation
  -> recover retained requests and tasks
  -> open external ingress
```

A failed reload leaves the previous generation active. Shutdown stops new
dispatch and preserves unfinished work.

## Code map

| Responsibility | Code |
| --- | --- |
| Host composition | `src/app/app-runtime.ts`, `daemon*.ts` |
| App contract | `packages/sdk/src/app.ts`, `task.ts` |
| App loading | `src/app/app-registry.ts`, `src/app/loader/` |
| Requests | `src/app/app-inbox-host.ts`, `app-inbox-runtime.ts` |
| Tasks | `src/app/app-task-runtime.ts`, `app-task-controller.ts`, `app-task-store.ts` |
| Facts | `src/app/event-bus.ts` |
| Execution | `src/lib/agent-execution.ts`, `manager.ts`, workflow runner files |
| Delivery and interfaces | `src/app/transport/`, `src/app/http/`, `packages/webui/` |

## Dependency rule

Host modules may depend on smaller Host utilities. Apps depend only on the
public SDK. The SDK does not expose the event bus, database, manager, queues,
leases, scheduler, recovery APIs, or global paths.
