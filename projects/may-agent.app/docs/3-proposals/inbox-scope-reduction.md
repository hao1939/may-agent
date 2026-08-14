# Inbox Scope Reduction

**Status:** Draft refinement of the accepted canonical Agent App migration
**Scope:** Keep addressed obligations in the App inbox and route deterministic
task work without manufacturing an inbox request

## Decision under review

The scope reduction is correct, but it does not require another App declaration
surface. In particular, do **not** add `inbox.accepts`.

The canonical declaration already contains the required routing distinction:

```text
addressed request     -> App subscription/input -> durable inbox item
deterministic outcome -> task subscription      -> persisted TaskIntent + trigger
exact task target     -> exact task wake         -> persisted trigger
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

| Meaning | Canonical path | Durable authority |
| --- | --- | --- |
| Human or API request addressed to an App | App input admission | Inbox item |
| Cross-App delegation | Child App input admission | Parent/child inbox items |
| Event requiring owner judgment or a response | `subscriptions[].toInput` | Inbox item |
| Event deterministically declaring desired work | `tasks.subscriptions` + `tasks.resolve` | Task intent and trigger |
| Event naming one existing task | Exact target wake | Task trigger |
| Fact with no work obligation | Persist/project/observe | Event or read model only |

The invariant applies per App obligation. One fact may intentionally be
observed by several Apps, but one App must not turn the same fact into both an
inbox item and a task intent.

### Addressed inputs

Human input, typed actions, App-to-App delegation, and schedules whose purpose
is owner judgment enter the ordinary App input admission path. They do not need
an event-selector opt-in.

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

### Exact task wakes

An explicit task target is already the routing decision. The host records the
trigger against that exact task and wakes it; broad task resolution and inbox
translation must not synthesize unrelated work from the same event.

### Observation-only facts

Persistence does not imply work. Lifecycle facts, logs, measurements, and
projections may remain queryable without creating an inbox item or task. A
consumer is added only when an App declares an actual obligation.

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

| Input | Route when... |
| --- | --- |
| `project.comment.created` | Inbox when the human expects owner completion; exact task wake only for an explicit no-reply task control |
| `metric.breach` | Task subscription when it deterministically changes desired work; observation-only when it is merely telemetry |
| Scheduled tick | Typed App input for periodic judgment; scheduled task event for deterministic desired work; observer schedule for collection |
| Pipeline completion | Exact wake when correlated to one waiting task; task subscription when it changes a stable desired outcome; otherwise observation |
| Agent revision change | Task subscription when it invalidates a known desired state; otherwise observation |
| System health signal | Task subscription only when policy derives a durable repair intent; otherwise observation |

An App must classify a route in its declaration and tests. Runtime owner
fallback is not a classification mechanism.

## Durable admission and coalescing

Successful actionable delivery requires a durable continuation:

```text
persist canonical event
  -> classify one App route
  -> persist inbox item OR task intent/trigger
  -> acknowledge delivery
  -> enqueue/coalesce execution
```

Required properties:

- idempotent replay of one event does not create duplicate inbox items or task
  generations;
- a crash after persistence but before enqueue is recovered by inbox/task
  scanning;
- coalescing several wakes never erases the latest desired state or the trigger
  evidence needed by reconciliation;
- resolver failure or ambiguous route ownership is visible and is not
  acknowledged as completed admission; and
- task signals never require an owner session merely to choose a task ID.

## Migration

This is a routing audit inside the accepted canonical Agent App migration, not
a new migration phase.

1. For every legacy event path, record exactly one classification: addressed
   App input, deterministic task intent, exact task wake, or observation-only.
2. During each App migration, move addressed events to `subscriptions` and
   deterministic work to `tasks.subscriptions`; retain explicit task-target
   wakes in the host.
3. Persist task intent and trigger before delivery acceptance, then let the
   existing task controller coalesce scheduling.
4. Add route-ownership, idempotency, restart, and negative inbox tests.
5. Delete legacy `onEvent`, owner-inbox fallback, and any duplicate event
   subscriber after its last route migrates.

The current migration order remains Evaluation, May/platform, and then AKS RP
E2E. Each App must pass the routing audit before its compatibility descriptor is
removed.

## Acceptance criteria

- An addressed request produces one inbox item and retains its completion or
  reply path.
- A deterministic task event persists one task intent/trigger and produces no
  inbox item.
- An exact task event wakes only its target and produces no inbox item or broad
  resolver work.
- An observation-only event produces no durable work authority.
- One App never claims the same event through both inbox and task routes.
- Replay is idempotent, and restart between persistence and enqueue still
  reconciles the work.
- Cross-App delegation, conversation ordering, lease fencing, task Conditions,
  and stale-result rejection remain unchanged.
- No `inbox.accepts` API or compatibility default is introduced.

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
[canonical-agent-app-migration.md](canonical-agent-app-migration.md) explicit.
It preserves that proposal's rule that events are facts and wake signals, not a
third work authority. It also sharpens the statement in
[app-owned-runtime-simplification.md](app-owned-runtime-simplification.md): an
explicit App subscription creates addressed inbox work, while a task
subscription or exact target creates task work directly.
