# System Model

**Design status:** Accepted.
**Implementation status:** Implemented.

May-agent has two primary concepts:

```text
Host = persist, schedule, run, recover, deliver
App  = define meaning, policy, desired outcomes, acceptance
```

Everything else is either data owned by one side or code used to do one of
those jobs. “Runtime” means the Host implementation. “SDK” means the typed
boundary between an App and the Host. Neither is a third owner.

## Words to remember

Only **Host** and **App** are architectural concepts. Five ordinary record
names are useful when reading code:

- an **event** is input or change that durably entered the Host;
- a **request** is an input that still needs a result;
- a **task** is an outcome that may take several tries;
- a **fact** is something that happened; and
- an **attempt** is one agent or workflow run.

These are stored records, not services or layers. Inbox, queue, lease,
controller, reconciler, session, trace, and projection are implementation
details. A design explanation should not require those words to explain who
owns the work.

## The whole flow

```text
event
  -> Host stores it
  -> event type selects an explicit route
  -> Host stores any resulting request, task, or control operation
  -> App says what domain work means
  -> Host runs one bounded attempt
  -> App accepts, waits, delegates, or asks for another attempt
  -> Host recovers unfinished work and delivers the result
```

The Host never invents domain work. An App never implements persistence,
queues, retries, leases, recovery, or delivery.

## Host

The Host owns mechanics:

- load and validate App definitions;
- validate and persist events before routing them;
- store App requests, tasks, attempts, results, and delivery evidence;
- schedule declared inputs, facts, and observations;
- limit concurrent work across the process and within each App;
- run agents and workflows as bounded attempts;
- restart unfinished work from durable state;
- deliver results to callers and human channels; and
- expose read-only views and operational metrics.

The Host may have scheduled maintenance for its own storage and sessions. Such
code may inspect or repair Host state and publish facts. It may not decide
domain policy or start App-owned model work directly.

## App

An App owns meaning:

- the address and input schema for its requests;
- which facts matter and how they become typed inputs or task intent;
- which simple requests can complete without model judgment;
- which owner, agent, or workflow performs a bounded attempt;
- the desired outcome and acceptance criteria for durable tasks;
- what evidence is enough to finish, wait, delegate, or continue; and
- domain-specific reads, actions, and observations.

An App is ordinary source code plus its domain files. It does not own a daemon,
database, event loop, scheduler, or recovery worker.

## One try or several tries

A simple request should finish directly:

```text
request -> pure App decision or one owner attempt -> result
```

Use a task only when the desired outcome must survive more than one try:

```text
desired outcome
  -> observe current state
  -> run one bounded attempt
  -> accept as converged, wait for a named fact, or try again later
```

The task is durable; the agent session and workflow run are not. A restart may
create a new attempt, but it must keep the same request or task identity.

## Stored records

| Record | Meaning | Owner |
| --- | --- | --- |
| Event | Input or change that crossed the Host boundary | Host |
| App request | One addressed input still owed a correlated result | Host storage, App policy |
| Task | One desired outcome that may need repeated attempts | Host storage, App policy |
| Fact | Something observed that may wake declared work | Host storage |
| Attempt | One bounded agent or workflow execution | Host |
| Result | The App's accepted outcome and evidence | App |
| Delivery | Proof that a result was sent or observed | Host |

Queues, leases, traces, metrics, sessions, and projections support these
records. They never become alternate work owners.

`Conversation may:primary` is one such projection. It reconstructs shared human
context and work views from messages, May App requests, dependencies, and
accepted results; it is not another database or owner. Adapters observe its
updates and render independently, so their delivery state never gates a human
request's semantic completion.

## Events and time

- Every state-changing input first becomes one event.
- A human `conversation.message.created` event adds shared May Conversation
  context and creates one fenced May App request.
- An addressed `app.input.requested` event creates one durable App request.
- A declared subscription translates a fact into an App request or task intent.
- An exact task target wakes only that task.
- A schedule creates an input or publishes a fact.
- An observer reads external state and returns facts.
- A metric describes what happened; it does not create work by itself.

Record-only facts remain valid with no consumer. Required event types must have
one semantic route that durably accepts responsibility. The Host never guesses
an owner or starts an agent because an event was not handled.

## Waiting and delegation

An App request may depend on one child App request, task, or session.
The Host stores that link before starting the child and wakes the parent when
the exact dependency finishes.

A task waits on named conditions derived from facts. Workflows do not sleep in
the background or keep durable business state in local variables.

## Pause and restart

Pausing task reconciliation stops new task attempts, not App admission. New
inputs and task intent remain durable. Resuming queues the retained work.

On restart, the Host reads durable requests and tasks, repairs stale attempts,
and continues only work that still has an owner and acceptance contract. It
does not reconstruct desired work from logs or invent a replacement task.

## Code shape

```text
Host
  src/app/app-runtime.ts          composition and lifecycle
  src/app/app-inbox-*.ts          requests and delivery
  src/app/app-task-*.ts           durable tasks
  src/app/event-interface.ts      publish, get, subscribe boundary
  src/app/event-bus.ts            persistence-first internal delivery
  src/lib/agent-execution.ts      bounded execution

App
  projects/<id>.app/app.ts        meaning and policy
  projects/<id>.app/agents/       agents and workflows
  projects/<id>.app/tasks/        optional seed intent
  projects/<id>.app/.state/       Host-managed state

Boundary
  packages/sdk/src/app.ts
  packages/sdk/src/task.ts
```

## Rules

1. Every addressed result belongs to one App request.
2. Every durable desired outcome belongs to one task.
3. The Host stores and runs work; the App defines why it exists and when it is done.
4. Admission is durable before execution starts.
5. Attempts are bounded and share one Host concurrency limit.
6. Facts wake only explicitly declared routes.
7. Pause retains work; restart preserves identity.
8. Host maintenance cannot start App-owned model work.
9. The public SDK exposes meaning and bounded capabilities, not Host internals.
10. New code uses `defineApp`; retired ProjectApp and handler-owned work paths do not return.
11. Public writes use `publish(event)`; linked records, not events, retain mutable work state.
