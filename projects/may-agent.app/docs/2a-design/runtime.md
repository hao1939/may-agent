# Host Runtime

**Status:** Accepted implementation reference.

The runtime is the Host code. It is not a third layer between Host and App.

```text
Host = persist, schedule, run, recover, deliver
App  = define meaning, policy, desired outcomes, acceptance
```

The code contains workers, queues, claims, leases, controllers, and adapters.
Those are private ways the Host does its five jobs. They are not concepts an
App author must compose or understand.

## Process modes

Only the long-running daemon hosts Apps. Other modes reuse bounded execution or
read state without attaching request workers, schedules, task workers, or
recovery.

| Mode | Hosts Apps | Runs bounded agents/workflows |
| --- | --- | --- |
| Daemon with scheduling enabled | Yes | Yes |
| Direct agent/workflow | No | Yes |
| Gym | No | Yes |
| Web/read-only process | No | Only through explicit control calls |
| Status CLI | No | No |

## Startup

```text
open stores
  -> load agents and Apps
  -> validate one complete App generation
  -> attach event routes, schedules, observers, and task workers
  -> recover unfinished work
  -> attach external ingress and delivery
```

Reload prepares a full replacement before publication. Generation-owned timers,
subscriptions, and workers are closed when replaced.

## Store first, then run

The Host stores identity and intent before it queues work. The code calls this
"admission":

- an input event is persisted before its App request or control operation;
- a subscribed fact becomes an App request or TaskIntent;
- a task trigger is recorded before a worker is woken; and
- a child dependency is stored before the child starts.

This is why restart recovery does not depend on an in-memory queue.

## Capacity

The Host constructs one `HostCapacity` limit. Both App request owner runs and
task attempts consume it. Per-App request and task limits apply in addition.

Capacity is backpressure, not policy. It decides when work may start, never
which work matters or whether the result is acceptable.

## Pausing

Pause has one meaning:

- admission and persistence continue;
- new task attempts do not start; and
- resume queues retained work from durable state.

The Host does not reject task intent merely because the App is paused.

## Bounded execution

All agent calls use the same execution path:

```text
agent definition + typed input + allowed tools
  -> model/tool loop
  -> ExecutionResult
```

The execution path owns prompt preparation, tool policy, cancellation,
transcript evidence, and provider interaction. It does not own an App request
or task outcome.

Sessions are attempt records. A session may resume when the same bounded
attempt can safely continue. Otherwise the owning App request or task starts a
new attempt from durable state.

## Workflows

A workflow is one bounded App-owned procedure. It receives typed input,
optional task reconciliation context, scoped reads, agent calls, fact/metric
ports, and an allocated workspace.

It does not receive the Host database, event bus, queues, scheduler, manager,
or recovery state. A workflow finishes, blocks, or returns a task result; it
does not remain alive as a background controller.

## Events, schedules, and observers

The Host exposes one small event boundary over the existing persistence-first
bus:

```text
publish(event) -> EventReceipt
get(eventId)   -> EventView
subscribe(filter)
```

An explicit table marks the small set of `required` types. Everything else is
record-only for trusted internal producers. The boundary validates and derives
the envelope, then delegates to existing App inbox, task, session, and lifecycle
routes. It is not another broker, queue, service, or handler framework.

An App schedule has exactly one event destination: an App input request or a
fact. An observer has one job: read external state and return facts. Both are
replaced atomically with their App generation.

## Host maintenance

Some scheduled code must inspect Host-owned storage, such as session cleanup or
metric collection. File handlers receive only Host maintenance capabilities:
queries, metrics, fact publication, logging, delivery, and explicit paths.

They cannot start an App agent/workflow or create App task state. When repair
needs App judgment, the handler publishes a typed fact and the App owns the
request or task. Session recovery follows this path:

```text
Host detects failed session
  -> Host publishes session.recovery.requested
  -> May-agent App creates a task
  -> App workflow attempts recovery or requests owner judgment
```

## Recovery

At startup the Host:

- releases or repairs stale claims and leases;
- requeues durable App requests and runnable tasks;
- preserves completed results and delivery evidence;
- resumes only compatible bounded sessions; and
- leaves paused task work retained but unqueued.

Recovery preserves request and task identities. Logs and traces are evidence,
not reconstruction authority.

## Interfaces

Control socket, HTTP, console, Telegram, and Web UI receive only a bounded
interface context:

```text
publish(event)
get(eventId)
subscribe(filter)
bounded read models
```

Event definitions retain the four semantic families—App input, fact, exact
control, and Host lifecycle control—without exposing four transport APIs.
Compatibility commands are thin event constructors. Interfaces do not receive
the EventBus, manager, database, task store, App owner, or model runner.

## Shutdown

Shutdown closes ingress, timers, observers, workers, and adapters; drains or
interrupts bounded attempts under policy; persists terminal evidence; and
leaves unfinished App requests and tasks recoverable. It never marks unfinished
work complete.
