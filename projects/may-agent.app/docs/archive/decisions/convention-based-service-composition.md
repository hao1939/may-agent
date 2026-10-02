# Convention-Based Service Composition

**Historical context:** [Host And App Boundary](../../2a-design/system-boundary.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Accepted and incorporated; archived decision
**Decision date:** 2026-08-15
**Scope:** How runtime modules and App-owned capabilities compose after the
canonical Agent App migration

## Decision

Keep the canonical Agent App design as the only application composition and
loading boundary:

```text
projects/<id>.app/app.ts
  -> one defineApp declaration
  -> one validated App registry generation
  -> one host attaches inbox, routes, schedules, observers, and optional tasks
```

Do **not** add automatic `projects/*/services/*.ts` discovery, `defineService`,
string-keyed `provides`/`inject`, a process-wide App service locator, or partial
service-subgraph reload.

The useful part of the original service-composition idea applies inside the
host:

1. runtime modules receive explicit typed dependencies;
2. long-lived registrations return teardown owned by the complete App/runtime
   generation; and
3. factories can be tested with narrow fake ports.

This is ordinary TypeScript composition behind the runtime boundary, not a new
SDK feature or App extension mechanism.

## Why the original proposal was attractive

The underlying concern is valid. A large runtime becomes difficult to change
when modules import concrete global implementations, registration teardown is
scattered, or tests require the whole process. Explicit dependencies and
reversible effects make lifecycle ownership easier to see and test.

The original draft proposed a file-convention plugin system:

```text
projects/<app>/services/<name>.ts
  -> provides/inject graph
  -> service loader
  -> create/dispose lifecycle
```

That is compact in isolation, but it is the wrong boundary for may-agent.

## What changed during the canonical migration

Several premises in the original draft no longer describe the implementation:

- `@may-agent/sdk` is now an authoring-contract package. It exports schemas,
  pure policy types, bounded contexts, and test helpers—not database, queue,
  scheduler, inbox, or task implementations.
- App task persistence, reconciliation, queues, recovery, workspaces, and
  projections are host-private runtime modules.
- App workflows already receive capability-scoped contexts and can be unit
  tested with SDK test contexts.
- one prospective App registry generation owns definitions, subscriptions,
  schedules, observers, and task controllers atomically.
- cross-App durable work already has a typed, recoverable protocol: App
  delegation and correlated results.

The remaining runtime modularity problem is therefore internal code structure,
not missing application-level service discovery.

## Why not adopt convention services

### It creates a second loader and registry

File-path discovery is still registration, and `provides`/`inject` still form a
registry. A second discovery graph beside `app.ts` would let one App generation
and one service generation disagree during startup or reload. The canonical
migration explicitly removes that split.

### It bypasses durable App ownership

If Evaluation calls a Gym `benchmarks` service directly, the call has no App
inbox identity, parent dependency, delivery/result record, retry fence, or
restart recovery. A synchronous library call is appropriate only inside one
owner's bounded execution. Work crossing an App boundary uses typed delegation;
shared facts use events.

### It widens authority through a service locator

Globally injectable `db`, `events`, `agents`, `inbox`, or `tasks` values expose
mechanics that Apps are intentionally denied. The current contexts grant the
narrow semantic operation needed by a workflow or observer. Capability growth
must not turn into generic runtime access under a different name.

### String keys are a weak contract

Global names need ownership, versioning, schema validation, collision policy,
security scope, and compatibility rules. TypeScript interface imports alone do
not validate a dynamically loaded value at runtime. The complexity omitted
from the minimal API would return as loader and operational policy.

### Partial reload violates the atomic-generation rule

Creating only a changed dependency subgraph can leave routes, schedules,
controllers, and active executions observing different generations. Service
`create()` may also register effects before the candidate is known to be
publishable. May-agent reload instead prepares and validates one complete
candidate, publishes it atomically, and tears down the superseded attachments
under generation ownership.

### Runtime and App modules have different trust boundaries

Host database/delivery/recovery modules and App domain code are not the same
kind of plugin. Giving them one loader makes the abstraction look uniform while
hiding the most important distinction: infrastructure preserves and executes;
Apps own meaning and desired outcomes.

## Selected composition model

### App composition

An App has one conventional entry point: `app.ts`. It may import ordinary
App-local TypeScript modules for schemas, pure policy, observers, workflows,
and domain calculations. Those imports have no autonomous lifecycle merely
because of their file location.

Apps extend behavior through the existing `defineApp` contract:

- typed inputs and pure routing;
- subscriptions that translate facts into correlated App requests;
- task subscriptions and exact wakes;
- schedules and bounded observers;
- typed actions;
- App-owned workflows; and
- the optional host-private task capability.

### Cross-App composition

Use the boundary that matches the interaction:

| Need                                             | Mechanism                                     |
| ------------------------------------------------ | --------------------------------------------- |
| Another App must decide, act, or return a result | Typed App delegation                          |
| Another App observes a changed fact              | Event subscription                            |
| Code is pure and genuinely shared                | Normal shared package/module import           |
| One App needs private domain logic               | App-local module import                       |
| A workflow needs a new host operation/read       | Narrow typed context capability or projection |

No App imports another App's implementation or consumes a live object exported
by another App.

### Runtime composition

Runtime modules may be split behind host-private typed ports and wired by an
explicit composition root. Prefer constructor/factory arguments over imports
of mutable globals. This wiring is visible code, so startup order, ownership,
and failure behavior remain reviewable without a dynamic service locator.

Long-lived effects must first be classified by owner:

- process-scoped adapters attach once and read the current immutable registry
  snapshot; and
- generation-scoped effects, if any, belong to exactly one registry generation.

Generation-scoped runtime attachments should follow one lifecycle contract:

```ts
type RuntimeAttachment = {
  dispose(): void | Promise<void>;
};
```

Candidate preparation must remain side-effect-free or stage effects behind an
unpublished attachment. After the complete candidate validates, the host
publishes one generation and activates its attachments. Shutdown or successful
replacement disposes attachments in reverse ownership order. A failed
candidate leaves the current generation untouched.

A process-scoped adapter is not recreated merely because its selected App
definitions change. For example, canonical App event routing uses one durable
bus subscription, App schedules use one inbox scan loop, and observers replace
their fenced state behind that loop. Reload changes the snapshot and schedule
or observer state; it must not increase bus-listener or timer cardinality.

This borrows the reversible-effect insight without exposing `effect()` to App
code or permitting independently reloadable service graphs.

## Extension rule

When new behavior is needed, decide in this order:

1. If it is pure domain behavior, add an App-local or shared pure module.
2. If it is bounded App execution, add a workflow, observer, action, schedule,
   or task policy under `defineApp`.
3. If another App owns the outcome, delegate to that App.
4. If it is a fact, publish it and declare an explicit subscription or wake.
5. If an App cannot express a legitimate responsibility, add the narrowest
   typed SDK capability/projection and keep its implementation host-private.
6. If the problem is only runtime coupling, extract a host-private port and
   wire it in the existing composition root.

Do not solve an application requirement by introducing a generic service
locator, raw store access, or a second autonomous loading convention.

## Migration impact

This decision refines, but does not expand, the canonical Agent App migration:

- keep `app.ts` as the sole App definition/discovery surface;
- keep the SDK small and implementation-free;
- keep task reconciliation an internal App capability;
- keep cross-App outcomes on durable delegation;
- make complete registry-generation teardown explicit and testable; and
- allow later runtime module extraction only when it preserves the same
  authority and atomic reload boundaries.

Moving every runtime subsystem into `src/services/*.ts` is not a migration gate.
No compatibility `legacy` entry point or service shim is introduced.

## Acceptance criteria

- There is one App loader and one atomic App registry generation.
- The public SDK exports no `defineService`, service locator, generic `inject`,
  or host implementation.
- Apps do not discover or publish live cross-App service objects.
- Cross-App work uses correlated App delegation; facts use declared routes.
- New App capabilities remain narrow, typed, scoped, and testable.
- Runtime subsystem extraction keeps interfaces host-private and preserves
  startup, shutdown, restart, recovery, and atomic reload behavior.
- Every long-lived effect has an explicit process or generation owner.
- Repeated successful and failed reloads do not increase subscriber or timer
  cardinality, and late results from a superseded observer generation are
  discarded.
- Every genuinely generation-owned registration has deterministic teardown.
- Accepted architecture, runtime, SDK, and Agent App documents describe this
  same composition boundary.

## Relationship to other decisions

- **Canonical Agent App migration:** this decision strengthens its single
  loader/registry requirement and prevents a service layer from recreating the
  removed parallel model.
- **Inbox scope reduction:** addressed outcomes remain in App inboxes; services
  cannot become another work authority.
- **App-owned runtime simplification:** capability-scoped contexts and
  host-private mechanics remain the selected boundary. Internal ports may make
  that host cleaner without becoming public App services.

## Review Comments

### Round 1 (2026-08-15, original proposal author)

The decision is correct. I accept it. Four points of agreement, two
follow-up actions, and one boundary note.

**Agreement with the pushback:**

1. A second loader beside `app.ts` creates a second consistency domain. The
   atomic-generation model (one snapshot, validate together, publish or reject
   as a unit) is simpler and eliminates the class of bugs where a service
   graph and an App graph disagree mid-reload. I underestimated this cost.

2. Cross-app service calls bypass durable ownership. If evaluation.app calls
   gym's benchmark runner directly, the call has no inbox identity, no
   parent link, no retry fence, and no restart recovery. The delegation
   protocol exists to make cross-app work survivable. Direct service
   consumption would reintroduce exactly the "who owns this work?" ambiguity
   the inbox migration removed.

3. String-keyed `provides`/`inject` trades compile-time type checking for
   runtime discovery. For four apps owned by one team, that is the wrong
   direction. TypeScript imports already give you the contracts; adding a
   dynamic resolution layer on top weakens them without adding value at this
   scale.

4. "Runtime and App are the same kind of thing" was the wrong framing.
   Infrastructure must be correct for the system to function. App domain
   logic can be wrong without crashing the host. Treating them as peers in
   one loader hides the most important trust distinction in the architecture.

**Two concrete follow-up actions the decision enables:**

**1. Apply `RuntimeAttachment` to the leaking subsystems now.** The decision
defines `{ dispose(): void | Promise<void> }` for generation-owned
registrations and says candidate preparation must be side-effect-free. This
is the disposable effect insight correctly scoped to the host. The event bus
subscriptions and cron registrations are the two subsystems that currently
leak effects across `/reload` — they register during candidate preparation
and are not torn down when a generation is superseded. Wrapping them behind
`RuntimeAttachment` and disposing on generation replacement closes the gap.
This is internal host work, not a new public API.

**2. Extract one host-private port as a proving example.** The metrics
subsystem is the cleanest candidate: self-contained, no downstream dependents
in the App graph, already created via a `createMetricService()` factory. Make
it receive its DB dependency as an explicit constructor argument rather than
importing the global, verify it can be tested with a fake DB, and document
the pattern. That proves the internal composition model works without any new
SDK surface.

**Boundary note for the record:**

This decision is correct at the current scale: one team, four apps, one
process. If may-agent ever grows beyond its own team's apps — third-party
integrations, community extensions, multi-tenant hosting — the composition
question reopens, because trust boundaries multiply and `app.ts` alone
cannot express isolation, capability restriction, or independent versioning
across untrusted parties. The Cordis insight about reversible effects and
declared dependencies remains sound engineering; this decision correctly says
the place to apply it is inside the host, not as a public App contract. That
boundary should be revisited only when external evidence shows that
delegation and events no longer cover a real cross-party composition need.

### Maintainer disposition

The review agrees with the selected boundary and does not change the decision.
Its lifecycle principle and evidence threshold are accepted, with two factual
corrections to the proposed follow-up work.

The claimed App event-subscription and cron-registration leak is not present in
the canonical implementation. `startAppInboxRuntime` installs one
process-scoped durable event route and closes it only with the runtime. Reload
replaces the definitions read by that route. App schedules are evaluated by
the same process-scoped scan interval, while `refreshScheduleActivations`
replaces their activation state. App observers similarly replace fenced state
and drop late results from superseded generations. Legacy agent `Cron`
instances also guard `subscribeToBus` so a particular instance subscribes only
once; those agent triggers are not App-generation attachments.

Consequently, wrapping these paths in newly allocated per-generation
`RuntimeAttachment` objects would add lifecycle machinery without fixing the
reported problem. The migration instead requires reload tests that prove
listener and timer cardinality remain stable, old observer results stay
fenced, and failed candidates leave the active snapshot unchanged. If a future
runtime module really creates a generation-specific effect, it must return a
generation-owned attachment and deterministic teardown.

The proposed metrics extraction is also already substantially present:
`createMetricService` receives `getDb` through `MetricServiceOptions`; it does
not import the process-global database accessor. Its SQL-heavy behavior is
tested against an isolated temporary SQLite database. Introducing a fake SQL
facade solely as a demonstration is not a migration gate. A narrower semantic
port should be extracted later only where it reduces real coupling or makes a
specific failure path materially easier to test.

The boundary note is accepted. Public plugin composition may be reconsidered
only with evidence of third-party or multi-tenant isolation, independent
versioning, or a cross-party composition need not met by delegation, events,
and normal packages. Scale alone is not sufficient evidence.

### Implementation follow-up

A later full-suite run found a real instance of the lifecycle problem, but in
the host-private App task controllers rather than App event routes or cron
registrations. A controller installed for one test/runtime generation retained
its resync timer and could begin reconciliation after its fixture had been
removed. On reload, a replacement controller could also start while work from
the superseded controller still owned the task-state lock.

The runtime now gives this subsystem explicit host lifecycle ownership:

- closing the App task capability closes the installed controller generation;
- teardown can await already-running reconciliation before removing its state;
- a replacement controller may queue work immediately but cannot claim it
  until the superseded generation drains; and
- daemon shutdown closes this capability together with the App watcher and
  inbox runtime.

This validates the proposal's narrow `RuntimeAttachment` principle without
changing its public composition decision. It is also the preferred proving
example: lifecycle machinery is added where observed ownership evidence
requires it, while process-scoped event/schedule adapters remain singletons.

### Bounded task-observation follow-up

The App migration later found a separate boundary leak: focus, stall, and AKS
frontier workflows still read host-private task JSON to observe sibling work.
Direct children and completion receipts remain the canonical decomposition
surface. For the narrower App-wide health question, the host now supplies a
64-entry live-task snapshot that excludes the reviewing task and reports
truncation. It carries only typed status, category, readiness, Condition, and
bounded attempt facts.

This is a narrow projection under the existing extension rule, not a service
locator or global task-query API. It prevents both false terminal judgments and
self-observation loops while keeping task persistence, queues, leases, and
mutation authority host-private.
