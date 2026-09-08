# Host And App Boundary

**Design status:** Accepted.
**Implementation status:** The Host/App boundary is implemented for current
Apps. Task runtimes and test fixtures use resource authority; the legacy JSON
store and completed offline cutover path have been removed. The retired inbox
delivery table is retained only as historical schema evidence. Incident-shaped public
inputs remain a convergence gap rather than an alternate accepted boundary.

There is one architectural split:

```text
Host = persist, schedule, run, recover, expose results
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
  -> Host stores, recovers, and exposes the result
```

The Host does not invent domain work. The App does not implement storage,
queues, retries, recovery, or presentation transport.

## Plain names

Only Host and App are architectural concepts. These record names are useful:

- **request** — caller correlation for one promised result;
- **task** — the App-owned outcome, whether it needs one attempt or several;
- **fact** — something observed or reported; and
- **attempt** — one bounded agent or workflow run.

Inbox item, event, session, workflow run, queue entry, claim, lease, condition,
trace, and projection are code or storage details. They do not own work.

## Host

The Host has five jobs:

| Job      | What it does                                                          |
| -------- | --------------------------------------------------------------------- |
| Persist  | Store requests, Tasks, facts, attempts, results, and adapter evidence |
| Schedule | Wake declared work at the right time and limit concurrency            |
| Run      | Execute one bounded agent or workflow attempt                         |
| Recover  | Continue the same unfinished request or task after failure or restart |
| Expose   | Return the accepted result to its caller and shared resource views    |

The Host also validates and loads complete App definitions. Reload either
publishes a complete replacement or keeps the previous definition active.
Replacing Host code is different: deployment is owned by the **Host Operations
App** (stable `appId: may-agent`), requires a Task whose canonical identity has
that App ID, and accepts only a candidate containing current canonical May
source. The May App may understand and route the human request, but its own
`appId: may` Task cannot authorize a Host deployment. A domain App may request
the change but cannot deploy the Host from its own Task.

Host maintenance may inspect and repair Host-owned state. If it discovers a
domain decision, it publishes a fact to an App. A maintenance file cannot
launch an App agent, workflow, task, or escalation directly.

## App

An App defines:

- its address and input schema;
- how actionable inputs and facts resolve to tasks;
- which bounded executor handles work;
- the desired outcome and acceptance evidence for a task; and
- domain reads, actions, observations, and metrics.

An App is source code and domain files. It has no daemon, database, event loop,
scheduler, queue, retry worker, or recovery worker of its own.

## Request and task

When a caller asks an App for durable work, the Host records a request and
links it to the Task that owns the outcome:

```text
request -> Task owned by the App -> accepted result
```

A conversational frontend request may instead answer, investigate, edit, and
verify directly within its authorized scope. It uses the shared bounded
executor; tool use alone does not create a Task. Conversation preserves the
discussion and exact references, not a second work state. When work needs
background continuation, later steering, or restart-safe coordination, May
publishes typed durable intent or feedback. May can own the ordinary Task;
another App is selected for existing ownership, required authority, or useful
expertise, not merely a matching name. Runtime binds durable intent to the actual
Task
owned by the responsible App and records that exact Task on the Topic. May then
reconciles one normal maintain Task on meaningful events from Topic-linked
Tasks and may steer the same Task or update the Conversation. This supervision
Task owns follow-through but never parents, waits on, or copies the responsible
Tasks.

A simple task may converge on its first bounded attempt. Harder work keeps the
same task identity across exact waits and later attempts:

```text
Task -> check current state -> run one bounded attempt
     -> done, wait for an exact fact, require attention, or try again
```

The request remains the caller identity and the task remains the App work
identity. Sessions and workflow runs are attempt evidence and may be replaced
after a restart.

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

The Host has one bounded execution implementation for direct, Gym, App-agent,
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
Apps with paused task reconciliation continue to store new work but do not
start task attempts.

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
reads admission and linked outcomes; `subscribe(filter)` observes Events.
Adapters do not call App agents or the model runner directly, and Apps do not
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
- Does every caller result correlate to one request and every durable outcome
  belong to one Task?
- Does the App decide meaning and completion?
- Does the Host own execution, concurrency, restart, and result exposure?
- Can a fact start work only through an explicit App route?
- Are sessions and workflows bounded attempts rather than hidden controllers?
- Is any new public capability smaller than exposing Host internals?
