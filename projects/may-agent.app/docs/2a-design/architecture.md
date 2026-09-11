# Architecture

**Design status:** Accepted.
**Implementation status:** The four responsibilities below are implemented at
the [source baseline](../README.md). The source map follows the directory moves
merged in Host #141/#142. The [boundary cleanup](../proposals/authority-boundary-simplification.md#core-policy-cleanup)
tracks subsequent candidate changes separately.
Task activation and startup recovery are independent of optional schedules.
[Open work](../proposals/task-runtime-organization.md) is tracked separately;
this page does not identify the deployed release. The accepted
[unified conversation-input design](../proposals/conversation-input-unification.md)
is pending implementation; current follow-up still uses a separate May Task.
A shared Conversation/Task scheduling controller is now a recommended source
experiment. Resource unification remains a separate alternative, not an
implemented boundary.

The [inbox/Conversation implementation review](../proposals/storage-state-service.md#candidate-review-and-landing-order)
records the state/handler extraction, merged in #129 as `0bedd93a`, and its
actual code map. This updates the source boundary; deployment remains separate.

Read [System Model](system-model.md) for the product vocabulary and a complete
example. This page owns component boundaries, dependencies and code placement.

## Core responsibilities

| Component | Purpose and owned state | Input and output |
| --- | --- | --- |
| App registration and input admission | Keep one validated App generation and its declared routes; validate addressed input and apply the App's pure mapping | Definitions and typed input become published routes and an accepted handling/Task identity, or a rejection |
| Events | Record meaningful input and changes; route admitted events and expose observations | Publication becomes a durable receipt, exact routed work, and passive notifications |
| State and storage | Keep authoritative records and enforce consistent, version-checked changes | Typed reads and atomic operations return canonical state and committed dispositions |
| Work runtime | Coordinate input handling and bounded execution; maintain Task attempts, waits, cancellation and recovery | Admitted work or an identity wake leads to a claimed attempt, accepted progress/result, wait or visible failure |

The boundaries cooperate: admission uses event and state transactions; runtime
uses the stored identities and registered execution contracts. Storage enforces
atomicity, while Apps define meaning and acceptance. No component gets a second
copy of authoritative work state.

Shared timing is core machinery used by runtime waits/recovery and optional
producers. Default failure handling belongs at admission and execution
boundaries: retain evidence, fence stale work, release resources, contain failure,
and expose what needs a decision. Neither needs a new service. Apps and LLMs
judge uncertain diagnosis, repair and scope changes. Existing metrics observe
these facts; reporting cannot veto accepted state or decide Task completion.

## How they work together

```text
Replaceable interfaces / producers
                 |
                 v
       Events + App admission <---- validated App definitions
                 |
        persist accepted identity
                 v
          State and storage <----> Work runtime
                 ^                    |
                 |              bounded attempt
                 |                    v
                 |              selected executor
                 |                    |
                 +---- validate proposed result
                 |
          committed change -> Events -> exact wakes / observers / interfaces
```

This is a flow of responsibility, not a service deployment or an instruction
to wrap every arrow in an event. Events carry meaningful inputs and changes;
local reads, executor invocation and atomic transitions use typed calls.
Event persistence is the Events boundary's use of storage, not another database.

A schedule only produces due input or facts. The work runtime decides when an
eligible Task attempt runs. The executor performs that bounded attempt. A Task
can run from admitted input, a relevant event or recovery with schedules disabled.

## One reconciliation model

Conversation and Task use the same control-loop model:

```text
persist input or change -> wake exact owner -> read and claim current state
  -> perform bounded work -> commit outcome -> rest or reconsider when justified
```

A child result can wake a parent Task just as a delegated Task result can wake
its Conversation. A timer can recover a missed wake. The receiving owner judges
what the evidence means; the event is not automatic completion or retry authority.

The [controller comparison](../proposals/conversation-input-unification.md#options-and-their-cost)
recommends proving one scheduling implementation for both resources. Share
ready-key ordering, capacity waits, wake-during-run and drain behavior. Preserve
resource-specific eligibility, durable claims, Stop/retry rules and settlement
transactions behind narrow reconciliation functions. A shared controller is
Work-runtime machinery, not a fifth core component or a public plugin system.

Current source still has the Task controller and the separate inbox pump. A
shared implementation need not merge their records, create one Task per message,
or serialize all work through one global worker. A maintained Task could also
represent conversation execution, but that larger alternative must demonstrate
per-input Stop, ordered handling and Request closure with less total machinery.
The source map below remains the current layout, not the proposed extraction.

## Composition and lifecycle

`src/app/app-runtime.ts` constructs the Host and wires ordinary modules:

```text
open stores and event admission
  -> load and validate one App/agent generation; publish routes
  -> open ingress and reads; activate selected adapters with owned cleanup
  -> start input handling and isolated Task recovery
  -> start Task controllers after the initial recovery pass settles
```

[Runtime](runtime.md#startup) owns the exact startup sequence and readiness gates.
Composition selects executor adapters and supplies narrow functions to the
runtime. Each expensive Task attempt runs in an isolated worker; the worker
rereads and claims current state, executes, and admits its fenced result.
Worker Events are persisted once and relayed by identity to the parent.
Conversational turns reuse bounded execution without creating a Task.

One `HostCapacity` limit governs execution with App limits and an interactive
reserve. Unified system reviews must use the existing background lane;
source-aware selection is a pending change described in [Runtime](runtime.md#capacity).
Reads and admission need no execution slot. Conversation ordering
belongs to input handling; Task ordering belongs to its controller.

Reload publishes one validated definition generation. A rejected reload retains
the previous generation; running attempts keep their captured definitions.
Activation and Host deployment are separate operations. See
[Runtime](runtime.md) and [Operations and Recovery](../2b-manual/app-operations-recovery.md).

## Conversation core and capability boundary

Classify the guarantee, not the whole feature or its current folder. Conversation
uses the existing four core responsibilities; it is not a fifth core component.

| Core guarantee | Replaceable capability using it |
| --- | --- |
| Durable input admission, ordering, claims and caller correlation | The selected handler for conversational input |
| Bounded execution, cancellation and failure containment | The agent/model, tools and conversational prompt |
| Conversation/Request/Topic reads and consistent writes in State and storage | Context selection, Topic choice and presentation |
| Version-checked Request acceptance/closure with evidence and exact Task links | May's judgment of scope, fulfillment, repair and stopping |
| Task execution and declared event routing | Linked Task facts routed to the selected conversation handler; May judges the response |

Core owns the stored fact that an ask is open and rejects a stale closure; May
judges whether the ask has been addressed. State operations validate a proposed
decision without reading chat text to infer intent or calling a model.

Without a conversational frontend, new chat handling is unavailable but unrelated
Tasks and Events continue. Retained messages, Requests and Task links remain
readable; open asks do not silently disappear or close. Removing the Task-event
route makes automatic follow-through unavailable while preserving Task
correctness and the stored obligation.
Restoring a compatible capability can use the same state. Supported removal may
require draining active work; arbitrary live unloading is not a requirement.

Conversation-specific records and links are used only when present. Generic Task
admission must not require a Conversation, Topic or Request. A required store
failure remains a failure; optional capability does not mean optional integrity.

The frontend may live in the same Host process and repository while remaining
outside the stable core. Composition selects it through a narrow input-handler
contract; core storage imports neither that frontend nor May policy. The
[storage contract](storage.md#conversation-state-api) owns the small local API,
and [Message Lifecycle](message-lifecycle.md) owns interactive behavior.

In the accepted shared-input design, composition maps saved Task links to
system inputs; the same conversation handler handles human messages and those
facts. A scheduled signal performs a bounded pending-follow-up query before
admitting review. Reuse the existing inbox and state operations; no dedicated
adapter service, supervisor lifecycle or database is needed. Task controllers
remain independent of Conversation. The [unification review](../proposals/conversation-input-unification.md)
records the code changes and retirement of the current separate consumer.

## Behavior when a capability is absent

Start with deliberate absence at startup and the supported reload behavior.
Arbitrary live unloading is not required. Timers, subscriptions and in-flight
resources must have an owner and cleanup path.

| Missing capability | Permitted degradation | What stays correct |
| --- | --- | --- |
| Interface | That access channel is unavailable | Other channels, Tasks and accepted results remain independent of delivery |
| Report or dashboard | Its extra presentation/analysis is unavailable | Canonical reads and execution remain available |
| Metric collection | Measurement is stale or unknown | Failure evidence remains; missing data is not healthy; settlement is unaffected |
| Optional schedules | No new timed input from those registrations | Submitted/event-woken Tasks and required recovery/review timing still run |
| Observer | Its external facts are not discovered | Waits stay unsatisfied until actual evidence arrives; unrelated work proceeds |
| Selected executor | Affected work cannot execute | Exact Task/evidence remain in visible attention; no false completion, silent substitution or retry storm |
| App | New work for its responsibility is unavailable | Reject newly addressed input; preserve existing obligations and identities |
| Conversation handler or its Task-event route | Chat handling or automatic follow-through is unavailable | Retained asks and links remain visible; unrelated Tasks continue; no false closure |
| Optional conversation review schedule | Missed-event follow-up may wait for another relevant input | Normal event-driven responses and required Task/inbox recovery continue; no false closure |

App removal is currently rejected while unfinished Tasks exist. Drain those
obligations before removal; this contract does not authorize discarding them.
A fact may validly have no subscriber. Promised work requires a successful
admission route. Missing optional capability does not make a corrupt required
configuration or unavailable authoritative store an acceptable silent skip.

## Code organization

Paths are relative to `projects/may-agent`. This map follows the directory-layout
merge [#141](https://github.com/hao1939/may-agent/pull/141) (`48254267`) and
the adapter merge [#142](https://github.com/hao1939/may-agent/pull/142) (`427d4ea1`).
The moves preserve existing transitions and transaction boundaries;
its review and validation are tracked in the
[simplification proposal](../proposals/authority-boundary-simplification.md#directory-organization-for-code-review).

```text
src/app/
  core/
    apps/                 validated registry and generations
    events/               publication, admission and observation
    inbox/                generic input claims, ordering, Stop and handler contract
    state/                durable stores and atomic Task/Conversation/Request operations
    tasks/                Task runtime, transitions, controller and recovery
    scheduling/           shared capacity and timer mechanics
    reads/                canonical Task/request/result reads
  adapters/
    discovery/            conventional App source loading
    executors/            agent, workflow and native backends
      codex/              Codex goal client, packet, progress and result handling
    producers/            App schedule and observer production
    workspaces/           worktree backends
    maintenance/          named, bounded Host maintenance
    reporting/            optional projections
  composition/            inbox orchestration, capability selection and cleanup
    workers/              concrete admission, attempt and recovery process entry points
  app-runtime.ts          main composition, reload and shutdown
  conversations/         replaceable context, turn handler and agent integration
  transport/, http/      existing interface adapter homes
src/lib/db/              shared schema and transaction primitives

packages/sdk/            public App/Task/executor contracts
packages/control/        client protocol
packages/terminal/       Console client
packages/webui/          browser client
projects/<id>.app/       App-owned policy, agents and workflows (workspace)
```

The [storage proposal](../proposals/storage-state-service.md#code-organization)
owns meaningful operations in `core/state/`; it does not require a separate API
server. Task snapshot/mutation helpers stay beside the Task runtime; canonical
SQLite persistence lives in `core/state/app-task-resource-store.ts`.
Its [conversation slice](../proposals/storage-state-service.md#conversation-state-and-handler-extraction)
landed in #129 and separates core state operations from replaceable frontend
handling. ESLint prevents core imports of concrete conversational handlers.

| Caller | Dependency rule |
| --- | --- |
| Core | Depends on core modules, foundational libraries and contract types; concrete implementations are supplied by composition |
| Adapter | Uses existing public contracts and narrowly supplied capabilities; does not own private Task stores or queues |
| Composition | Imports both sides and wires them; contains no domain decisions or duplicate transition logic |
| App | Imports the SDK and its own domain modules; never Host-private implementation |

Composition supplies the same conversational App identity to event admission
and inbox dispatch. Core enforces durable input handling without naming May.
Executors share persisted session identities through the small session-binding
contract; importing a lifecycle type does not grant state mutation authority.

Put an extension beside its existing capability family, use its typed contract,
and attach it through composition or an App declaration. Keep activation and
cleanup there; importing a module must not start timers or processes. App-owned
observers, schedules and policies stay in the App. Existing interface packages
need no move just to acquire an `adapters/` label.

Move a module and its tests when that move clarifies a verified dependency
boundary. Avoid empty directories, forwarding wrappers, a service locator or
a universal plugin base. Use [Host/App Boundary](system-boundary.md) for detailed
ownership rules and the [core review plan](../proposals/task-runtime-organization.md)
for the remaining work.
