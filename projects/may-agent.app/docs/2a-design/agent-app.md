# App Contract

**Design status:** Accepted.
**Implementation status:** Every current App uses Task reconciliation for
durable side-effecting work. Pure translators and Task resolvers select durable
work during admission; they cannot perform it. Request storage correlates Task
results without a second owner or delivery loop. Scoped Task list/get reads are
implemented across the SDK, agent tool, control socket, and HTTP. The Host
Operations App passes its complete local source check; remaining Host and App
simplification gaps stay in the convergence tracker.

An App is one durable address with one accountable responsibility. Keep the
mental model to one work object and three responsibilities:

```text
Task    = the durable desired and observed App work
Event   = durable new information that may create or wake that work
Infra   = ingress, persistence, scheduling, capacity, and delivery
Runtime = task lifecycle, execution, scoped capabilities, and recovery
App     = resolve inputs to tasks and reconcile those tasks
```

Agents, workflows, and CLI adapters are replaceable ways an App may perform a
bounded attempt. They never own the Task. An agent is only a named reasoning
profile: instructions, tools, and model behavior for that attempt. It has no
inbox, Task namespace, scheduler, retry loop, or completion authority. Events
and caller requests are supporting records managed by Infra or Runtime.
“Fact” is only the meaning of an Event that reports an observation.

See [Projects](projects.md) for durable project posture,
[Task Resource Engine](task-resource-engine.md) for task reconciliation, and
[Workflows](workflows.md) for reusable process ownership. The migration and
deletion sequence is recorded in
[Canonical App Migration](../archive/implementation/canonical-agent-app-migration.md).

## Choosing the stored record

Use this plain rule:

```text
someone expects one answer            -> Host request linked to an App task
an App must make an outcome true       -> task
something happened but creates no work -> fact
```

Every input or fact first enters as an event. The Host records caller
correlation when needed, and pure App policy decides which task the admitted
input creates, revises, attaches to, or wakes. In code, a request is stored in
the App inbox and the deferred request coordinator calls `task(input)`. The
inbox never reconciles that Task or runs a second work loop.

Human input, a cross-App dependency, an action, a schedule, or a subscribed
fact may create a caller request and task. A metric, provider observation,
lifecycle fact, or scheduled wake normally remains a fact unless the App
explicitly turns it into work.

An action is not stored work. It is a named and validated request template:

```text
invoke action(name, parameters)
  -> validate parameters
  -> translate to App input
  -> admit one App request
```

After admission, callers track the request identity and result. The action has
no status, owner, retry, or completion state of its own.

One fact may intentionally be observed by several Apps, but within one App it
has one route: observation only, translation to typed task input, or an exact
task/Condition wake. Exact stored Condition wakes are additive because their
tasks already own the work.

An actionable event is not merely a queue hint. Runtime stores its link to the
task before enqueueing the stable task ID. Reconciliation receives a bounded,
ordered batch of events not yet accepted by that task. Accepting a result
advances the task's event checkpoint through that batch in the same state
transition. Events that arrive during the attempt remain pending and cause a
later attempt. Queue coalescing may reduce execution pressure, but it never
replaces or consumes these durable event links.

The only App work loop is:

```text
typed input -> TaskIntent -> task <--- durable event
                              |             ^
                              v             |
                    selected attempt handler|
                              |             |
                              +-- result ---+
```

- `TaskIntent` records the latest desired outcome; Runtime separately records
  the ordered events that declared or woke it.
- A task preserves desired and observed state across bounded attempts.
- A workflow applies reusable experience; otherwise the selected agent or a
  named Host executor performs one bounded attempt.
- A result advances observed state; a Condition names the exact fact required
  before work can continue.
- Queue coalescing happens only after the latest desired intent and trigger are
  persisted.
- A simple request follows the same loop and converges in its first attempt.

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
registry, or owner-entry wrapper. Workflows live under the agent whose bounded
experience and tool surface they use.

## Canonical declaration

Every App exports one `defineApp(...)` declaration from the stable
`@may-agent/sdk` root:

