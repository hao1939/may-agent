# Host Runtime

**Design status:** Accepted.
**Implementation status:** Task reconciliation owns durable App work. Bounded
conversational turns can perform self-contained authorized work directly.
Small pure mappings (`subscription.toInput`, `task(request)`, and
`tasks.resolve`) select durable work during admission; they cannot execute it.
The owner/disposition worker, analysis attachment, delegation publisher, and
request delivery gate have been removed. Scoped Task list/get reads share one
Runtime implementation across SDK, agent tool, control socket, and HTTP.

The accepted [one-lifecycle baseline](../proposals/conversation-input-unification.md)
will move Conversation execution into a stable Task, use explicit accepted
outcomes and owner-controlled closure, and remove separate execution recovery.
That change is pending; startup and protocol descriptions below reflect current
source unless marked as target behavior.

The runtime is the Host code. It is not a third layer between Host and App.

The [System Model](system-model.md) defines ownership and replaceability;
[Architecture](architecture.md) maps them to current source.

The code contains workers, queues, claims, leases, controllers, and adapters.
Those implement the [four core responsibilities](architecture.md#core-responsibilities).
An App author uses their contracts without assembling those internal modules.

## Process modes

Only the long-running daemon hosts Apps. Other modes reuse bounded execution or
read state without attaching request workers, schedules, task workers, or
recovery.

| Mode                           | Hosts Apps | Runs bounded agents/workflows       |
| ------------------------------ | ---------- | ----------------------------------- |
| Daemon with `--cron`            | Yes | Yes, including background Tasks          |
| Daemon without `--cron`         | Yes | Yes, including background Tasks; optional schedules disabled |
| Direct agent/workflow          | No         | Yes                                 |
| Gym                            | No         | Yes                                 |
| Web/read-only process          | No         | Only through explicit control calls |
| Status CLI                     | No         | No                                  |

Ingress readiness and Task execution readiness are separate. At the
[current source baseline](../README.md), process role determines whether Task
controllers and startup recovery run. A socket-only daemon runs its Tasks
without `--cron`; that flag selects optional schedules. The Task controller gate
opens after the initial recovery pass settles. Direct workflow, read-only and
isolated worker modes do not claim background work. The
[core proposal](../archive/implementation/core-separation-review-20260910.md#step-1-implementation)
records the merged implementation and validation, not a deployment claim.

## Startup

At the [source baseline](../README.md), execution/recovery adapters are
selected in composition; named Host maintenance cannot launch standalone
workflow jobs; reporting is optional and observes committed App generations
outside publication. Basic Task/request/result reads remain available without
reporting. Source tests run Tasks with all human interfaces omitted. See
[Architecture](architecture.md#behavior-when-a-capability-is-absent) for the
absence contract.

```text
open stores
  -> restore the explicitly activated definition source release
  -> prepare agents and Apps from that same committed source
  -> validate one complete Runtime generation
  -> publish the complete registry and attach event routes
  -> open external ingress, reads, and Conversation adapters
  -> attach prepared producer event routes; with --cron, enable optional timers
  -> start the App inbox runtime
  -> start bounded isolated Task recovery asynchronously
  -> start Task controllers after that initial recovery pass settles
```

Reload stages committed global and App-local agent definitions, shared
`common-sense.md` and skill sources, and App definitions together. It builds
every agent, tool surface, skill catalog, handler, and App registry before
publication. Validation, skill, or handler errors reject the whole candidate.
The final synchronous publication switches manager definitions, App registry
consumers, each stable App controller's definition pointer, and the durable
`current` release link as one generation; a rejected publication restores the
previous set. Each attempt captures the release's App descriptor, global and
local agent definitions, workflow/guard roots, and shared definition root when
it starts. New attempts can therefore start from the new release while old
attempts finish from the old release; reload does not create or drain a
replacement controller. Generation-owned timers, subscriptions, and tool
resources are closed when replaced or rejected. A restart restores the same
link; it never discovers newer prompt, skill, agent, or App behavior from the
mutable checkout. App state, operational shared files, and execution workspaces
remain at explicit canonical writable paths and are not copied into definition
releases.

## Deployment

Reload applies one committed agent-and-App definition release; it rejects
uncommitted executable definition changes and does not replace Host code.
A Host deployment does not imply App activation. It belongs to a live **Host
Operations App** Task whose
stable App ID is `may-agent`; it never belongs to the May Conversation App
merely because May routed the request. The immutable
candidate must contain the current canonical May commit before it may replace
the process binary and SDK. A project App may report a Host compatibility gap,
but its task cannot authorize a global May deployment. Historical releases and
worktrees are evidence, never rollout targets.

The build embeds the immutable source commit in the compiled binary; it does
not infer identity from whichever checkout is the process working directory.
The deployment receipt separately binds that source commit to the artifact
hash and the matching SDK release. The Web UI is also a versioned release
artifact. An immutable archive build stages it under an explicit output path;
it never derives a writable live path from the archive's parent directory. The
supervisor switches binary, Console, SDK, and UI together and restores the
previous set when readiness fails.

## Store first, then run

The Host stores identity and intent before the Runtime wakes work. The code
calls this "admission":

- an input event, frozen route journal entry, and any caller request are
  persisted before asynchronous request-to-Task coordination;
- a subscribed fact becomes typed App input or an exact task wake;
- a task trigger is recorded before a worker is woken;
- a local child and its parent link commit together; and
- a cross-App wait references a durably admitted destination request. Request
  admission and the source Task's final wait commit are separate; recovery
  reuses the exact correlated request if the source attempt is interrupted.

This is why restart recovery does not depend on an in-memory queue.

The admission journal is crash insurance, not a work queue. A newly accepted
event arms the asynchronous in-memory coordinator after publication returns.
Startup and App reload each recover at most 16 retained plans; the safety pass
runs at most once per minute, selects only plans whose one-minute retry
cooldown elapsed, and uses the `(status, updated_at)` index. A route that
remains invalid therefore stays visible without continuously consuming CPU or
rewriting its error row.

The [one-lifecycle target](../proposals/conversation-input-unification.md#proposed-controller-boundary-and-code-layout)
replaces Conversation execution in the inbox pump with Task admission and one
common claim/attempt/settlement path. Retain caller correlation and admission
recovery; do not put a Task around an independently executing inbox handler.
Current source still has both paths. Closed Tasks and stopped/exhausted input
are not made eligible by a queue hint or a timer tick.

## Capacity

The Host constructs one `HostCapacity` limit shared by request decisions and
task attempts. Per-App task limits apply in addition. The request coordinator
coalesces App keys and admits at most the Host limit: normal request decisions
use background capacity, while at most one May decision may use the reserved
foreground slot. Apps do not configure either mechanical limit. Delivery is
passive and consumes neither.

The accepted [conversation input unification](../proposals/conversation-input-unification.md)
requires a refinement: choose these existing lanes by admitted input origin so
linked Task/timer reviews use background capacity even when May handles them.
Current dispatch selects foreground by conversational App identity; changing
the subscription alone would give all such reviews foreground treatment.
In the one-lifecycle target, a conversation Task handling human input may use
the reserve; its automated review and independently delegated work use background
capacity. Current Task attempts all acquire background capacity, so both input
selection and Task dispatch need alignment. This adds no capacity service or
preemption; a single-slot Host cannot reserve a second slot for human execution.

Capacity is backpressure, not policy. It decides when work may start, never
which work matters or whether the result is acceptable.

## Pausing

Pause has one meaning:

- admission and persistence continue;
- new task attempts do not start; and
- resume queues retained work from durable state.

The Host does not reject task intent merely because the App is paused.

Under the pending common lifecycle, this existing background-work pause must
leave human conversation handling available. It cannot become an indiscriminate
pause of every Task just because Conversation now uses Task execution. Exact
Turn Stop and explicit Task closure remain separate controls.

## Bounded execution

All agent calls use the same execution path:

```text
agent definition + typed input + allowed tools
  -> model/tool loop
  -> ExecutionResult
```

The execution path owns prompt preparation, tool policy, cancellation,
transcript evidence, and provider interaction. It does not own an App request
or task outcome.

Sessions are attempt records. An explicitly controlled unbound session may
resume when the same bounded request can safely continue. A task-owned session
does not resume independently after process restart: its owning Task is
requeued and any replacement attempt passes through normal Host capacity.

Task attempts and startup Task repair run outside the interface process. Their
durable events return as identity-bearing observations, one potentially
expensive event per event-loop turn. The parent polls interface I/O before
relaying the next event; a numeric batch bound alone is not sufficient because
one App route may legitimately take a noticeable bounded read.

## Workflows

A workflow is one bounded App-owned procedure. It receives typed input, task
reconciliation context, scoped reads, agent calls, fact/metric ports, and an
allocated workspace.

Automatic reconciliation context stays small: the current Task and direct
children carry decision-ready facts, while the App-wide snapshot carries only
compact planning state. Exact detail for another Task is loaded explicitly by
identity through the scoped Task read API, so unrelated Task payloads do not
inflate every workflow or agent prompt.

It does not receive the Host database, event bus, queues, scheduler, manager,
or recovery state. A workflow finishes, blocks, or returns a task result; it
does not remain alive as a background controller.

## Events, schedules, and observers

The Host exposes one small event boundary over the existing persistence-first
bus:

```text
publish(event) -> EventReceipt
get(eventId)   -> EventView
subscribe(filter)
```

An explicit table marks the small set of `required` types. Everything else is
record-only for trusted internal producers. The boundary validates and derives
the envelope, then routes it to caller correlation, task resolution/wake,
session control, or Host lifecycle control. It is not another broker, queue,
service, or handler framework.

`publish` synchronously validates and persists the event, evaluates only pure
route mappings, and records the exact durable request, admission-journal row,
Task wake, or operation needed for acceptance. It then returns. Request-to-Task
coordination, reconciliation, workflows, agents, commands, network calls, and
presentation run asynchronously; inline routing never performs the work it
admits.

Conversation admission follows the same boundary. The human Turn and exact App
request are durable before `publish` returns. The derived
`conversation.updated` wake is coalesced and emitted on a later turn; adapters
reread the Conversation resource when it arrives. A slow presentation route
therefore cannot hold the human acknowledgement.

Passive listeners receive persisted, non-replayed events afterward in their
own filtered, bounded FIFOs. A slow Console, socket client, Conversation
mirror, metric observer, or lifecycle observer therefore cannot extend event
acceptance, block another listener, or retain an unbounded backlog. These
notifications are hints to reread durable resources, not a second
guaranteed-delivery channel. App observers below are different: they are
bounded external-state readers that produce facts.

Session digest files, `last-session` summaries, terminal agent cleanup, task
session recovery, stuck detection, auto-resume, escalation follow-up, project
comment projection, adapter rendering, and public event streams use this
passive path. The small session-start binding remains synchronous because the
execution that follows immediately must see its session identity. Telegram
rendering and network delivery are passive Conversation observation; Telegram
has no session-output, notification-review, or approval-ordering route on
event acceptance.

The local `status` control read has an explicit diagnostics option that samples
process CPU, heap, external memory, RSS, PID, and uptime on demand. Normal
health probes do not pay that observation cost. The quiet-runtime sampler
combines this explicit read with active execution, child-process, Task,
workflow, and event checks; it refuses to label a contaminated window idle.
It keeps one control connection, reads CPU/RSS from `/proc`, and checks durable
activity watermarks once per second. Only the window endpoints request process
diagnostics, so the measurement does not manufacture the CPU load it reports.

The agent-facing `system_status` dashboard is also an on-demand bounded read.
Active sessions come from the status index and recent terminal sessions from
the ended-time index, with fixed limits. It never enumerates or parses retained
session directories merely to render a dashboard.

Shell output is execution evidence, not a stream the Host must repeatedly
materialize. The complete capture stays on disk. While the command runs, the
Host observes file-size growth without reading output and emits at most one
small progress pulse per second. After the process group drains, it reads one
bounded recent tail for the final result. Host read volume therefore does not
grow with command verbosity.

Process-group cleanup uses cheap kernel group probes while waiting. It walks
`/proc` only at a signal-phase boundary to distinguish a live descendant from
a zombie-only group; cleanup cost therefore does not multiply the Host process
count by a 20 ms polling loop.

Detached Codex and Claude workers follow the same boundary. Their complete
native JSONL stream is written directly to one evidence file, while the Host
parses protocol lines incrementally and retains only a bounded diagnostic
tail. No worker stdout or stderr array grows for the lifetime of the process.

An App schedule has exactly one event destination: an App input request or a
fact. An observer has one job: read external state and return facts. Both are
replaced atomically with their App generation.

## Host maintenance

Some scheduled code must inspect Host-owned storage, such as session cleanup or
metric collection. File handlers receive only Host maintenance capabilities:
queries, metrics, fact publication, logging, delivery, and explicit paths.

They cannot start an App agent/workflow or create App task state. When repair
needs App judgment, the handler publishes a typed fact and the App resolves or
wakes its task. Session recovery follows this path:

```text
Host detects failed session
  -> Runtime resolves its owning attempt and task
  -> repair mechanical session state and requeue the same task
  -> expose remaining failure evidence to its exact caller or declared App route
```

An App judges whether a runtime defect warrants separate maintenance work;
the recovery mechanism cannot invent that assignment or select a named owner.
The Host does not call a model to decide mechanical recovery. Consecutive
error-only turns cause one bounded cancellation, interrupted unbound sessions
receive at most two delayed resume attempts, and exhaustion emits an
escalation. Any semantic decision after that belongs to the accountable App or
human, not infrastructure.

The separate maintenance process still performs a legacy 30-second delivery
expiry and lifecycle-pair repair pass. It remains outside `DbWriter`'s insert
path, but the unused transport-delivery portion should be removed with the dead
inbox delivery API rather than becoming a current App contract.

## Recovery

After opening its interfaces, the Host starts an isolated recovery worker that:

- releases or repairs stale claims and leases;
- repairs request correlation and requeues runnable tasks;
- preserves completed results and event-admission evidence;
- resumes only compatible sessions that are not owned by a Task; and
- leaves paused task work retained but unqueued.

The interface process does not await this work. A recovery failure is logged
and left to the bounded recovery checks; it must not terminate or stall the
human interface. Task controllers start after the initial pass settles.

SQLite has one writer. Task workers may wait for it because they are isolated;
the interface process uses only a short bounded lock wait. If new input cannot
be made durable in that bound, it is not acknowledged and the adapter retries
the same idempotency key. If an already-durable worker event cannot finish its
App admission route, normal admission recovery retries that event identity.
Database contention must never become a multi-second event-loop sleep.

For a resource-backed App, recovery is indexed insurance: one bounded startup
query, one nearest-due timer, indexed expired-lease repair, and a bounded safety
query. The safety query advances an indexed cursor across bounded pages so a
large lost ready set cannot starve rows beyond the first page. Events remain
the ordinary trigger. The Runtime does not continuously deserialize every App
task or refill the ready set by scanning the whole tree.

The same rule applies before a task exists. Interrupted event-to-App admission
is recovered in bounded due batches with a retry cooldown. The ordinary event
path does not wait for that recovery timer. The App input handler becomes
active first; dependency and frozen-admission recovery begin on later event-loop
turns. Each bounded recovery item yields to the event loop before the next item,
including consecutive Task dependencies owned by one App, so a large App cannot
starve control reads or human-message admission.

Recovery preserves request and task identities. Requests correlate callers;
tasks own App work. Logs and traces are evidence, not reconstruction authority.
Saved execution output is only a candidate for normal Task admission: newer
input or a recorded scope revision may require continuation even after that
output is accepted. Recovery must not equate a finished session with a completed
Task. Normal and recovered results share settlement and publication decisions;
see [Task acceptance](task-resource-engine.md#acceptance). The
[historical review](../archive/implementation/controller-review-20260910.md#settlement-candidate-and-remaining-work)
records the merged correction's original proof.

## Interfaces

Control socket, HTTP, console, Telegram, and Web UI receive only a bounded
interface context:

```text
publish(event)
get(eventId)
subscribe(filter)
bounded read models
```

Event definitions retain the four semantic families—App input, fact, exact
control, and Host lifecycle control—without exposing four transport APIs.
Compatibility commands are thin event constructors. Interfaces do not receive
the EventBus, manager, database, task store, App implementation, or model runner.

## Shutdown

Shutdown closes ingress, timers, observers, workers, and adapters; drains or
interrupts bounded attempts under policy; persists terminal evidence; and
leaves unfinished requests and tasks recoverable. It never marks unfinished
work complete.
