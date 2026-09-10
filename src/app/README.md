# Host code boundaries

The Host contains both stable mechanics and replaceable implementations.
"External" means outside the core, not necessarily another package or process.

The governing design lives in the sibling App tree, not this navigation guide:

- [Core Principles — Apps own meaning; the Host owns mechanics](../../../may-agent.app/docs/1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics)
  assigns validation, persistence, scheduling, and recovery to the Host.
- [Core Principles — Convention over configuration](../../../may-agent.app/docs/1-principles/core-principles.md#convention-over-configuration)
  requires “one `app.ts`, one `defineApp`, and one atomic App generation.”
- [System Boundary — Host](../../../may-agent.app/docs/2a-design/system-boundary.md#host)
  says “Reload either publishes a complete replacement or keeps the previous
  definition active.” [Extension rule](../../../may-agent.app/docs/2a-design/system-boundary.md#extension-rule)
  keeps stable mechanics in the Host and policy in the App.
- [Core proposal — Step 2](../../../may-agent.app/docs/proposals/task-runtime-organization.md#step-2-separate-app-source-discovery-from-core-registration)
  applies these accepted rules to discovery and registration. The following
  guide maps this checkout's source; merge and deployment status remain
  separate facts recorded in the proposal and release evidence.

These links require the sibling `may-agent.app` design tree. A standalone Host
checkout does not contain it; request the cited sections when reviewing a
behavior change rather than treating this guide as replacement design.

| Home | Responsibility | Current entrypoint |
| --- | --- | --- |
| `core/` | Identity, authority, and recovery rules shared by every capability | `apps/` registration, `events/` admission/observation, `reads/` canonical reads, `tasks/` controller, queue and execution/recovery contracts, `scheduling/` owned timing |
| `adapters/` | Concrete capability implementations | `discovery/`, `executors/`, `workspaces/`, `producers/`, `maintenance/`, `reporting/` |
| `composition/` | Select implementations and wire process startup/lifecycle | `background-startup.ts`, `task-execution.ts`, `maintenance.ts`, `maintenance-activation.ts`, `reporting.ts` |

`app-runtime.ts` remains the main composition root. Transaction-critical Task
stores/reconciliation and request admission retain their existing flat files;
the navigation below identifies their ownership. Transports remain in
`transport/`, HTTP in `http/`. The proposal separates demonstrated responsibilities,
not every file or an entire runtime-instance rewrite.

Core depends on contracts and foundational utilities, not concrete adapters.
Composition may import both sides. Adapters receive the narrow capabilities
they need; they do not become another Task state or recovery authority.
ESLint rejects imports from `core/` (and the still-flat Task runtime) into
`adapters/` or `composition/`. Boundary tests may wire both sides. Keep new
contracts next to their core owner; do not expose Host internals through the SDK.

Loading prepares definitions and handlers without activating producers.
`app-runtime.ts` activates the prepared generation after ingress opens and each
replacement during reload. Process role selects background ownership; `--cron`
selects optional timers. There is no separate loader activation setting.

To extend a supported capability:

1. Read its existing SDK/control or Host-private contract.
2. Add a focused implementation and colocated tests in its capability family.
3. Register it explicitly in composition, including activation and cleanup.
4. Test behavior when it fails or is absent; leave core correctness rules alone.

### Extension starting points

Paths are relative to this directory unless a package is named. Start with one
existing implementation; register it with an ordinary import, not a manifest.

| Capability | Contract | Example and wiring | Boundary proof |
| --- | --- | --- | --- |
| App discovery | `core/apps/registry.ts`: `AppDefinitionSource` | `adapters/discovery/app-definitions.ts`; `app-runtime.ts` | `core/apps/registry.test.ts`: failed reload retains the accepted generation |
| Named executor | SDK `TaskExecutor` / `TaskAttempt` | `codex-goal-executor.ts`; executor map in `daemon-agents.ts` | `app-task-runtime.test.ts`: missing executor stays visible, other work runs |
| Built-in agent/workflow/session backend | `core/tasks/execution.ts` | `adapters/executors/`; `composition/task-execution.ts` | `app-task-runtime.test.ts`: removal, restoration and exact attempt fencing |
| Task worktree | `core/tasks/workspace.ts` | `adapters/workspaces/git.ts`; `composition/task-execution.ts` | `adapters/workspaces/git.test.ts` plus workspace admission tests in `app-task-runtime.test.ts` |
| App schedule | SDK schedule declarations; `core/scheduling/timer.ts` mechanics | `adapters/producers/app-schedules.ts`; `app-inbox-runtime.ts` | `adapters/producers/app-schedules.test.ts`: publication failure and reload |
| Optional reports | `core/reads/reporting.ts` | `adapters/reporting/`; `composition/reporting.ts` | `composition/reporting.test.ts`: unavailable/failing reports do not reject App publication |

For deterministic Host maintenance, follow the existing
[maintenance guide](adapters/maintenance/README.md), including activation and
shutdown. These families have different contracts; they do not need a universal
adapter interface.

App-owned policy, observers, and schedules stay in the owning App declaration.
Public App contracts live in `packages/sdk`; client contracts in
`packages/control`. Do not add a plugin loader, a second manifest, or a universal
component interface. Add subdirectories as real boundaries are separated, not
as empty placeholders.

## Supported events and diagnostics

`core/events/bus.ts` owns synchronous persistence/admission followed by independent
bounded passive observation. `core/events/interface.ts` validates ingress and
exposes diagnostic reads/streams. Its ingress allowlist does not select outbound
events. See the [control guide](../../packages/control/README.md) for supported
Task/Conversation wake-and-reread semantics.

Consumers were traced across control socket, console/Telegram, inbox recovery,
metric source measurement, event graph and health queries. Existing profiling and
handler-health diagnostics remain. A stale `project.task.reconciled` observation
does not mean an accepted completion; control emits only the exact Task identity.
Async subscriber returns pass back to the existing bus so ordering and error
containment work. No new event family or routing registry is introduced.

The retired standalone heartbeat trigger, HTTP action and UI buttons are removed
together. Historical heartbeat evidence remains readable. App work uses declared
input/schedules and fenced Task controls, not an unhandled “triggered” response.

## Shared timing mechanics

`core/scheduling/timer.ts` owns timer replacement, cancellation, and shutdown.
It dispatches private callbacks and contains synchronous failures; it does not
accept work, publish events, or decide whether a slot succeeded. Asynchronous
callbacks retain their own rejection handling. Sharing these mechanics does
not require one physical timer or a scheduler registry.

`adapters/producers/app-schedules.ts` interprets App schedule declarations:
input slots publish ordinary `app.input.requested` events; fact slots publish
record-only events. It retains the existing latest/none catch-up and successful
publication checks. Reload keeps unchanged slots and restores the exact previous
activation records if publication is rejected. It never runs a model.

`app-inbox-runtime.ts` composes independent schedule, observer, and request
recovery cadence after startup readiness. A failed request read cannot prevent
schedule/observer dispatch. `app-task-recovery.ts` uses the same timer mechanics
for its indexed nearest-due and bounded safety passes. Each owner closes its
registrations; disabling App schedules does not stop observers or recovery.

See [Scheduling and Observation](../../../may-agent.app/docs/2a-design/cron.md)
and [Shared timing, intentional events](../../../may-agent.app/docs/proposals/task-runtime-organization.md#shared-timing-intentional-events).
Host maintenance uses those same timer mechanics. See the private
[maintenance guide](adapters/maintenance/README.md) for preparation, activation,
failure behavior, and the retired standalone-work boundary.

## App discovery and registration

`adapters/discovery/app-definitions.ts` supplies a deferred file source. It scans
`projects/<name>.app/app.ts` (or `app.js`), refreshes imported code when invoked,
and preserves canonical App directories when loading a source release.

`core/apps/registry.ts` accepts that source as a typed function:

```ts
const registry = new AppRegistry(discoverAppDefinitions(sourceRoot, canonicalRoot));
await registry.reload();
```

Discovery returns declarations, not live registrations. The registry validates
every definition and duplicate identity, normalizes agent selection, and calls
the existing consumer preparation/publication callback. Discovery and publication
share one serialized transaction. A replacement source becomes the default only
after publication succeeds; a rejected replacement retains the current generation.
Consumer rollback captures that generation inside the transaction, not before
waiting for the queue. Composition ties each staged source to its prepared agent
generation and restores the prior source before releasing that transaction.
Schedule rollback restores activation records, including due-slot history,
rather than restarting the old schedule at rollback time.

Sources must not mutate declarations they have returned, including nested
schemas, schedules, and policy function bindings. Return fresh declarations for
replacements; unchanged declarations may be reused. The registry freezes its
snapshot envelope and normalized top-level definitions, not the executable
object graph. It does not deep-clone closures or sandbox source code.

`app-runtime.ts` wires the file source at startup and reload. The private Task
worker entrypoints wire the same source for their selected release. To supply
another source, provide an `AppDefinitionSource` function in composition; no core
registration change, plugin manifest, or additional configuration is required.
Sources remain trusted Host code, not a sandbox for untrusted executable Apps.
Task removal checks and route/observer/schedule publication retain their existing
owners; the registry does not take over their lifecycle.

## Reading order

| Question                                         | Entry point                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Which source files are active?                   | `app-source-release.ts`: `DefinitionSourceReleaseStore`                        |
| How is an App discovered and validated?          | `adapters/discovery/app-definitions.ts`; `core/apps/definition-validation.ts` |
| How does reload publish a generation?            | `core/apps/registry.ts`: `reload()`; `app-runtime.ts` coordinates consumers    |
| What may an external caller publish or read?     | `packages/control/src/events.ts` and `client.ts` in the repository root        |
| How does the Host admit an event?                | `core/events/interface.ts`: `createEventInterface()`                           |
| How are declared routes selected and remembered? | `app-inbox-runtime.ts`; `app-event-admission-store.ts`                         |
| How is one request handled?                      | `app-inbox-host.ts`: `reconcileOnce()` and `#handleRequest()`                  |
| Where are requests claimed and settled?          | `app-inbox-store.ts`                                                           |
| How are messages and Topics read?                | `conversations/store.ts`: `readAppConversationResource()`                      |
| Where does admission hand off durable work?      | `app-task-capability.ts`: `attach()`                                           |

## Two entry paths

```text
typed input -> persist request -> deferred request handler -> attach Task
fact        -> select and persist routes -> request admission or Task admission
```

An App's `task(input)` maps a typed request to an existing or desired Task.
Its `subscriptions[].toInput(event)` translates a fact into typed input;
`tasks.resolve(event)` can map a subscribed fact directly to Task intent.
These are pure mappings. The Task runtime owns execution after admission.

The request handler has three branches: handle a declared conversational input,
return the observed result of linked work, or attach the request to a Task.
Conversation handling uses `app-request-agent.ts`; Task attachment uses the
supplied Task capability. Dependency waiting is durable state, so it releases
the request handler's execution slot.

## App-owned non-success stop

The SDK accepts `state: "stopped"` with a reason in `summary` and non-empty
`evidence`; optional `response` and `result` retain partial findings. This is
valid only for the current finite Task without live direct children, and cannot
include actions, Conditions or child App requests. App policy decides whether
the selected handler has discretion; otherwise it requests an owner decision.

`app-task-reconciler.ts: stopAppTask()` reuses the human-cancellation transaction:
it records App/agent/attempt attribution, retains findings, stops execution and
readies linked requests and the executable parent. It never creates a success
receipt or satisfies a prerequisite. Cancelled identities cannot be revised or
closed as successful by subsequent actions or desired-intent admission. New
work needs a new linked identity. Maintained Tasks and Tasks with live children
cannot stop. Cancellation-backed terminal children are not live work: bounded
`children.cancelled` context preserves their non-success evidence separately
from `children.completed`. Their parent can judge its own acceptance or stop;
the child still does not satisfy a success prerequisite.

The store rechecks the live-child relation under the cancellation transaction
and rejects new/reparented relations to a cancelled parent. This fences both
concurrent orderings without adding relation versions or another lock.

`app-task-runtime.ts` uses that operation for normal execution and saved
direct-agent results. Workflow recovery still reruns the workflow rather than
bypassing its continuation. Task workspaces use existing failed-attempt retention.
Human reads show terminal cancellation; App reads keep the existing `attention`
status with an explicit non-success summary and partial output. Caller request
completion means the answer was delivered, not that the Task achieved its outcome.

The SDK contract, reconciler, request-state and runtime tests cover rejection,
stale input, parent/caller wakes, transaction rollback, workspace retention and
restart. See the governing [stop slice](../../../may-agent.app/docs/proposals/task-runtime-organization.md#first-stop-slice-the-current-finite-task-only).

## Parent-owned failure review

Use `app-task-runtime.test.ts`'s "lets an existing parent repair exhausted work"
cases to trace request attachment, controller execution, persisted parent wakes,
executor context, fenced `unblock-task`, and the accepted caller result. The
restart case closes and reopens SQLite and installs a new runtime/EventBus before
the parent review. It does not simulate a process kill or test model judgment.
See the canonical [existing-parent owner proof](../../../may-agent.app/docs/proposals/task-controller-pattern.md#existing-parent-owner-proof)
and [parents and dependencies contract](../../../may-agent.app/docs/2a-design/task-resource-engine.md#parents-and-dependencies)
for the tested boundary and authoring rules.

`app-task-reconciler.ts` records a child transition for an existing executable
parent. `app-task-context.ts` and `runtimeTaskAttempt()` expose child facts and
the transition to the selected executor. The parent returns `waiting` while its
child runs, then judges aggregate acceptance. Neither retry exhaustion nor child
completion alone completes the parent's caller request.

Structural groups do not execute reviews. `dependsOn` gates execution order; it
does not designate a reviewer and must not be used to wait on children the
parent needs to review. The App chooses repair, explicit retry or revision under
its existing authority. No default reviewer is created for otherwise unowned
attention. For an authorized non-success decision, use the
[finite Task stop](#app-owned-non-success-stop); `close-task` records completion,
not abandonment. See the canonical
[owner-decision proposal](../../../may-agent.app/docs/proposals/task-runtime-organization.md#when-finishing-the-original-task-is-no-longer-the-right-choice).

## Unavailable Task handlers

`core/tasks/handler-recovery.ts` runs one bounded pass over retained
`HandlerUnavailable` attempts. It asks an availability function about the exact
binding; only core may release attention and requeue that same Task. The
generation, resource version, attempt, cancellation and pause checks remain in
`app-task-reconciler.ts`. Recovery also requires active App lifecycle inside
the resource commit transaction, so a concurrent pause cannot release work.

The pass advances a cursor in the existing resource-store metadata before it
awaits inspection. Pages use the existing phase index and wrap after the last
row. Repeated startup/reload passes therefore reach later Tasks even when older
bindings stay missing or a recovery process exits. This is a recovery hint,
not a Task revision, new retry queue, or new timer.

`core/tasks/handler-availability.ts` checks the supplied agent, executor and
workflow bindings without executing them. Workflow inspection comes from the
selected runner; its lookup cache lasts one pass. An agent handoff still needs
its originating workflow's verification capability before it can recover.

Attempt workers load their selected agents only. Recovery workers load the
active validated agent catalog, including non-default agents named or inherited
by retained Tasks. This uses ordinary generation loading rather than a second
agent-selection index; it constructs definitions but never executes agents.

`app-task-runtime.ts` supplies the selected bindings, fences checks against the installed
definition, and queues recovered IDs through the existing controller. Neither
an old reload nor a slow check may release a newer Task attempt. Missing
bindings remain visible without repeated execution; restoring a binding is
rechecked through ordinary startup/reload recovery.

The isolated recovery process has no controllers. It still repairs durable
readiness and emits the existing recovery observation; the parent's recovery
pass finds the pending Task and owns execution. Repair must not require a local
controller or start an attempt in the recovery process.

Its definition fence rereads the durable active-release link after each
availability check; a child-local registry alone cannot observe a parent
reload. A superseded check leaves the exact Task and failed attempt intact.
Normal attempt workers keep their pinned source and are not stopped by this
availability fence.

The governing design is [System Boundary — Recovery](../../../may-agent.app/docs/2a-design/system-boundary.md#recovery)
and [Task Resource Engine — Pause, reload, and recovery](../../../may-agent.app/docs/2a-design/task-resource-engine.md#pause-reload-and-recovery)
and [Execution isolation](../../../may-agent.app/docs/2a-design/task-resource-engine.md#execution-isolation).
They require recovery to continue the same identity, keep state changes fenced,
and run execution outside the interface process; the worker is not another
Task owner. These exact references require the sibling design tree, not this
standalone Host checkout. The [core proposal's Step 3](../../../may-agent.app/docs/proposals/task-runtime-organization.md#step-3-finish-the-taskexecutor-boundary)
describes the incremental extraction, not an additional lifecycle authority.

## Task execution backends

Core claims work, constructs the fenced Task interface, maintains its lease and
cancellation signal, owns deadlines and workspace lineage, validates results,
and commits accepted state. It does not construct a model manager, load a
workflow, inspect transcripts, or repair a managed-agent session.

`core/tasks/controller.ts` and `queue.ts` own bounded dispatch and coalesced
wakes. A synchronous execution throw follows the same bounded retry path as a
rejected promise. Failure reporting is best-effort: throwing/rejecting reporters
fall back to process diagnostics, and a pending reporter does not hold capacity.
No new event family or diagnostic service is required.

`app-task-reconciler.ts` owns the durable execution-retry allowance at the shared
claim boundary. The existing Task status stores one consecutive-failure count:
initial execution plus three retries, then attention with retained input and
an existing parent/dependency notification. Timer retries, recovery scans and
new processes all obey that same count. Successful progress/waits, a changed
execution generation, or explicit retry/unblock clear it; ordinary wakes and
stale-result fencing do not. Long-running successful work has no attempt cap.
Execution failures are recorded as failed attempts, distinct from stale results
and unavailable handlers. No SDK retry settings, new table or retry service.

`app-task-runtime.ts` coordinates the same Task lifecycle across ordinary
dispatch and startup. `consumePersistedTerminalAgentResult` reuses normal
transactional admission; `settlePersistedTerminalAgentResult` handles its shared
cleanup and publication. Validated actions retire exact superseded sessions
before the fenced Task commit exposes replacements. A cleanup refusal leaves
the saved result and original claim available for recovery in both ordinary
dispatch and recovered settlement. It propagates past result-validation and
execution-failure handling rather than rejecting the result or releasing its
claim. Cleanup runs
outside the SQLite transaction; commit still rechecks every resource fence.
If a concurrent update wins after cleanup, ordinary reconciliation uses the
current Task, never the stale action. Cleanup may repeat and names only the
prior exact session, never a replacement. No new outbox or persisted schema is added.
`taskCompletionDisposition` distinguishes Task completion
from accepted progress or self-revision. Both paths publish dependency changes
through the same function. Recovered waits replay persisted Condition facts. Startup retains
its distinct live-session/lease checks and queue gate; it does not run an App
attempt or invent another completion policy.

The [whole-lifecycle proposal](../../../may-agent.app/docs/proposals/task-controller-pattern.md)
connects existing App input mapping, bounded attempts, exact waits and checked
results. The reconciler above owns the retry-across-restart bound;
the [parent-owned failure review](#parent-owned-failure-review) cases prove the
existing executable-parent retry route through the caller's result, including
database reopen. App policy, model judgment and live follow-through remain
separate validation. The lifecycle cases
in `app-task-runtime.test.ts` cover continued input, revised acceptance,
recovered waits/actions and required workflow verification.

| Contract / implementation | Responsibility |
| --- | --- |
| SDK `TaskExecutor(attempt)` | One bounded custom executor call and proposed result; unchanged public contract |
| `core/tasks/execution.ts` | Private agent, workflow and session operations needed by existing Host backends |
| `core/tasks/workspace.ts` | Preparation/finalization contract and workspace evidence; no Git commands |
| `adapters/executors/managed-agent.ts` | Agent preparation, role/prompt construction and managed execution |
| `adapters/executors/workflow.ts` | Workflow inspection, workspace requirements, bounded execution and verifier lookup |
| `adapters/executors/session-recovery.ts` | Session liveness, results, checkpoint context and safe process cleanup; never Task settlement |
| `adapters/executors/agent-workspace.ts` | Existing managed-agent canonical-workspace guard and deployment evidence |
| `adapters/workspaces/git.ts` | Git refs, worktree preparation, integration checks and cleanup |
| `composition/task-execution.ts` | Select the shipped backends; used by daemon and isolated-worker preparation |

These are ordinary private operations, not an SDK lifecycle or plugin system.
Built-in runners receive identity, desired work and declared outputs through
`TaskAttempt`, not a second complete claim or intent. Their additional inputs
are Host-only prompt, workflow and session capabilities; the public SDK is unchanged.

Composition may supply an executor map with no managed-agent or workflow
runner. App declarations and accepted Tasks remain installed when an agent is
unavailable. Work requiring it records exact unavailability; unrelated native
executors remain usable. Restoring a binding uses the same recovery pass.

At publication, the shipped runners snapshot their agent definitions. Active
attempts keep those definitions; new attempts use the replacement. Source roots
are the release chosen by composition, not an inferred checkout. Session
recovery uses the configured persistence directory, never a guessed `.state`
folder beside an App. Its optional checkpoint context is evidence for a new
attempt, not a requirement to resume a workflow stack.

Removing a session-recovery implementation cannot prove a retained session has
stopped. Drain managed sessions before omitting it, or restore that capability
to recover them. Core refuses replacement ownership without that proof.
Basic reads and work without retained managed sessions remain available.

Composition supplies Git workspace operations through `workspaces`. Omitting
them leaves local executors and shared-workspace workflows usable; a worktree
requirement fails visibly before execution, with no fallback to the shared
checkout. Restore the backend and retry the same Task through existing control.
Core still decides when to prepare/finalize, records lineage against the exact
attempt, and rejects stale or unaccepted results. The adapter returns evidence;
it never settles a Task.

`executeAttempt` remains the separate process-dispatch boundary; it is not a
backend's execution function. Stores, claims, result admission, cancellation,
Conditions and workspace finalization ordering remain under the Task engine. No extra
timer, queue, persisted lifecycle, or live installation operation was added.

## State and process boundaries

### Basic reads and optional reports

`core/reads/app-read.ts` exposes canonical Task list/get, request results and
execution results. It neither constructs metrics nor reads outcome manifests.
Absent metric/outcome callbacks throw an explicit unavailable error; a missing
record from an installed capability can still return null.

`adapters/reporting/` owns metric-definition installation, metric views and
outcome grouping. The outcome reader receives only App directory plus canonical
list/get callbacks, never a private Task store. `composition/reporting.ts`
selects shipped reports; the CLI supplies them to runtime and private workers
select their outcome reader. No service is created just to prepare a read
context. Workflow/maintenance metric services are created on first use.

Metric-definition refresh observes a committed App generation outside its
publication transaction. Failure is reported to process diagnostics and cannot
reject that generation or rewrite accepted work. Interfaces are selected at
composition; a fixture runs real Task attempts with every human transport and
reporting omitted. Another fixture fails reporting through reload and verifies
old accepted results and new execution remain intact.

These boundaries implement Step 5 of the sibling core proposal; they do not
add a reporting registry, lifecycle, queue, or alternative state authority.

`app-inbox-store.ts` owns durable requests and their claims; the word inbox is
the implementation name for those requests. `conversations/store.ts` reads
that evidence and owns Topic links. Both use the same Host database.
`app-event-admission-store.ts` remembers the selected route payloads so retries
apply the recorded decision. None of these stores is an additional work owner.

`core/state/requests.ts` atomically attaches a claimed request: Task input,
request wait/claim release, and Topic link commit together. Task settlement
persists request readiness; notifications only accelerate discovery. Recovery
also recognizes the old target-qualified admission keys when admission committed
before a crashed Host stored the wait. It reuses that accepted identity without
replaying input or rewriting admission history.

Attachment and settlement share the attention-readiness rule in
`app-task-state.ts`. Exhausted execution retains input but cannot run again
without an explicit retry or revision; its linked request is therefore ready
for review even with retained input. Ordinary attention with newly pending
input still waits for fresh execution. This wake reports the need for a
decision; it neither authorizes another attempt nor proves owner follow-through.

`app-inbox-runtime.ts` still coordinates routes, request scheduling,
Conversation notifications, schedules, observers, and reload. It is the
integration point, not a new public API. Broad Task-intent admission runs in
`task-admission-process.ts`; exact wakes and request admission have bounded
in-process paths. Task execution uses `task-attempt-process.ts` separately.

Canonical design remains in the sibling `may-agent.app/docs`: start with
`2a-design/system-boundary.md` and `proposals/task-runtime-organization.md`.
This file is a source navigation guide, not a second system design.
