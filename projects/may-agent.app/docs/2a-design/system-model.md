# System Model

**Design status:** Accepted.
**Implementation status:** The single App work path is implemented: every
installed App resolves admitted input to a Task, and only Task reconciliation
executes App policy. Scoped Task list/get reads are implemented in the SDK,
agent tool, control socket, and HTTP adapter.

The May system has one App work object, one durable source of change, and three
responsibility areas:

```text
Task    = the durable desired and observed App work
Event   = durable new information that may create or wake that work
Infra   = ingress, persistence, scheduling, capacity, and delivery
Runtime = task lifecycle, execution, scoped capabilities, and recovery
App     = resolve inputs to tasks and reconcile those tasks
```

Infra and Runtime are responsibility boundaries inside the Host, not separately
discovered services or additional domain owners. The SDK is the typed boundary
through which a task attempt receives Runtime capabilities.

The practical test is deliberately plain:

| Part    | One question it answers                                                       |
| ------- | ----------------------------------------------------------------------------- |
| Event   | What meaningful new information arrived?                                      |
| Infra   | How does input, state, time, capacity, and output move?                       |
| Runtime | Which tasks does the event wake, which attempt runs, and what did it observe? |
| App     | Given this task and its unobserved events, what should happen next?           |

The App/Runtime boundary is one conceptual function:

```text
reconcile(task context + bounded capabilities) -> task result
```

Everything before that call is admission or preparation. Everything after it
is validation, persistence, wake scheduling, recovery, or delivery.

## Public mental model

The ordinary interaction model has four nouns:

- an **App** owns a responsibility;
- an **event** is durable new information that can create or wake work;
- a **request** is the Host's record that a caller still needs a result;
- a **task** is the work an App reconciles toward an accepted outcome.

```text
human or caller
  -> Host event and request
  -> App task
  -> event-driven bounded reconciliation attempts
  -> accepted result
  -> Host projection to the caller
```

The request remains the caller-facing identity. The task is the App-facing work
identity. Simple work converges in one attempt; hard or recurring work uses the
same loop for as many bounded attempts as needed. A request may attach to an
existing stable task, and a task may outlive any one caller request.

Two common words are deliberately not resources:

- an **action** is a named, schema-validated request entrypoint; invoking it
  creates an App request and the action has no status or lifecycle of its own;
- a **task tree** is a read-only presentation of tasks using their parent and
  dependency relationships; it does not own, schedule, or mutate work.

Humans normally talk to May or invoke a named App command and then track the
request. They inspect a related task only when they need progress or diagnostic
detail.

### May-specific names

The user-facing model has only May, Apps, and the Host:

| Name | Meaning |
| ---- | ------- |
| **May / May App** (`appId: may`) | One concept at two levels: May is the name people talk to; May App is the code that owns those Conversation requests, understands intent, answers, or routes typed work. |
| **Host** | Persists, schedules, runs, recovers, and delivers work for every App. |
| **Host Operations App** (`appId: may-agent`) | An ordinary App whose domain is changing or operating the Host itself. |

There is no architectural component called **May agent**. An agent run named
`may` is only one bounded executor used by an App. It is not a durable owner.
The technical identifier `may-agent` remains on the Host repository, binary,
container, and Host Operations App for compatibility; context identifies which
artifact it names. New explanatory prose should say May, May App, Host, Host
Operations App, or agent run instead.

The repository `projects/may-agent` contains the Host implementation. The App
at `projects/may-agent.app` owns desired operational outcomes for that Host.

May coordinates a cross-App request, but the responsible App owns the resulting
Task. For example, May may understand and route a deployment request, while the
Host Operations App owns and reconciles the deployment Task.

## Implementation words

Infra, Runtime, and App explain responsibility. Four ordinary record names are
useful when reading code:

- an **event** is input or change that durably entered the Host;
- a **request** correlates a caller that still needs a result;
- a **task** is all App work, whether it takes one attempt or several;
- an **attempt** is one agent or workflow run.

“Request” and “fact” can also describe what an Event means. They are not two
more transport types: a request Event asks for responsibility; a fact Event
reports something that happened. Only a caller request becomes a separate
mutable correlation record because the Host must later attach its result.

These are stored records, not services or layers. Inbox, queue, lease,
controller, reconciler, session, trace, and projection are implementation
details. A design explanation should not require those words to explain who
owns the work.

## The whole flow

```text
event
  -> Host stores it before routing
  -> event type selects an explicit route
  -> Host stores any caller request or control operation
  -> App input resolves one task, or the event wakes an exact existing task
  -> Runtime durably links the event to that task
  -> Host runs one bounded reconciliation attempt with the task's unobserved events
  -> App converges, waits, decomposes, or asks for another attempt
  -> Runtime atomically accepts the result and advances the event checkpoint
  -> Host recovers unfinished work and delivers the result
```

