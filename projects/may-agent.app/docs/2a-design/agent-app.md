# Agent App Contract

**Design status:** Accepted.
**Implementation status:** Implemented. The canonical host owns App Inbox and
the optional host-private App task runtime through this contract.

An Agent App is one durable address with one accountable owner. It packages
typed input, optional supporting agents, domain policy, and optional durable
task reconciliation without implementing another runtime.

```text
Agent      = independently runnable capability and judgment
Workflow   = reusable bounded process owned by one agent
Agent App  = durable address + inbox + owner + domain policy
Task       = optional durable desired outcome reconciled inside an App
Event      = persisted fact and wake signal, never work ownership
Host       = generic admission, delivery, scheduling, execution, and recovery
```

The public unit is the App. The bounded execution unit remains an agent or
workflow. The App inbox and optional task resource are the only durable work
authorities.

See [Projects](projects.md) for durable project posture,
[Task Resource Engine](task-resource-engine.md) for task reconciliation, and
[Workflows](workflows.md) for reusable process ownership. The migration and
deletion sequence is recorded in
[Canonical Agent App Migration](../archive/implementation/canonical-agent-app-migration.md).

## Primary mental model

Every input or fact is classified by the durable obligation it creates:

```text
addressed input requiring a distinct result -> App inbox
changed fact with deterministic desired work -> task resolver
fact with no actionable obligation          -> event only
```

This is not a classification by transport or by whether somebody is waiting
synchronously. Human input, App delegation, an action, a schedule, or a fact
translated by an App subscription may all create an independently correlated
inbox obligation. A metric, provider observation, lifecycle fact, or scheduled
wake normally remains a fact and may resolve directly to desired task work.

One fact may intentionally be observed or acted on by several Apps, but within
one App it never matches both an App subscription and a task subscription. If
an independently correlated request also needs desired-state convergence, its
inbox disposition may attach the task after request admission. Exact stored
Condition wakes are additive because their tasks already own the work.

For durable autonomous work, the visible controller loop is:

```text
fact -> TaskIntent -> task -> workflow or owner -> result or Condition
                       ^                              |
                       +---------- reconcile --------+
```

- `TaskIntent` records the latest desired outcome and exact trigger.
- A task preserves desired and observed state across bounded attempts.
- A workflow applies reusable experience; otherwise the accountable owner uses
  judgment.
- A result advances observed state; a Condition names the exact fact required
  before work can continue.
- Queue coalescing happens only after the latest desired intent and trigger are
  persisted.

Apps without durable autonomous work do not attach the task capability.

## Package layout

```text
projects/<id>.app/
  app.ts                 # one canonical App definition
  project.json           # optional durable project posture
  agents/
    <agent>/
      agent.json
      AGENTS.md
      workflows/
  observers/             # optional bounded external-state adapters
  tasks/seed.json        # optional boot-only desired task state
  scripts/               # explicit offline maintenance, not runtime imports
  .state/                # host-managed runtime state
```

There is no parallel `inbox.ts` manifest, Project App definition, workflow
registry, or owner-entry wrapper. Workflows live under the agent that owns the
experience.

## Canonical declaration

Every App exports one `defineApp(...)` declaration from the stable
`@may-agent/sdk` root:

```ts
export default defineApp({
  id: "sample",
  version: 1,
  owner: "sample-owner",
  inputSchema,
  inbox: { batch: "single", maxConcurrent: 2 },

  route(request) {
    // Pure deterministic request disposition, or null for owner judgment.
    return routeRequest(request);
  },

  subscriptions: [
    {
      id: "human-project-comment",
      event: { type: "project.comment.created", project: "sample" },
      toInput: commentToInput,
    },
  ],

  schedules: [
    {
      id: "reconcile-current-state",
      intervalMs: 300_000,
      event: {
        type: "sample.reconcile.requested",
        data: { reason: "scheduled" },
        target: { appId: "sample", project: "sample" },
      },
    },
  ],

  observations: ["provider.snapshot.recorded"],
  observers: [providerObserver],

  tasks: {
    attach: true,
    subscriptions: taskSelectors,
    resolve: resolveTaskIntent,
    validateAction,
    maxConcurrent: 2,
    resyncIntervalMs: 60_000,
  },

  actions: {
    review: {
      description: "Request one correlated review.",
      inputSchema: reviewSchema,
      toInput: (data) => ({ kind: "review", data }),
    },
  },

  workspace: { kind: "local", localPath: "." },
});
```

