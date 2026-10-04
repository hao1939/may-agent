# Lightweight Event-Driven Reconciliation

**Historical context:** [System Model](../../2a-design/system-model.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


**Status:** Accepted, implemented, and verified on 2026-08-24

**Scope:** the smallest useful Host core, fast event admission, bounded Task
reconciliation, recovery, and extension without permanent background cost

## Decision

Use one plain loop:

```text
event arrives
  -> persist the event and exact request, journal, Task wake, or control
  -> return the receipt
  -> asynchronously map admitted requests to Task work
  -> run one bounded reconciliation attempt
  -> atomically accept what changed
  -> release execution resources
```

May is a small App that understands human intent and handles recoverable human
requests. It answers directly or asks the responsible App to own a durable
Task. The Host supplies persistence, wake-up, bounded execution, recovery, and
delivery. Every App supplies meaning.

The governing semantic-decision rule is:

> Code collects bounded trustworthy context and executes a validated decision;
> the LLM makes the semantic decision.

Code owns exact reads, schemas, deterministic controls, identity, authority,
fencing, and effects. It may apply a pure deterministic rule when meaning is
already explicit. It must not grow a parallel keyword router, intent
classifier, or conversational state machine.

The governing cost rule is:

> Handling one event should cost roughly the size of that event and the exact
> resources it changes, never the size of retained history or the whole App.

Rich features attach as bounded event consumers, reads, or Task capabilities.
They do not enlarge every prompt, gate semantic completion, or keep an idle
Host busy.

## Smallest system

| Part              | One job                                                               |
| ----------------- | --------------------------------------------------------------------- |
| EventHub          | Persist events, assign identity, record exact admission, notify       |
| Request record    | Correlate a caller that is owed a later result                         |
| Task store        | Keep current desired and observed App work                             |
| Ready set         | Coalesce runnable `(appId, taskId)` identities                         |
| Executor          | Run one fenced bounded attempt, return one result, then release        |
| Apps              | Map input to Tasks and decide what one Task should do next             |
| Adapters          | Publish input and render durable resources for each interface          |

There is no durable queue service, App daemon, task-tree scheduler, delivery
gate, semantic adapter router, or mandatory evaluation loop. A request is
correlation, not another work lifecycle. A Task owns eventual completion. An
attempt is temporary execution evidence.

## Publication and handling

Publication has one deliberate split:

```text
publish (inline)                         handle (later)
validate envelope                       map a request to its Task
append event                            reconcile a Task
run pure route mapping                  call a model/provider
record request, journal, wake, control  run command/workflow
return receipt                          render Console/Telegram
```

The inline side may run only bounded pure policy:

- selector matching;
- `subscription.toInput(event)`;
- `tasks.resolve(event)`; and
- validation needed to freeze the exact route.

It may not call a model or provider, start execution, render an interface,
scan broad state, or perform unrelated file work. `task(input)` runs in the
deferred request coordinator. All mappings select durable work; Task
reconciliation is the only side-effecting App policy path.

An `async` function is not automatically a scheduling boundary. Handling must
enter a later event-loop turn before opening a claim or preparing execution.
The current request pump starts at most one claim per turn and uses
Host-configured request capacity. Apps do not configure request concurrency.

## Events and Tasks are decoupled

Different Tasks may reconcile in parallel. One Task has at most one current
attempt. An event for a running Task is durably linked and marks it changed; it
does not start a second attempt or invalidate the current fence.

Each claim receives a bounded ordered prefix of unobserved events. An accepted
result advances only that prefix. Input that arrives during execution remains
pending. A storm therefore produces neither one worker per event nor an
unbounded prompt.

Task persistence keeps one canonical event envelope with its EventHub ID. It
does not flatten the payload into a second top-level copy or persist the same
event again as an attempt trigger. Runtime derives the compatibility trigger
view in memory. Legacy and synthetic attempts without an event batch remain
readable.

## Mid-attempt publication

An attempt may publish progress, findings, child coordination, or facts before
its final result is accepted. Every publication is its own durable commit:

1. verify the current Task generation and attempt fence;
2. deduplicate by a stable local key;
3. append the event with causal identity;
4. persist any exact wake; and
5. notify listeners.

There is no distributed rollback if the attempt later fails. Retrying the same
local key cannot duplicate the event. An expired or replaced attempt cannot
publish.

Cross-App work that owes a result uses a typed dependency and deterministic
request identity. Generic fact publication cannot create a second correlation
authority. Apps should normally publish or delegate, record a wait, and
release expensive execution rather than hold a model while another Task runs.

## One Task interface

Managed agents, workflows, Codex, Claude, and registered executors receive the
same small contract:

```ts
type TaskAttempt = {
  appId: string;
  task: TaskDetail;
  cwd: string;
  events: TaskEventBatch;
  publish(localKey: string, event: AppEvent): Promise<EventReceipt>;
  onEvent(listener: (event: AppEvent, accept: () => void) => void): () => void;
};

type TaskExecutor = (attempt: TaskAttempt) => Promise<TaskReconcileResult>;
```

Live input is an optional latency improvement. Calling its attempt-local
`accept` only consumes that exact event if Runtime later admits the returned
result in the same fenced transaction. Otherwise the durable next-attempt batch
remains authoritative. Changing executor changes how one attempt runs, not
Task identity, fencing, recovery, or acceptance.

The same rule applies to all previously accepted Task state. Claiming an
attempt records execution state but leaves the accepted observed generation,
summary, result, evidence, and Conditions intact. Failure releases the attempt
and restores that exact baseline. It does not turn accepted waits into
unobserved desired state. Consequently a retry receives the same dependency
request IDs and cannot create replacements merely because validation failed.

## Recovery is insurance

Events are the ordinary wake mechanism. Recovery covers lost in-memory hints
and process failure with:

- one bounded startup query;
- the nearest due-time timer;
- indexed expired-lease repair;
- bounded admission-journal recovery with cooldown; and
- a bounded safety query that advances an indexed cursor.

Recovery never scans or deserializes a whole App tree on every interval. The
admission journal is immutable crash evidence, not a durable work queue. Task
rows, event links, Conditions, attempts, and receipts are canonical authority.

Parent and dependency relationships have exact indexed rows. Context reads
join those rows rather than scanning relationship JSON across the App.

## Capacity and priority

The Host has one Task-attempt capacity and optional per-App Task limits. Cheap
request coordination has its own Host-private bound so it cannot consume model
capacity. Human input may use reserved foreground scheduling, but the same
durability and Task path still applies.

Capacity answers when execution may start. Apps answer what matters and what
counts as done. Neither adapters nor Apps configure Host request scheduling or
recovery cadence.

## Extension rule

Extensions react to events and release their resources:

- Console, Telegram, HTTP, and Web UI publish the same semantic inputs and
  render the same resources in interface-appropriate ways;
- passive listeners use filtered bounded FIFOs and reread durable state after
  a missed hint;
- schedules publish App input or facts;
- observers perform one bounded external read and return facts;
- metrics and traces observe work but do not gate it; and
- a new executor implements the TaskAttempt contract, not another daemon.

A slow adapter or observer cannot extend event acceptance or block another
listener. Optional notifications may be dropped; durable resources are the
resynchronization authority.

## Responsibility boundary

```text
Host = ingress, persistence, capacity, scheduling, Task lifecycle,
       execution, recovery, and delivery
App  = input meaning, Task identity, desired outcome, acceptance, and
       bounded reconciliation policy
```

Infra and Runtime are useful code responsibilities inside the one Host, not
services an App composes. The SDK exposes typed meaning and bounded attempt
capabilities. It does not expose queues, leases, database handles, request
scheduling, rescan intervals, or recovery workers.

## Performance contract

The implementation must preserve these structural properties:

1. `publish` returns before request claims, model calls, workflows, network
   delivery, or presentation begin.
2. One Task transition reads and writes its exact bounded rows.
3. Task event batches and automatic context are bounded.
4. Passive consumers cannot block semantic acceptance or each other.
5. Human work is not starved by normal background attempts.
6. Recovery queries are indexed, bounded, and quiet between due work.
7. Completed detail does not remain in hot mutable state.
8. Historical data is retained until a separate safe retention plan exists.

Model latency is observed but not attributed to Host overhead. Verification
must separate admission, ready wait, claim, context build, provider time,
result persistence, and delivery.

## Implementation state

| Area                                      | State |
| ----------------------------------------- | ----- |
| Deferred request claim/coordination       | Done  |
| Passive bounded event listeners           | Done  |
| Resource-backed Task authority            | Done  |
| Indexed ready/due/lease recovery           | Done  |
| Indexed parent/dependency relationships   | Done  |
| Canonical non-duplicated Task event batch | Done  |
| Executor-neutral TaskAttempt contract     | Done  |
| Managed, workflow, Codex/Claude executors | Done  |
| Host-private request/recovery tuning      | Done  |
| Final full-suite and design/code audit    | Done  |

## Acceptance

The migration is complete only when:

- current Apps use one input-to-Task and Task-reconciliation path;
- repository search shows no live disposition worker, App inbox scheduler,
  App-configured request concurrency, or App-configured rescan cadence;
- a large Event is persisted once per Task attempt, with compatibility reads
  and recovery still passing;
- targeted and broad tests, type checks, schema migration tests, query plans,
  and App contract tests pass;
- accepted design describes the running code; and
- a fresh final audit finds no remaining authority duplication or unbounded
  hot-path scan.

Final verification passed the Host type, SDK, canonical-boundary, schema,
unit, integration, and end-to-end checks (2,423 tests), plus all current App
contract tests (80 tests). The final audit found only intentional legacy reads
for old/synthetic attempt triggers; new event-backed attempts persist one
ordered event batch.

## Non-goals

- introducing Kafka, a durable broker, or another service;
- creating a second fast path for simple chat;
- routing human language with adapter regexes;
- keeping workflows or sessions alive across durable waits;
- promising exactly-once external side effects; or
- deleting historical data before authority and references are understood.

The result is not a less capable system. It is a small Host whose capability
grows through Apps, executors, and event consumers without making every human
turn, Task transition, or idle minute more expensive.