The Host never invents domain work. An App never implements persistence,
queues, retries, leases, recovery, request tracking, or delivery.

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
- which facts matter and how they become typed inputs or exact wakes;
- how an admitted input identifies desired task state;
- which owner, agent, or workflow performs a bounded attempt;
- the desired outcome and acceptance criteria for tasks;
- what evidence is enough to converge, wait, decompose, or continue; and
- domain-specific reads, actions, and observations.

An App is ordinary source code plus its domain files. It does not own a daemon,
database, event loop, scheduler, or recovery worker.

An App becomes more capable by learning better task policy, workflows,
acceptance checks, and bounded capability calls. A new capability lets one task
attempt do something new; it does not give the App a new lifecycle, worker,
store, retry loop, scheduler, or delivery path. This keeps capability growth
independent from architectural complexity.

## One task loop

Every App uses the same loop:

```text
desired outcome
  -> observe current state
  -> run one bounded attempt
  -> accept as converged, wait for a named fact, or try again later
```

For simple work, the first observation and attempt converge immediately. The
task is still the same resource and leaves a compact receipt. The agent session
and workflow run are bounded attempts, not alternate work. A restart may create
a new attempt, but it keeps the same request and task identities.

## Stored records

| Record      | Meaning                                              | Owner                    |
| ----------- | ---------------------------------------------------- | ------------------------ |
| Event       | Durable new information that may create or wake work | Host                     |
| App request | One caller still owed a correlated result            | Host                     |
| Task        | One desired outcome reconciled by an App             | Host storage, App policy |
| Attempt     | One bounded agent or workflow execution              | Host                     |
| Result      | Accepted status, caller response, and evidence       | App                      |
| Delivery    | Optional transport evidence for an external send     | Host                     |

Queues, leases, traces, metrics, sessions, and projections support these
records. They never become alternate work owners.

The App inbox is the Host's request-correlation store. It does not execute a
second App work loop or gate completion on a transport receipt. Ordinary human
views use `/tasks` and exact Task resources. Request rows remain private
correlation and history; they are not another human work view.

`Conversation may:primary` is one such projection. It reconstructs shared human
context from durable messages and accepted results; it is not another database,
work list, or owner. Adapters observe its updates and render independently, so
their delivery state never gates a human request's semantic completion.

## Events and time

- Every state-changing input first becomes one event.
- A human `conversation.message.created` event adds shared May Conversation
  context and creates one fenced May App request.
- An addressed `app.input.requested` event creates one durable App request.
- A declared subscription translates a fact into typed input and then one task.
- An exact task target wakes only that task.
- A schedule creates an input or publishes a fact.
- An observer reads external state and returns facts.
- A metric describes what happened; it does not create work by itself.

Record-only facts remain valid with no consumer. Required event types must have
one semantic route that durably accepts responsibility. The Host never guesses
an owner or starts an agent because an event was not handled.

## Waiting and cross-App dependencies

A task result may request a typed child App outcome with a stable local ID,
target App, and typed input. Runtime derives one deterministic child request
ID, publishes that request durably, and installs an exact completion Condition
on the parent. The child App resolves its input to its own Task. Its accepted
result returns as an ordinary Event containing summary, response, and evidence;
the parent reconciles again and decides its own outcome.

Dependency completion is one durable Event, not a private callback. The Host
may use that same Event to wake a correlated request and every exact matching
Task Condition. One consumer must not stop the Event from reaching the others.

The first declaration creates the child request ID. While its Condition is
open, later attempts keep that durable request attached. They may name the
request ID directly to reuse it even when explanatory input text varies. A
same-target replacement that does not preserve the open request is rejected
before another request is published; clearly distinct dependencies remain
possible when the existing request is also declared. If the process stops
between request admission and parent deferral, attempt recovery repeats only
the same idempotent command; if the child finished before the Condition was
installed, persisted-event replay closes the race. No App polls another App's
store or owns a second loop.

The parent must construct input accepted by the target App's declared schema.
It cannot wrap arbitrary structured fields in a generic `message` input unless
that target schema explicitly declares `message`. Schema rejection creates no
Task and remains visible on the parent dependency; Runtime never guesses a
translation.

An accepted task result separates `summary` from `response`. `summary` explains
the task state to operators and future attempts. `response` is the optional
semantic answer owed to an addressed caller. Infra projects the response back
to every linked request; delivery wording and receipts do not enter App policy.

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