Only identity, owner, version, and input schema are fundamental. Inbox tuning,
subscriptions, observation-only selectors, schedules, observers, actions,
workspace policy, and task
integration are optional capabilities hosted by the same runtime.

`app.ts` is also the sole App composition boundary. App-local modules may be
imported normally, but no conventional `services/` directory, live service
export, or second loader grants autonomous behavior. Another App's outcome is
requested through typed delegation; shared facts cross through declared event
routes.

## Addressed work

Every App automatically has a durable inbox and owner dispatch. An admitted
request carries a stable identity, source, typed input, optional parent, and
optional dependency observation. Host-private rows, claims, leases, channel
metadata, and persistence handles never enter App code.

The optional pure `route(request)` policy may return the same disposition
vocabulary as the owner:

- `complete`: finish this exact request with a correlated result;
- `delegate`: create a child request addressed to another App; or
- `task`: attach this request to an existing task or desired `TaskIntent`.

Returning `null` asks the owner for one bounded judgment. An inbox item remains
the authority while it waits on a child App, task, session, or delivery. It is
not replaced by an event pair or by a copied task record.

The `may` App owns ordinary human conversation and final channel delivery. It
may answer directly or delegate to another App and review the child result.
It has no schedules, observers, or task attachment, so conversational
ownership cannot become a background project controller.

## Facts and subscriptions

Events are durable facts and edge-triggered wakes. They do not own work and do
not directly launch an agent.

Top-level App `subscriptions` are intentionally rare. Each has a stable ID, an
event selector, and a pure `toInput(event)` translator. A non-null result
creates one independently correlated App inbox request. The host validates the
input and persists it with an idempotency key derived from App, subscription,
and event identity before acknowledging delivery.

`tasks.subscriptions` select facts that deterministically declare or revise
desired task work. The pure `tasks.resolve(event)` returns one `TaskIntent` or
`null`; it cannot execute work or mutate runtime state. A fact carrying an
explicit task target bypasses broad resolution and wakes only that task.

There is no `inbox.accepts`, implicit fallback from task subscriptions to the
inbox, generic `events` route, or imperative `onEvent` execution path.

An App may declare exact `observations` selectors for reviewed facts that
intentionally create no work. After actionable route evaluation selects no
inbox item, TaskIntent, exact wake, or Condition wake, the host records a
terminal no-op against the installed registry generation. The core EventBus
does not contain an application event-name catalog.

## Actions, schedules, and observers

An action is discoverable typed ingress. The host validates action input,
translates it through `toInput`, and admits the result to the App inbox. An
action cannot publish an actionable event as a shortcut around correlated
admission.

A schedule declares exactly one destination:

- `{ input }` creates a correlated inbox obligation and may declare `none` or
  `latest` catch-up; or
- `{ event }` publishes a fact through the shared scheduler and does not replay
  missed facts.

Use an input schedule only when each due slot deserves its own disposition.
Use an event schedule when time merely wakes deterministic desired task work.

An observer is a bounded deterministic adapter for external state:

```text
provider state -> observer -> semantic fact -> subscription, task, or projection
```

It receives capability-scoped read and logging ports and returns facts for the
host to publish after successful observation. It does not launch an agent,
know inbox or task storage, or mutate runtime state. Legacy watchers migrate to
observers, workflow inputs, or explicit offline maintenance according to their
actual responsibility.

## Task capability

