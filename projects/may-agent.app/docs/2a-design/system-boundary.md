# Host And App Boundary

**Design status:** Accepted.
**Implementation status:** Implemented.

There is one architectural split:

```text
Host = persist, schedule, run, recover, deliver
App  = define meaning, policy, desired outcomes, acceptance
```

Infrastructure and runtime are both part of the Host. Infrastructure is what
the Host uses—storage, timers, model providers, processes, and transports.
Runtime is the code that connects and operates those things. Neither is a
third owner or something an App composes.

## The boundary in one flow

```text
event
  -> Host validates and stores it
  -> explicit event route creates any linked responsibility
  -> App decides what domain work means
  -> Host runs bounded work when the App asks
  -> App decides whether the result is enough
  -> Host stores, recovers, and delivers the result
```

The Host does not invent domain work. The App does not implement storage,
queues, retries, recovery, or delivery.

## Plain names

Only Host and App are architectural concepts. These record names are useful:

- **request** — an input that still needs one result;
- **task** — an outcome that may need several tries;
- **fact** — something observed or reported; and
- **attempt** — one bounded agent or workflow run.

Inbox item, event, session, workflow run, queue entry, claim, lease, condition,
trace, and projection are code or storage details. They do not own work.

## Host

The Host has five jobs:

| Job | What it does |
| --- | --- |
| Persist | Store requests, tasks, facts, attempts, results, and delivery proof |
| Schedule | Wake declared work at the right time and limit concurrency |
| Run | Execute one bounded agent or workflow attempt |
| Recover | Continue the same unfinished request or task after failure or restart |
| Deliver | Return the accepted result to its caller or channel |

The Host also validates and loads complete App definitions. Reload either
publishes a complete replacement or keeps the previous definition active.

Host maintenance may inspect and repair Host-owned state. If it discovers a
domain decision, it publishes a fact to an App. A maintenance file cannot
launch an App agent, workflow, task, or escalation directly.

## App

An App defines:

- its address and input schema;
- how inputs and facts become requests or tasks;
- which simple requests can finish immediately;
- which owner or workflow handles bounded work;
- the desired outcome and acceptance evidence for a task; and
- domain reads, actions, observations, and metrics.

An App is source code and domain files. It has no daemon, database, event loop,
scheduler, queue, retry worker, or recovery worker of its own.

## Request or task

Use a request when one input needs one answer:

```text
request -> pure App decision or one owner run -> accepted result
```

Use a task only when an outcome must survive several tries:

```text
task -> check current state -> run one bounded attempt
     -> done, wait for an exact fact, ask the owner, or try again
```

The request or task remains the durable identity. Sessions and workflow runs
are attempt evidence and may be replaced after a restart.

## Facts and time

A fact never starts model work by itself. An App must declare how that fact is
used:

```text
fact -> request
fact -> task or exact task wake
fact -> observation only
```

If no route matches, the fact remains a fact. The Host does not guess an owner.

A schedule has one destination: create an App input or publish a fact. An
observer reads external state and returns facts. A metric records what
happened; it does not become work state.

## Execution

The Host has one bounded execution implementation for direct, Gym, App-owner,
and workflow runs. It owns provider calls, tool permissions, timeouts,
cancellation, transcripts, and the common execution result.

A workflow receives typed App input and narrow capabilities. It does not
receive the database, event bus, scheduler, queues, manager, global paths, or
recovery state. A workflow finishes its attempt; it does not stay alive as a
background controller.

## Recovery

Recovery repeats mechanics, not meaning:

```text
unfinished stored request or task
  -> fence stale attempt
  -> repair known Host state
  -> run the same obligation again when allowed
```

Recovery cannot invent a new task, owner, strategy, or completion claim.
Paused Apps continue to store new work but do not start task attempts.

## Public boundary

Apps use `@may-agent/sdk` to describe input, policy, desired work, facts, and
bounded workflows. The SDK does not expose SQL, files and locks, queues,
leases, scheduler handles, event-bus handles, process recovery, delivery
internals, or global paths.

External interfaces have one state-changing operation:

```text
publish(event)
```

The event type selects one of four existing Host meanings: App input, reported
fact, exact task/session control, or Host lifecycle control. `get(eventId)`
reads delivery and linked outcomes; `subscribe(filter)` observes events.
Adapters do not call App owners or the model runner directly, and Apps do not
receive this Host interface.

## Extension rule

When adding a feature, ask two questions:

1. Is this stable mechanics? Put it in the Host.
2. Is this meaning, policy, desired outcome, or acceptance? Put it in the App.

Add an SDK capability only when an App responsibility cannot be expressed with
the current typed boundary. Add the narrowest operation needed; do not expose a
generic query, command, service locator, database, path bag, or runtime context.

## Review checklist

- Can the design be explained using Host and App without a third owner?
- Is work stored before it runs?
- Does every result belong to one request and every durable outcome to one task?
- Does the App decide meaning and completion?
- Does the Host own execution, concurrency, restart, and delivery?
- Can a fact start work only through an explicit App route?
- Are sessions and workflows bounded attempts rather than hidden controllers?
- Is any new public capability smaller than exposing Host internals?
