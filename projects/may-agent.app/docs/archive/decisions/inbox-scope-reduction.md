# Inbox Scope Reduction

**Historical context:** [App Contract](../../2a-design/agent-app.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


**Status:** Accepted and incorporated into the canonical Agent App migration
**Scope:** Keep addressed obligations in the App inbox and route deterministic
task work without manufacturing an inbox request

## Adopted decision

The scope reduction is correct, but it does not require another App declaration
surface. In particular, do **not** add `inbox.accepts`.

The canonical declaration already contains the required routing distinction:

```text
addressed request     -> App subscription/input -> durable inbox item
deterministic outcome -> task subscription      -> persisted TaskIntent + trigger
exact task target     -> exact task wake         -> persisted trigger
stored Condition      -> additive exact wake(s) -> persisted trigger(s)
no obligation         -> observation only
```

Queue coalescing happens only after the inbox item, task intent, or exact task
trigger has been persisted. An in-memory queue is a scheduling optimization,
not a durable work authority.

## Problem

The App inbox answers:

> Which addressed request is this App responsible for completing and, when
> applicable, replying to?

It should not be used merely because a fact may cause an existing desired
outcome to be reconciled. Metric breaches, repository revisions, pipeline
completions, scheduled observations, and other facts often identify their task
deterministically. Sending those facts through the inbox adds an owner claim,
session, disposition, and dependency link without adding judgment or durable
ownership.

The undesirable compatibility flow is:

```text
metric.breach
  -> create inbox item
  -> claim inbox item
  -> ask owner to classify the already-classifiable fact
  -> owner attaches improve/may
  -> wake improve/may
```

The canonical flow is:

```text
metric.breach
  -> match may-agent task subscription
  -> resolve TaskIntent for improve/may
  -> atomically persist desired intent and event-derived trigger
  -> coalesce/enqueue improve/may
  -> reconcile from durable task state
```

No inbox item or owner session is created merely to rediscover the task ID.

## The routing rule

The useful distinction is not whether a synchronous caller is currently
waiting. It is whether the input creates an **addressed completion
obligation**.

| Meaning                                         | Canonical path                          | Durable work authority |
| ----------------------------------------------- | --------------------------------------- | ---------------------- |
| Human or API request addressed to an App        | App input admission                     | Inbox item             |
| Cross-App delegation                            | Child App input admission               | Parent/child items     |
| Event carrying an independent addressed request | `subscriptions[].toInput`               | Inbox item             |
| Event deterministically declaring desired work  | `tasks.subscriptions` + `tasks.resolve` | Task                   |
| Event naming one existing task                  | Exact target wake                       | Existing task          |
| Event matching stored task Conditions           | Exact Condition wake(s)                 | Existing task(s)       |
| Fact with no work obligation                    | Persist/project/observe                 | None                   |

The invariant applies per App obligation. One fact may intentionally be
observed or acted on by several Apps. Within one App, it must not create both a
new inbox obligation and a new or refreshed `TaskIntent` for the same meaning.
Stored Conditions are different: they were declared by already-authoritative
tasks, so their exact wakes are additive rather than competing ownership. One
fact may satisfy zero or more Conditions while it creates an inbox obligation
or refreshes one desired task intent.

The route matrix is therefore:

```text
explicit exact task address
  -> exact target only, including any matching Condition on that task

otherwise, per App
  -> inbox input XOR resolved TaskIntent
  -> plus zero or more matching stored-Condition wakes
  -> if neither selects work, observation only
```

Two inbox subscriptions or an inbox subscription plus a resolved task intent
remain ambiguous and fail admission visibly. A dynamic Condition overlap does
not turn a previously valid App definition into an ambiguous route.

This XOR governs initial event admission. An inbox request may subsequently
attach to a task as its bounded disposition; that preserves the original
request lineage and is not a second route for the source event.

### Addressed inputs

Human input, typed actions, App-to-App delegation, and schedules that create an
independently tracked completion or reply obligation enter the ordinary App
input admission path. They do not need an event-selector opt-in. The mere need
for owner or agent judgment does not select the inbox: judgment performed while
reconciling an already-authoritative task stays with that task.

An event enters the inbox only through an explicit App `subscription` whose
pure translator returns a valid `AppInput`. The inbox then preserves request
identity, ordering, delegation, task attachment, completion, and response
delivery.

`project.owner.requested` is normally such a subscription: it asks an owner to
make a bounded judgment and creates a completion obligation.

### Deterministic task work

An event belongs in `tasks.subscriptions` when pure App policy can derive a
stable desired `TaskIntent`. The host persists the intent and trigger before it
acknowledges durable delivery. The task queue can then collapse repeated wakes
for the same task because the latest desired state and every relevant trigger
remain recoverable.

The resolver is policy, not an executor. It does not run an agent, mutate task
storage, or enqueue work itself.

`resolve(event) === null` means that the matched selector establishes no
deterministic desired-work obligation for this App. A matching stored Condition
may still wake exact work; otherwise the fact is observation-only for this App.
That per-App result does not by itself acknowledge the event globally: another
App route may still apply, and an unaudited event remains visibly unhandled.
Malformed input or resolver failure must throw instead of using `null` to hide
an admission error.

### Exact task wakes

An explicit canonical `(appId, taskId)` **wake address** is already the routing
decision. The host does not invoke `tasks.resolve` for that event. It records the
trigger against the existing exact task and wakes it; it does not create a task
or refresh desired task specification from broad policy. A producer that needs
to declare changed desired work emits an untargeted task-subscription event
instead. A wake address that names an unknown App, an App without task
capability, or a missing task remains pending as a visible admission failure. It
never falls through to a less specific route.

A task ID that merely identifies the subject of a lifecycle fact is not a wake
address. Canonical producers keep subject and correlation identities in event
data and reserve `target.taskId` for delivery. Transitional lifecycle producers
that still use `target.taskId` are explicitly classified as observations; they
must be normalized before the compatibility classifier is deleted.

Legacy project/data fields may be normalized into the canonical target only at
the compatibility boundary. They are not a second public target convention.

### Stored Condition wakes

A stored task Condition is also an exact routing decision made by the task that
created it. Matching is pure preflight; admission records the event-derived
trigger and wakes only the matched task IDs. An event may satisfy Conditions on
several tasks or Apps, but it does not create an inbox request merely to locate
those tasks.

### Observation-only facts

Persistence does not imply work. Lifecycle facts, logs, measurements, and
projections may remain queryable without creating an inbox item or task. A
consumer is added only when an App declares an actual obligation.

Observation-only is a terminal delivery disposition, not an indefinitely
pending delivery. Reviewed exact selectors live in each App's `observations`
contract, never in a namespace fallback or core EventBus catalog. After inbox,
task-intent, exact-target, and Condition routing succeeds, a matching fact with
zero work routes receives a durable `noop` receipt tied to the installed
registry generation. Invalid addressed input, failed exact targets, resolver
errors, and facts without a reviewed observation contract remain visibly
unaccepted.

Event persistence and App/task admission therefore have distinct status: row
existence proves persistence, while the route receipt records admitted work or
reviewed observation-only classification. Application event names stay in App
definitions. This classification is diagnostics, not an App work selector or
durable authority.

## Why not `inbox.accepts`

Adding `inbox.accepts` would create two overlapping selector authorities:

```text
subscriptions             says which events become App inputs
inbox.accepts              would also say which events become App inputs
tasks.subscriptions        says which events become task intents
```

That makes route ownership depend on list subtraction and defaults, permits the
same selector to drift between declarations, and preserves the ambiguity the
canonical migration is intended to delete. It would also be a new compatibility
surface that must later be removed.

The existing declaration is sufficient:

```ts
defineApp({
  id: "gym",
  subscriptions: [
    {
      id: "owner-request",
      event: { type: "project.owner.requested", project: "gym" },
      toInput: ownerRequestInput,
    },
  ],
  tasks: {
    subscriptions: [
      "gym.improvement.requested",
      "gym.regression.requested",
      "gym.incident.detected",
      { type: "metric.breach" },
      { type: "agent.revision.changed", agents: ["may"] },
    ],
    resolve: resolveGymTask,
  },
});
```

## Classification examples

Event names alone do not determine the route. Meaning and correlation do.

| Input                     | Route when...                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `project.comment.created` | Inbox when the human expects owner completion; exact task wake only for an explicit no-reply task control                                     |
| `metric.breach`           | Task subscription when it deterministically changes desired work; observation-only when it is merely telemetry                                |
| Scheduled tick            | Typed App input for an independent periodic obligation; scheduled task event for deterministic desired work; observer schedule for collection |
| Pipeline completion       | Exact wake when correlated to one waiting task; task subscription when it changes a stable desired outcome; otherwise observation             |
| Agent revision change     | Task subscription when it invalidates a known desired state; otherwise observation                                                            |
| System health signal      | Task subscription only when policy derives a durable repair intent; otherwise observation                                                     |

An App must classify a route in its declaration and tests. Runtime owner
fallback is not a classification mechanism.

## Durable admission and coalescing

Successful actionable delivery requires a durable continuation:

```text
persist canonical event
  -> calculate every selected App route
  -> for each App, persist inbox item XOR TaskIntent, plus Condition wake(s)
  -> require every selected durable admission to succeed
  -> acknowledge delivery
  -> enqueue/coalesce execution
```

The admissions need not share one cross-App database transaction. Therefore the
host first persists immutable admission commands for the complete route set
selected by one installed App-registry snapshot. Each command is keyed by
`(eventId, appId)` and contains a versioned payload with the route kind, route
identity, already validated App input or task intent, and exact Condition wakes
needed for replay. It is the durable authority for completing delivery, but not
for doing domain work: the inbox item or task remains the only work authority.

A process-local generation counter is not a durable snapshot identity because
it starts over after restart. Persist a boot-unique snapshot ID together with
the human-readable generation and admission payload version. Replay is
interpreted by stable host-owned admission primitives; it never requires the
old App policy function to remain loaded.

A failure may leave a subset durably admitted; replay completes the remaining
commands idempotently without re-running them through newer App policy. A reload
must not turn a previously selected inbox route into task work, remove an
unadmitted obligation, or add a second route for the same App and source event.
An intentional policy migration may explicitly supersede a still-pending
command, but the supersession and replacement are durable and validated rather
than inferred from the newest manifest. The event is acknowledged only after
every non-superseded command has a durable continuation. Snapshot identity,
generation, payload version, route identity, admission, and supersession remain
visible in diagnostics.

Required properties:

- idempotent replay of one event does not create duplicate inbox items or task
  generations;
- reload after partial admission cannot change the route kind or silently drop
  an obligation selected by the earlier registry generation;
- a crash after persistence but before enqueue is recovered by inbox/task
  scanning;
- coalescing several wakes never erases the latest desired state or the trigger
  evidence needed by reconciliation;
- resolver failure or ambiguous route ownership is visible and is not
  acknowledged as completed admission; and
- a durable route failure cannot be masked by an ordinary subscriber,
  observation fallback, or another App's successful route;
- a missing or mismatched exact target remains pending; and
- task signals never require an owner session merely to choose a task ID.

## Migration

This is a routing audit inside the accepted canonical Agent App migration, not
a new migration phase.

1. For every legacy event path, record its per-App authority classification:
   addressed App input, deterministic task work, exact target, or
   observation-only, plus any additive stored-Condition wakes.
2. During each App migration, move addressed events to `subscriptions` and
   deterministic work to `tasks.subscriptions`; retain explicit task-target
   wakes in the host.
3. Move lifecycle subject/correlation task IDs out of routing targets and into
   event data; delete the transitional lifecycle classification only after all
   producers use canonical target semantics.
4. Persist task intent and trigger before delivery acceptance, then let the
   existing task controller coalesce scheduling.
5. Add route-ownership, idempotency, restart, and negative inbox tests.
6. Replace the hand-maintained observation cutover list with separate
   persisted-versus-routed status. Contracts may declare required delivery,
   but core event persistence does not depend on an application event catalog.
7. Delete legacy `onEvent`, owner-inbox fallback, and any duplicate event
   subscriber after its last route migrates.

Migration progress is gate-based rather than encoded as a lasting App order in
this design. Each App must pass the routing audit before its compatibility
descriptor is removed. In-flight cutovers must complete that audit before they
are committed, even when implementation work has already started.

## Acceptance criteria

- An addressed request produces one inbox item and retains its completion or
  reply path.
- A deterministic task event persists one task intent/trigger and produces no
  inbox item.
- An exact task event wakes only its target and produces no inbox item or broad
  resolver work.
- A stored Condition match wakes only the matched task IDs. It may accompany an
  independently addressed inbox obligation without becoming a second work
  authority.
- A fact matching an installed App `observations` selector receives a terminal
  durable no-op receipt and produces no durable work authority.
- A null resolver result for an unaudited event does not receive a terminal
  receipt merely because no current App selected work.
- One App never derives both an inbox obligation and a new/refreshed task intent
  from the same event, and no App has two matching inbox routes. Additive
  Condition wakes remain allowed.
- Every selected App continuation is durable before composite acknowledgment;
  one route failure remains pending even if another route succeeds.
- A missing or mismatched exact target remains visibly pending and never falls
  through to inbox, broad task resolution, or observation acceptance.
- Replay is idempotent, and restart between persistence and enqueue still
  reconciles the work.
- Partial admission followed by registry reload completes the original durable
  route commands and cannot create inbox/task dual ownership or silently drop a
  selected App obligation.
- Frozen admission records retain a boot-unique snapshot identity and versioned
  payload across process restart; a reused numeric generation cannot be
  mistaken for the selecting snapshot.
- Cross-App delegation, conversation ordering, lease fencing, task Conditions,
  and stale-result rejection remain unchanged.
- No `inbox.accepts` API or compatibility default is introduced.
- Core runtime source contains no growing hand-maintained list of application
  observation event types after closeout.

Inbox-volume and latency changes should be measured after route classification;
selector counts alone are not evidence of actual delivery volume.

## Non-goals

- Changing the inbox lifecycle or disposition vocabulary.
- Replacing the task reconciler or its desired/observed semantics.
- Making the ingress App the inbox for every App.
- Removing the inbox.
- Treating every metric, schedule, or completion event as actionable.

## Relationship to the canonical migration

This proposal makes the event-routing table in
[canonical-agent-app-migration.md](../implementation/canonical-agent-app-migration.md) explicit.
It preserves that proposal's rule that events are facts and wake signals, not a
third work authority. It also sharpens the statement in
[app-owned-runtime-simplification.md](app-owned-runtime-simplification.md): an
explicit App subscription creates addressed inbox work, while a task
subscription or exact target creates task work directly.
