# Architecture

**Design status:** Accepted.
**Implementation status:** The four responsibilities below are implemented.
Conversation, ordinary work and maintenance share Task execution; the inbox
admits and correlates input. Task activation and recovery work independently
of optional schedules. The [source reading guide](../2b-manual/source-reading-guide.md)
maps these boundaries to current code; source status does not identify deployment.

Read [System Model](system-model.md) for the product vocabulary and a complete
example. This page owns component boundaries, dependencies and code placement.

## Core responsibilities

| Component | Purpose and owned state | Input and output |
| --- | --- | --- |
| App registration and input admission | Keep one validated App generation and its declared routes; validate addressed input and apply the App's pure mapping | Definitions and typed input become published routes and an accepted handling/Task identity, or a rejection |
| Events | Record meaningful input and changes; route admitted events and expose observations | Publication becomes a durable receipt, exact routed work, and passive notifications |
| State and storage | Keep authoritative records and enforce consistent, version-checked changes | Typed reads and atomic operations return canonical state and committed dispositions |
| Work runtime | Run bounded Task attempts, including Conversation Turns; enforce waits, scoped Stop, explicit closure and recovery | Durable input or an identity wake leads to a fenced attempt and accepted outcome; an authorized close prevents further execution |

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

Admission chooses the accountable resource and records input or observations;
Task reconciliation chooses the domain response from current state. Existing
typed writers may complete bounded deterministic updates or authorized controls
directly. Messages, metrics and receipts need no separate reconciler. The
[Event/resource boundary](events.md#resource-responsibility-and-reconciliation)
owns these rules, including recovery before Task creation and passive notifications.

A schedule only produces due input or facts. The work runtime decides when an
eligible Task attempt runs. The executor performs that bounded attempt. A Task
can run from admitted input, a relevant event or recovery with schedules disabled.

## One reconciliation model

The shared runtime uses one Task execution lifecycle:

```text
persist input -> wake exact Task -> read and claim current state
  -> bounded attempt -> commit outcome -> rest or handle eligible pending input

owner closes Task -> prevent new claims and fence late output
```

A Conversation normally executes through one stable Task; each Turn is its
bounded attempt. After terminal closure or cancellation, fresh human input may
create a deterministic linked successor. Exact replay stays with its original
identity, and old system feedback cannot establish a successor. [Message
Lifecycle](message-lifecycle.md#cancelled-conversation-execution-and-successors)
owns those rules. Messages, Topics and Requests remain separate product records,
with no execution lifecycle of their own. An independent assignment gets another
Task and returns its result through the same event loop. No Task per message,
second executing inbox owner or separate conversation supervisor is needed.

An accepted result describes the work considered. It can satisfy a caller while
the Task remains open. The App, parent agent or human decides when to close the
Task; the core enforces that authorized decision. Ordinary Apps can close after
accepting a result by convention. Maintenance and Conversation normally stay
available, with timers used only where useful. This removes `achieve`/`maintain`
from the target lifecycle without asking the core to infer responsibility lifetime.

Core owns one claim, execution, outcome and recovery path. Typed conversation
operations join its settlement transaction when needed; generic Tasks do not
require conversation records. Source and purpose choose human/background
capacity. Stop remains scoped to the current execution; closing its Task has
wider effect. Required child outcomes constrain the work that depends on them,
while unrelated input remains handleable.

The [implementation comparison](../proposals/conversation-input-unification.md#options-and-their-cost)
records why shared scheduling alone was insufficient. The merged implementation
replaced the second execution authority rather than adding a Task around it.
The source map below keeps the existing component homes; the #171 extraction,
integrated in #168, makes the attempt path easier to read without adding another runtime.

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
Conversational turns execute as bounded attempts of the stable Task lineage described above.

One `HostCapacity` limit governs execution with App limits and an interactive
reserve. Pending human Conversation input selects foreground capacity; ordinary
background reviews use the normal lane. Reads and admission need no execution
slot. Durable input ordering remains with the common Task controller. See
[Runtime](runtime.md#capacity) for scheduling detail.

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

The execution boundary keeps three responsibilities separate:

- Core reads the exact claimed input, derives reply requirements and control
  authority, prepares exact Task targets and commits accepted effects.
- Context preparation selects bounded evidence, including current records named
  by a rejected result. It supplies information, never authorization.
- The model adapter consumes the supplied result schema and scoped read/write
  capabilities, then returns a decision. It receives no database or Task store.

`AppInputResolver` is the Host execution contract in `core/tasks/execution.ts`.
Composition binds its Conversation read capability to admitted identity and
connects the context builder and adapter. `TaskConversationRunner` is the
Host composition hook around that adapter; its Host configuration is not passed
through to model execution. Prepared proposals carry only decisions, App/Task
identities, attachments and observed versions. At settlement core resolves the
installed App again and checks current state in the same transaction as the
reply and Request changes. There is no serialized store handle or new registry.

Changing context selection or replacing the model adapter does not change
identity, authority, revision checks or settlement. Changing an App's Task
mapping uses its existing declaration. Changing accepted state rules belongs in
core and requires review of that contract. These are dependency boundaries,
not a guarantee that every feature change touches only one file.

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

In the shared-input implementation, composition maps saved Task links to
system inputs; the same conversation handler handles human messages and those
facts. A scheduled signal performs a bounded pending-follow-up query before
admitting review. Inputs wake the Conversation's execution Task; reuse durable
input and state evidence without a separate execution authority.
No dedicated adapter service, supervisor lifecycle or database is needed.
Generic Task mechanics remain independent of conversational policy. The
[unification review](../proposals/conversation-input-unification.md)
records the code changes and retirement of the former separate consumer.

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
    inbox/                input admission, exact Task attachment and caller results
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
