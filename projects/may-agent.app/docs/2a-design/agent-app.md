# App Contract

**Supports:** [Host And App Boundary](system-boundary.md). Lets a domain add accountable capabilities without rebuilding the Host.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

**Design status:** Accepted.
**Implementation status:** App admission maps input to Tasks; agents, workflows
and native executors perform bounded attempts under the shared lifecycle.
Task reads are exposed through the SDK, tools, control socket and HTTP. Pure
translators perform no work. App-specific behavior and installation state need
their own evidence; Host source checks do not certify every App.

An App is one durable address with one accountable responsibility. It declares
inputs, Task mapping, execution selection and acceptance. Agents, workflows and
native executors perform bounded work; they never own the Task.

See [System Model](system-model.md) for the whole model,
[Task Resource Engine](task-resource-engine.md) for reconciliation, and
[SDK Quickstart](../2b-manual/sdk-quickstart.md) for the checked example.

The accepted [one-lifecycle contract](task-resource-engine.md#one-lifecycle-baseline)
uses a stable Task lineage for Conversation execution too. Tasks record outcomes
and remain available until an authorized owner closes them; ordinary Apps can
close after accepting the requested result by convention. The controller need not
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

External inputs and facts use the declared Event ingress. Internal typed
calls use the same durable admission and correlation boundary; App code does
not need to publish a raw Host event for every call. Pure App policy decides
which Task the admitted input creates, revises, attaches to, or wakes. A caller
request is stored in the App inbox. Admission calls `task(input)` synchronously and commits the
exact Task link. Failed attachment is retained for recovery. The inbox never
reconciles that Task or runs a second work loop.

Mapping selects responsibility; reconciliation decides the domain response.
Keep translators bounded and free of effects. A failed translator is a routing
failure, not a decision that no work is needed. The Host must retain its
accountable admission evidence; the [current pre-plan recovery gap](events.md#resource-responsibility-and-reconciliation)
does not justify an App-local retry queue or a second inbox executor.

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
Addressed input, conversational handoffs, typed dependencies, and creator
revisions use the same full App-schema validation boundary. Each route retains
its distinct availability, authority, freshness, and correlation checks without
requiring those checks to occur in one universal order. A rejected input
identifies the App and invalid field and includes a bounded useful expected value
or constraint when the selected schema branch provides one; for a literal-kind
union, diagnostics prefer the selected kind's branch without weakening complete
schema validation.

The installed-App catalog remains a compact routing overview: required fields
and coarse data types help select an input kind but are not a second contract
language and cannot encode every conditional, enum, length, or numeric constraint.
When exact construction or diagnosis needs those details, the existing `tasks`
inspection surface returns the complete loaded App input schema with
`tasks({ action: "contract", target: { appId } })`; omitting `target` selects the
current App. The result is `{ appId, inputSchema }`, preserving root constraints
and references without branch extraction. Callers inspect that authoritative
schema rather than growing `dataTypes`, guessing from a rejection, or treating
an App action schema as a universal substitute for the App input contract.

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

Conversation handoffs use the destination App input plus an optional exact
Task reference. Both agent entrypoints use the shared result guidance.
Old unaccepted decisions remain
execution evidence; they are not replayed as new executable handoffs. Deployment
and the real-source trial are recorded in May's
[iteration evidence](../../../may.app/docs/research-handoff-iteration-20260916.md).

`tasks.resolve(event)` is a separate pure callback for declared fact
subscriptions. It returns `TaskIntent | null`. It can decide a fact creates no
work; it does not replace addressed-input validation. Neither callback performs
I/O, invokes an agent, or mutates state. See the
[source types](../../../may-agent/packages/sdk/src/app.ts).

Addressed ingress uses `app.input.requested`. Admission persists the event and
caller correlation, then maps and attaches the Task input before returning
where possible. Failed attachment remains durable for recovery. Execution runs
asynchronously; caller completion projects the exact accepted result.
See [Events](events.md) for admission guarantees.

An App may declare `conversation: { mode: "agent", inputKinds: [...] }` for bounded
conversational input. That turn can finish authorized work directly or admit
durable intent. Other input kinds use normal Task mapping. May's policy is owned
by [Message Lifecycle](message-lifecycle.md). This is not a second durable work
loop.

Conversation routing and exact-Task routing are mutually exclusive at
admission. Callers send Conversation input with `conversationId` and without
`targetTaskId`; the Host resolves the current execution Task for that stable
Conversation and preserves the caller correlation. `targetTaskId` is reserved
for ordinary exact Task input and must not name a current, successor, or retained
Conversation executor. Ordinary exact Task input may also carry
`conversationId` as reply provenance; that context does not change its exact
Task route. The Host normalizes exact Task identifiers before this check and
before persistence, so a stale or padded executor identity cannot bypass
Conversation lineage or silently land on another successor Task.

Task results may include a caller-facing `response`; `summary` describes
operational state. Neither field contains channel delivery state. A Task can
converge in one attempt, while longer work preserves the same identity.

**Source contract (Host PR #285, merged):** A Task submits work through `requests`. Its own `conditions` express whether it
needs the result:

```ts
{
  state: "waiting",
  summary: "Need the review before finishing",
  facts: [],
  requests: [{ id: "review", appId: "evaluation", input: { kind, data } }],
  conditions: [{ requestId: "review" }],
}
```

The receiving App owns interpreting and fulfilling the request. The Condition
belongs to the caller. Omitting that Condition submits identical work without
adding a caller wait; such submission may accompany `converged`. A caller may
use `tasks apply` to submit while continuing this attempt, or return
`state: "waiting", continue: true` to schedule another attempt for useful work.

The short Condition references a request's local `id` in this call/result or
one already admitted in the same caller generation. Host
resolves it to the exact durable request and fills in the existing completion
Condition's subject, expected result, owner and review interval. Apps still
return full Conditions for other observable facts. This is one Condition
lifecycle, not a separate dependency scheduler. Existing waits survive omitted
fields; withdrawing one still requires the explicit `retire-condition` action.

An optional `taskId` sends the input to exact existing work. Without it, the
receiving App's pure mapper selects an existing or new Task. The local request
`id` remains stable within the caller generation; Host owns durable identity,
idempotency, admission, result correlation and recovery. The source App supplies
input accepted by the destination schema. It does not publish transport events
or manage subscriptions. Legacy `dependencies` results are normalized once to
requests plus caller Conditions for compatibility; the agent schema exposes only
the new form and rejects combining the two forms.

Text and structured input are both eligible for App-to-App Task handling.
`message` versus `goal` describes the payload, not whether the caller can await
its result. The App owns each kind's interpretation and acceptance. The installed
catalog lists these input contracts for Apps with Task handling. Human and
explicit Conversation inputs retain their Conversation path. An App request
without Conversation identity uses ordinary Task handling even when its input
kind is also used by a human frontend. Exact Task targeting cannot address a
Conversation executor.

Live `tasks apply`, `TaskAttempt.apply`, workflow `applyTaskChanges`, and final
result declarations use one admission path. Host saves request plus caller
Condition before dispatching `app.input.requested`. The receiver's App mapper
selects a Task; normal scheduling starts that Task's configured agent/workflow.
An explicit `taskId` uses direct Task admission. Inbox recovery retries delivery
from the saved request. A Condition alone does not send work. Live application
returns receipts without ending the attempt; final settlement releases it.
Native Codex currently uses final declarations, without a live May tool bridge.

Within App policy and authority, the worker judges when its selected inputs are
fulfilled. Accepted `converged` marks those requests done and returns their
answer; it needs no second completion state or mandatory independent review.
Unresolved Conditions remain accurate independent facts, not a generic veto of
that decision. Existing result evidence supports later owner reconsideration;
accepted judgment does not guarantee objective correctness.

Only durable submission can establish a request Condition. Invalid requests leave
the caller runnable with diagnostic evidence. A saved receiver admission failure
uses existing feedback and recovery. Progress or a blocker never answers the
request; an accepted result must name the exact original input. A caller waiting
on that result wakes for feedback and interprets it. Without a Condition, receiver
work, failures and results remain durable, but there is no automatic caller wait
or wake. Runtime re-observes exact saved results after restart or lost feedback.

Retained App inputs with no execution or attachment history use this same Task
route. Already attached work keeps its owner. Historical Conversation execution
still requires its existing cutover procedure; source changes do not silently
convert it into new work. The paired May mapping candidate preserves text and context in ordinary Tasks
and requires fulfillment, not acknowledgment. That App-source change is not
merged by this documentation update. Install a compatible App mapper before
enabling the Host's new text-request route.

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

Address constraints and payload subjects have independent meanings. Follow the
[Event matching contract](events.md#subject-and-address-matching) when authoring
selectors; translation receives the same supported event fields after recovery.

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

The raw `AppObserver.run(ObserverContext)` form receives capability-scoped read
and logging ports and returns facts for the Host to publish. The resource form
below receives just a resource and abort signal and returns observed data.
Neither launches agents, accesses inbox or task storage, or mutates runtime state. Legacy watchers migrate to
observers, workflow inputs, or explicit offline maintenance according to their
actual responsibility.

### Task-driven resource observation

Declare a `defineObserver({ id, type, description, intervalMs, timeoutMs,
inspect(resource, { signal }) })` in `AppDefinition.observers`. `inspect` reads
current provider state and returns a plain JSON object. The App owns permitted
resource scope, credentials, validation and field meaning. The Host owns demand
selection, paging, read sharing, source identity, publication and Task wakes.
The returned fields retain their App meaning, including `observedAt` when
present. Only `resource` is reserved: the Host sets it to the requested
reference for Condition correlation. Host timing stays in the event envelope
and inspection health.
The [checked example](../examples/observers.ts) uses a submitted build.

A worker discovers the installed capability through `tasks.contract` or
`read.contract(appId)`. SDK `observationCondition(capability, interest)` builds
an ordinary Condition. Agents can supply `observation` to `tasks.contract` to
get the same ready-to-use Condition. Return it through the existing Task result;
building it alone saves nothing. The helper supplies exact source identity,
generic resource encoding and a one-hour diagnostic review default. It does
not start the provider operation or register a separate watch.

The Host queries existing Condition routes, shares each source/resource read,
and visits four subjects per observer slot. After a committed Task result, it
requests a prompt check of that Task's open interests, including retained ones.
This uses the same read/publication path within the current polling interval;
it adds no public check command. Requests coalesce by source/resource, up to
64 pending subjects per observer, processed four at a time without overlapping
runs. Each batch rechecks current Conditions, so cancelled or satisfied waits
are ignored. A missed notification, overflow or failed read falls back to normal
periodic observation; the queue is disposable, not another authority.

Publication suppression yields to the existing Condition matcher: unchanged
data is published when a current open wait needs it. This covers both new Tasks
and a removed/recreated Condition on the same Task without storing another wait
identity. Removing, satisfying or cancelling demand stops its reads. Closed
Tasks stay closed. Raw observers remain available for unsolicited discovery.

Each read has a cooperative abort/deadline (at most five minutes). Replacement
and shutdown abort in-flight reads and fence late results. Noncooperative I/O
retains its occupied slot across reload, with at most eight unsettled reads per
observer. The Host reports capacity exhaustion rather than multiplying hung
requests. Arbitrary CPU loops cannot be stopped in process. Poll cadence,
paging and provider delays are not a delivery deadline or complete history.

Unchanged observations are suppressed for the most recent 64 resources in each
observer generation. Eviction or reload can republish unchanged data; it does
not by itself resolve an unsatisfied Condition or request a model attempt.
Exact `apps.list {appId}` reads expose the parent runtime's `observerHealth`:
last run start/completion/error and up to 64 recent resource checks, including
last successful check and error. This is disposable runtime evidence; absence
after restart, eviction or unavailable runtime means unknown. Completion of a
batch does not prove that every resource read or downstream delivery succeeded.
Existing failure events retain failures in the journal; no watch-status table
or heartbeat per resource poll is added.

A broken or missing detector leaves the saved wait and its review deadline.
The existing indexed recovery scheduler can make that same Task eligible for
diagnosis without a detector event. The Task owner investigates; Evaluation
can independently review repeated ineffective attempts; an installation's
supervisor coordinates shared repairs. Their judgments are App behavior, not
Host routing policy. Host/process outage needs an external supervisor/operator.
See [recovery responsibilities](system-boundary.md#recovery-uses-evidence-before-repetition).

An App can verify the installed path using an ordinary smoke Task against a
safe known resource. Success requires a saved wait, a durable matching event
and an accepted result from a later owner attempt. A direct detector call or
healthy inspection alone proves less. See the [smoke recipe](../2b-manual/sdk-quickstart.md#smoke-test-the-installed-observation-path).

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