```ts
export default defineApp({
  id: "sample",
  version: 1,
  agent: "sample-agent", // default agent for bounded attempts
  inputSchema,

  // Pure mapping from admitted domain input to existing or desired task state.
  task: resolveTask,

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

The public field is named `agent`. It selects the App's default agent for a
bounded attempt; it does not make the agent the App or the Task owner. The Host
temporarily accepts the old `owner` spelling only at compatibility boundaries
for retained state and older App definitions.

Identity, default agent, version, input schema, and Task resolution form the
App contract. Subscriptions, observation-only selectors, schedules, observers,
commands, workspace policy, agents, and workflows are optional capabilities
hosted by the runtime. The default agent is only the fallback attempt handler;
it is not the App identity. These capabilities feed or help reconcile tasks;
they do not add App work loops.

`app.ts` is also the sole App composition boundary. App-local modules may be
imported normally, but no conventional `services/` directory, live service
export, or second loader grants autonomous behavior. Another App's outcome is
requested through a typed Runtime-managed task dependency; shared facts cross
through declared event routes.

## Addressed work

Every App automatically has Host-owned request correlation and task execution.
An admitted request carries a stable identity, source, and typed input. The
Host calls the App's pure task resolver, persists the existing or desired task
attachment, and schedules only that task. Host-private rows, claims, leases,
channel metadata, and persistence handles never enter App code.

Addressed ingress uses a required `app.input.requested` event. Acceptance means
the Host created or found exactly one durable request and linked it to the
event and its task. The request waits for that task's accepted result; it never
invokes the selected agent independently of the Task. The result may include an
optional caller-facing `response`; its `summary` remains concise operational
state for task views and recovery. Apps put no channel delivery state into
either field.

There is no App disposition lifecycle. Immediate completion means the Task
converged in one attempt. Agent calls, workflows, and cross-App dependencies
are capabilities used by an attempt; their records never replace the Task.

A Task may request one typed outcome from another App:

```ts
dependencies: [{ id: "review", appId: "evaluation", input: { kind, data } }];
```

When the intent is feedback or a decision for exact unfinished work, it names
that Task rather than creating a sibling:

```ts
dependencies: [
  { id: "feedback", appId: "evaluation", taskId, input: { kind, data } },
];
```

The local `id` is stable within the parent generation. Runtime owns the
derived request identity, idempotency, admission, completion Condition, and
result Event. The source App supplies input accepted by the destination App's
declared schema; it does not emit `app.input.requested`, query the destination
store, or wait for transport acknowledgement.

Only successful durable admission installs an external wait. Rejection leaves
the same parent Task runnable with exact evidence so its App can correct the
input or choose another safe path. Completion, failure, interruption,
attention, and disappearance of a formerly linked Task all wake the exact
requester. Runtime re-observes persisted waits after restart.

May's human-facing behavior is one use of this generic contract, not part of
the App authoring model. [Message Lifecycle](message-lifecycle.md) owns its
bounded frontend decision, clarification quality, Topic linkage, one visible
conversation Task, direct advice, exact feedback, follow-through, and
plain-language response rules. [Human Control Surfaces](human-control-surfaces.md)
owns focused App/Task context and supported human controls.

The Host Operations App (`app:may-agent`) is an ordinary App for desired Host
changes. May may address it through typed input, but routine Task feedback,
cancellation, and presentation remain on the shared Task and adapter
boundaries; Host Operations is not an intermediary.

## Events and subscriptions

Events carry requests or facts into the Host. Required event types create one
linked responsibility; record-only fact Events may wake zero or more declared
routes.
Events do not own mutable work or directly launch an agent.

App `subscriptions` are intentionally rare. Each has a stable ID, an event
selector, and a pure `toInput(event)` translator. A non-null result enters the
same task resolver as addressed input. The Host adds caller correlation only
when the source expects a result. A fact carrying an explicit task target
bypasses broad resolution and wakes only that task.

`subscriptions` translates a fact into correlated App input;
`tasks.subscriptions` directly resolves a callerless fact to Task intent. The
forms serve different admission semantics but converge on the same Task store
and reconciler, and one App cannot claim both actionable forms for the same
fact. There is no generic `events` route or imperative `onEvent` execution
path.

An App may declare exact `observations` selectors for reviewed facts that
intentionally create no work. After actionable route evaluation selects no
TaskIntent, exact wake, or Condition wake, the Host records a terminal no-op
against the installed registry generation. The core EventBus does not contain
an application event-name catalog.

## Request entrypoints, schedules, and observers

The SDK property is named `actions` for compatibility. Each entry is a
discoverable typed request entrypoint. The Host validates its input, translates
it through `toInput`, and publishes `app.input.requested`. It returns the
created or deduplicated request identity. An action cannot invent another
actionable event as a shortcut around correlated admission.

Human interfaces render actions as plain App commands such as “Review App” or
“Explore now,” not as a separate resource list or event emitter.

A schedule declares exactly one destination:

- `{ input }` publishes a correlated `app.input.requested` event and may declare
  `none` or `latest` catch-up; or
- `{ event }` publishes a fact through the shared scheduler and does not replay
  missed facts.

Use an input schedule when each due slot declares task intent. Use an event
schedule when time merely records a fact or wakes an exact existing task.

An observer is a bounded deterministic adapter for external state:

```text
provider state -> observer -> semantic fact -> input, exact wake, or projection
```

It receives capability-scoped read and logging ports and returns facts for the
host to publish after successful observation. It does not launch an agent,
know inbox or task storage, or mutate runtime state. Legacy watchers migrate to
observers, workflow inputs, or explicit offline maintenance according to their
actual responsibility.

## Task reconciliation

The shared task reconciler is the App runtime. The App supplies typed intent,
domain judgment, workflow inputs, acceptance, and results; the Host owns
storage, generations, attempts, leases, queues, workspace allocation, result
admission, recovery, and projections.

Agent selection resolves from the Task, nearest explicit ancestor, then the
App's default agent. The selected agent must be runnable:

```text
task.workflow present -> agents/<agent>/workflows/<workflow>.ts
task.workflow absent  -> one bounded run of the selected agent
```

A workflow may return the compatibility state `needs-agent` for one bounded
handoff to that agent; it does not transfer Task ownership.
Unavailable named workflows produce an explicit unavailable/attention state;
they are not silently treated as unbound agent work.

Targeted task wakes, Condition observations, recovery, and delivery resync
enqueue stable task identities through the same controller. The queue never
becomes desired-state authority and never carries an unpersisted replacement
specification.

## Runtime boundary

The process-wide App registry validates and publishes one atomic generation of
canonical definitions. A failed reload leaves the previous generation active.
Only the long-running Host attaches schedules, observers, request correlation,
and task controllers; direct, Gym, and read-only processes reuse
agent/workflow execution without becoming competing reconcilers.

The host owns:

- admission, idempotency, delivery, attempts, leases, and restart recovery;
- shared scheduling, concurrency, retry/backoff, and stale mechanical repair;
- task and Condition mutation, result admission, receipts, and projections;
- workspace allocation and portable path resolution; and
- generic operational metrics and traces.

Apps own domain meaning, input schemas, pure task resolution, reconciliation,
acceptance, observer interpretation, workflows, and domain metrics. Apps never
receive raw SQL, request or adapter state, unrestricted task storage, global
runtime paths, scheduler handles, or recovery APIs.

When task reconciliation is paused, the Host admits input and keeps schedules,
observers, and declared event routes active, but starts no new task attempts.
Durable task intent and wakes accumulate for resume. Pause and resume remain
explicit control operations, not conclusions inferred from open work.

## Reliability convention

```text
known transient failure
  -> bounded retry of delivery or execution
  -> repair stale mechanical state
  -> requeue the same persisted obligation
  -> attention when judgment is required
  -> explicit escalation only across a real ownership boundary