Attaching tasks installs the shared reconciler as an internal App capability.
The App supplies typed intent, validation policy, workflow inputs, and results;
the host owns storage, generations, attempts, leases, queues, workspace
allocation, result admission, recovery, and projections.

Task ownership resolves from the task, nearest explicit ancestor, then App
owner. The resolved owner must be runnable:

```text
task.workflow present -> agents/<owner>/workflows/<workflow>.ts
task.workflow absent  -> one bounded run of the resolved owner
```

A workflow may return `needs-owner` for one handoff of the same attempt.
Unavailable named workflows produce an explicit unavailable/attention state;
they are not silently treated as unbound owner work.

Targeted task wakes, Condition observations, recovery, and delivery resync
enqueue stable task identities through the same controller. The queue never
becomes desired-state authority and never carries an unpersisted replacement
specification.

## Runtime boundary

The process-wide App registry validates and publishes one atomic generation of
canonical definitions. A failed reload leaves the previous generation active.
Only the long-running host attaches schedules, observers, inbox dispatch, and
task controllers; direct, Gym, and read-only processes reuse agent/workflow
execution without becoming competing reconcilers.

The host owns:

- admission, idempotency, delivery, attempts, leases, and restart recovery;
- shared scheduling, concurrency, retry/backoff, and stale mechanical repair;
- task and Condition mutation, result admission, receipts, and projections;
- workspace allocation and portable path resolution; and
- generic operational metrics and traces.

Apps own domain meaning, input schemas, pure routing and correlation policy,
observer interpretation, workflows, and domain metrics. Apps never receive raw
SQL, unrestricted task storage, global runtime paths, scheduler handles, or
recovery APIs.

When `project_lifecycle` is paused, the host installs no schedules, observers,
task routing, controller, recovery, or resync for that App. Pause and resume
remain explicit control operations, not conclusions inferred from open work.

## Reliability convention

```text
known transient failure
  -> bounded retry of delivery or execution
  -> repair stale mechanical state
  -> requeue the same persisted obligation
  -> attention when judgment is required
  -> explicit escalation only across a real ownership boundary
```

Infrastructure preserves the same inbox or task identity. It never invents
project strategy. Repeated equivalent facts may coalesce scheduler pressure,
but they do not erase the latest persisted intent, correlated request, or
evidence.

Metrics observe the loop. Runtime metrics describe host health; App metrics
describe domain outcomes. A metric breach is a fact that may wake a task or,
when an independent disposition is genuinely required, create a subscribed App
request. It is never an alternate work authority.

## Integrity invariants

1. One App has one `defineApp` declaration, one registry identity, and one
   accountable owner.
2. Every addressed request has one authoritative inbox item and one correlated
   terminal result.
3. Every durable desired outcome has one authoritative task identity.
4. Events, metrics, logs, and projections never become work authorities.
5. Every actionable fact has exactly one canonical route unless two distinct
   durable obligations are explicitly declared and tested.
6. App subscriptions create correlated requests; task subscriptions resolve
   desired task intent; observation-only facts create neither.
7. Task intent and trigger evidence are persisted before queue coalescing.
8. Loading or reloading an App cannot itself start model work, and failed reload
   cannot publish a partial generation.
9. Direct, Gym, and read-only processes cannot claim autonomous App work.
10. Agents and workflows cannot mutate inbox/task storage or runtime mechanics.
11. Recovery preserves obligation identity and does not invent desired state.
12. Read projections, event delivery rows, and queue entries never become
    mutation authority.
13. Human delivery remains correlated to the originating May request through
    uncertain-delivery handling and final receipt.
14. The public authoring surface contains no `defineProjectApp`,
    `@may-agent/sdk/legacy`, owner-inbox fallback, or imperative event execution.

Focused verification covers request admission and delivery, delegation,
subscription idempotency, input and event schedules, task resolution and exact
wakes, restart/reload recovery, Conditions, bounded concurrency, and removal of
dual legacy/canonical consumption.
