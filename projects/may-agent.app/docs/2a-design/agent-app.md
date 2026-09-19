# App Contract

**Design status:** Accepted.
**Implementation status:** Every current App uses Task reconciliation for
durable side-effecting work. Pure translators and Task resolvers select durable
work during admission; they cannot perform it. Request storage correlates Task
results without a second owner or delivery loop. Scoped Task list/get reads are
implemented across the SDK, agent tool, control socket, and HTTP. The Host
Operations App passes its complete local source check; remaining Host and App
simplification gaps stay in the convergence tracker.

An App is one durable address with one accountable responsibility. It declares
inputs, Task mapping, execution selection and acceptance. Agents, workflows and
native executors perform bounded work; they never own the Task.

See [System Model](system-model.md) for the whole model,
[Task Resource Engine](task-resource-engine.md) for reconciliation, and
[SDK Quickstart](../2b-manual/sdk-quickstart.md) for the checked example.

The accepted [one-lifecycle target](task-resource-engine.md#one-lifecycle-baseline)
uses a stable Task for Conversation execution too. Tasks record outcomes and
remain available until an authorized owner closes them; ordinary Apps can close
after accepting the requested result by convention. The controller need not
classify finite and maintained responsibilities. Conversation execution and
ordinary App work use this shared Task controller; `conversation` selects the
bounded agent turn capability.

## Choosing the stored record

This document's Host request APIs track addressed input handling and caller
results. The conversational **Request** is the accepted ask whose loop May must
close; it can span multiple inputs. See
[Message Lifecycle](message-lifecycle.md#current-implementation-and-gaps) for
that distinction and the remaining implementation work.

Use this plain rule:

```text
someone expects one answer            -> Host request; link a Task for durable work
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

The durable App work loop is:

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
- A simple durable Task can converge in its first attempt. Bounded
  conversational input can finish directly under `conversation` policy instead.

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
  tasks/seed.json        # structural root for a new Task-based App; optional initial work
  scripts/               # explicit offline maintenance, not runtime imports
  .state/                # host-managed runtime state
```

There is no parallel `inbox.ts` manifest, Project App definition, workflow
registry, or owner-entry wrapper. Workflows live under the agent whose bounded
experience and tool surface they use.

## Canonical declaration

Every App exports one `defineApp(...)` declaration from the stable
`@may-agent/sdk` root. The following is a declaration sketch with omitted local
helpers, not a complete example; use the [quickstart](../2b-manual/sdk-quickstart.md)
for checked source:

```ts
export default defineApp({
  id: "sample",
  version: 1,
  agent: "sample-agent", // default agent for bounded attempts
  inputSchema,

  // Pure mapping from admitted domain input to existing or desired task state.
  task: resolveTask,
  tasks: {}, // ordinary Task policy; optional fact resolver and validation belong here

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

The Host records a stable request identity, source and validated input. For
Task-based input it calls `task(request)` with `{ id, source, input }`. The
callback returns `{ kind: "existing", taskId }` or `{ kind: "desired", intent }`.
The domain payload is `request.input`; a request mapping cannot return `null`.

### Assignment authority and context

Each fact has one authority. The conversational Request records what the caller
owes the human. The worker Task specification records its assigned outcome and
acceptance. Source documents, messages and results supply evidence; they do not
silently revise either obligation.

The destination App input is the single executable handoff: its pure mapper
creates the Task specification, and creator-authorized `tasks update` supplies a
complete revised input when requirements change. Conversation `followUp` carries
`appId`, `input`, optional `requestId`, and optional exact `task` identity. There
is no second outer outcome/constraints/acceptance payload for the Host to merge.
The App's declared operation can supply fixed meaning: an input such as
`{ kind: "status", data: {} }` can be complete when the App defines its outcome
and acceptance. This does not require every App to accept generic `outcome`,
`constraints`, or `acceptance` fields. After admission the Task specification
is the assignment authority; additional input is evidence under that assignment.
Reusing an exact Task admits context; it does not rewrite that Task's assignment.
Before creating related work or handling a correction, read the contextual
Task with `tasks get`. Reuse it when the outcome and execution method fit; revise
its assignment through the creator when needed. A converged result does not
close the Task. A later correction to its artifact can continue that Task while
a fulfilled human Request retains its historical closure.

Complete input does not mean copying all context. An App may accept a short
brief and retrievable references in its own schema. Each reference identifies
its purpose, retrieval location, and whether it is required reading. Pin a
reviewed version/section when acceptance depends on it; an intentional current
state read can request the latest version. Keep material requirements explicit
or in clearly governing references, preserve those references through revision,
and ensure the worker can retrieve them with its available tools and authority.
A private caller context or optional summary cannot carry an unstated requirement.
The Host retains the supplied references; it does not become a document store
or fetch arbitrary source content during admission.

### Admission and clarification

Admission checks shape, declared target and mechanical authority. App schemas
must reject inputs they cannot interpret rather than silently choosing unrelated
work. Shape validity does not prove semantic sufficiency. There is no separate
model admission service: the ordinary agent attempt reads available required
context, checks whether the assignment is actionable, and does justified work.
Addressed input and conversational handoffs use the same schema check. A rejected
input identifies the App and invalid field; for a literal-kind union, diagnostics
prefer the selected kind's branch. Validation still checks the complete schema.

If material information is missing, the worker returns the exact gap, what it
checked, useful partial work and the smallest clarification needed to its
assigning owner through the existing result/feedback route. The caller repairs
from its own context and authority first, asking the human only for a remaining
material choice or fact. Corrections use the same Request and creator-authorized
Task update paths; they do not create a parallel clarification lifecycle.

`incomplete` reports unfinished work and owner help needed; the Task remains
open under paced recovery. `waiting` requires an actual dependency or known fact
with a return route. A Condition's `requestedAction` records the desired action;
it does not notify someone. A waiting update uses the existing caller report
route. These result rules apply to ordinary Tasks and conversational callers.

The source candidate removes redundant Conversation handoff fields and shares
this guidance across both agent entrypoints. Old unaccepted decisions remain
execution evidence; they are not replayed as new executable handoffs. Deployment
and the real-source trial are recorded in May's
[iteration evidence](../../../may.app/docs/research-handoff-iteration-20260916.md).

`tasks.resolve(event)` is a separate pure callback for declared fact
subscriptions. It returns `TaskIntent | null`. It can decide a fact creates no
work; it does not replace addressed-input validation. Neither callback performs
I/O, invokes an agent, or mutates state. See the
[source types](../../../may-agent/packages/sdk/src/app.ts).

Addressed ingress uses `app.input.requested`. Admission persists the event and
caller correlation before returning; request-to-Task coordination runs
asynchronously. The request then links to the responsible Task and completes
from its accepted result. See [Events](events.md) for exact admission guarantees.

An App may declare `conversation: { mode: "agent", inputKinds: [...] }` for bounded
conversational input. That turn can finish authorized work directly or admit
durable intent. Other input kinds use normal Task mapping. May's policy is owned
by [Message Lifecycle](message-lifecycle.md). This is not a second durable work
loop.

Conversation and exact-Task addressing are mutually exclusive at admission.
Callers send Conversation input with `conversationId` and without
`targetTaskId`; the Host resolves the current execution Task for that stable
Conversation and preserves the caller correlation. `targetTaskId` is reserved
for ordinary exact Task input and must not name a current, successor, or retained
Conversation executor, even when `conversationId` is also supplied. The Host
normalizes exact Task identifiers before this check and before persistence, so a
stale or padded executor identity cannot bypass Conversation lineage or silently
land on another successor Task.

Task results may include a caller-facing `response`; `summary` describes
operational state. Neither field contains channel delivery state. A Task can
converge in one attempt, while longer work preserves the same identity.

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
bounded frontend decision, clarification quality, direct Topic-to-Task
linkage, the shared human/system input handler, direct advice, exact feedback, and
plain-language response rules. [Human Control Surfaces](human-control-surfaces.md)
owns focused App/Task context and supported human controls.

Maintenance is an ordinary App domain. An installed App may own desired Host
changes and receive typed input, just like any other domain App. Routine Task
feedback, cancellation and presentation stay on the shared Task and adapter
boundaries; no maintenance App is an intermediary for them.

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

### Resource ownership by convention

For resources created for one Task, prefer a resource-carried owner link over
a separate per-resource watch registration. Herdr's `event-watchd` is the
reference pattern: a worker labels its PR/build with a durable goal ID, and a
shared provider scan discovers it. May keeps its own Host event and Task path.

For example, a PR adapter documents one metadata location containing the
owning `{appId, taskId}`. A worker or creation tool writes that link as part of
creating the resource. An observer scans configured trusted repositories,
reads the link and relevant provider state, and returns an ordinary fact with
`target.appId` and `target.taskId`. The Host validates and durably routes it to
existing work. This describes an accepted integration pattern, not a new SDK
API or an already implemented universal PR metadata format.

The adapter owns provider-specific scope, metadata parsing, credentials,
bounded reads and source revision calculation. It does not resolve a live
agent/session, write Task state, invent repair actions or send model prompts.
The Host owns admission, scheduling and recovery; trusted App/agent guidance
owns what to do with the evidence. Observer and executor feedback follow
[the same event contract](events.md#execution-feedback-and-agent-wakes).

Keep the convention explicit and limited:

- A resource's owner link must be unambiguous and trusted within the configured
  scope. An address does not grant authority or let external data assert Host
  provenance. Do not guess an owner, create work or reopen a closed Task when
  its link is missing, invalid or stale.
- A remembered resource/revision is discovery evidence, not an independent
  subscription or ownership authority. Recheck source ownership when reading
  current state. Document discovery windows and make material coverage limits
  visible; a bounded scan is not a promise to find every resource.
- Shared health, credentials and read-only resources may use existing App or
  Condition routes. A Condition records what a Task awaits, not registration
  with an observer. A new Task may need a fresh level observation even when
  the provider has not changed.
- Removing the optional adapter removes its observation capability. Existing
  obligations remain visible; silence is not success. Keep the existing wait
  review/recovery path instead of adding adapter-owned recovery workers.

Adding a source should normally change its adapter, composition and response
guidance, not core lifecycle or a global subscription catalog. Prove the path
with one resource: discovery and exact ownership, a useful change, quiet
unchanged scans, failed publication and restart, and removed or closed owners.
Retain the existing event path and accept documented discovery/latency limits
before adding more machinery.

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

## Input handling and compatibility

Task-based input uses the shared Task controller and accepted-result path.
Bounded conversational turns use the frontend described in
[Message Lifecycle](message-lifecycle.md). Both reuse bounded execution; neither
creates a parallel authority for the same work.

The [migration notes](../archive/implementation/app-contract-migration-20260910.md)
are historical. Preserve retained callers and unfinished child obligations when
removing compatibility; new declarations use the current SDK.

## Integrity invariants

1. One App has one `defineApp` declaration, one registry identity, and one
   default agent selection.
2. Every addressed input has one authoritative Host handling record and a
   correlated handling result. Task-based input links its responsible Task;
   a conversational answer need not create one. Handling completion alone
   does not close an outstanding conversational Request.
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