```

The Host preserves the same request or task identity. It never invents
project strategy. Repeated equivalent facts may coalesce scheduler pressure,
but they do not erase the latest persisted intent, correlated request, or
evidence.

Metrics observe the loop. Host metrics describe Host health; App metrics
describe domain outcomes. A metric breach is a fact that may wake a task or,
when a new outcome is genuinely required, declare or revise a task through the
App input path. It is never an alternate work authority.

## Contract migration progress

The code moves to this model in one direction while preserving restartable
work:

1. **Done:** add the pure `task(input)` contract and a Runtime admission method
   that atomically links each caller request to its task before any App attempt.
2. **Done:** route actions, input schedules, subscriptions, and human messages through
   that method; keep exact task and Condition wakes direct.
3. **Done for current Apps:** run agent/workflow judgment only from the task controller. Make request
   storage observe accepted task results for completion and delivery.
4. **Done:** replace `complete`, `task`, `delegate`, `analyze`, and May
   `continue` dispositions with first-attempt convergence, typed task changes,
   and bounded Runtime dependency capabilities.
5. **Done:** port every current App manifest to the one Task contract.
   The request owner worker, separate execution concurrency, delivery gate, and
   compatibility SDK types are removed.
6. **Done:** expose bounded Task list/get reads through the shared scoped SDK,
   agent tool, control socket, and HTTP adapters. Admission, restart,
   concurrency, dependency, and Conversation projection behavior have focused
   regression proof.

At every step there remains one authoritative task and at most one App
execution path for newly migrated input. Compatibility may translate old
declarations at load time, but it must not run both paths for the same input.
Remaining Runtime and App cleanup is tracked in
[design-implementation-convergence.md](../proposals/design-implementation-convergence.md).

## Integrity invariants

1. One App has one `defineApp` declaration, one registry identity, and one
   default agent selection.
2. Every addressed request has one authoritative Host record, one linked task,
   and one correlated terminal result.
3. Every App-owned outcome has one authoritative task identity.
4. Events, metrics, logs, and projections never become work authorities.
5. Every actionable fact has exactly one canonical route unless two distinct
   durable obligations are explicitly declared and tested.
6. App subscriptions translate facts to the same typed task-input path;
   observation-only facts create no task.
7. Task intent and trigger evidence are persisted before queue coalescing.
8. Loading or reloading an App cannot itself start model work, and failed reload
   cannot publish a partial generation.
9. Direct, Gym, and read-only processes cannot claim autonomous App work.
10. Agents and workflows cannot mutate inbox/task storage or runtime mechanics.
11. Recovery preserves obligation identity and does not invent desired state.
12. Read projections, event delivery rows, and queue entries never become
    mutation authority.
13. Human results retain their Topic and Task references and enter Conversation
    without waiting for an adapter receipt.
14. The public authoring surface contains no `defineProjectApp`,
    `@may-agent/sdk/legacy`, owner-inbox fallback, or imperative event execution.

Focused verification covers request-to-task admission and delivery,
cross-App dependencies, subscription idempotency, input and event schedules,
task resolution and exact wakes, restart/reload recovery, Conditions, bounded
concurrency, and removal of the separate inbox owner loop.
