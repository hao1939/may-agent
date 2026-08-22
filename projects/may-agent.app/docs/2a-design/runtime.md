# Host Runtime

**Design status:** Accepted.
**Implementation status:** Task execution is the only App policy path. The
owner/disposition worker, analysis attachment, delegation publisher, and
request delivery gate have been removed. Scoped Task list/get reads share one
Runtime implementation across SDK, agent tool, control socket, and HTTP.

The runtime is the Host code. It is not a third layer between Host and App.

```text
Infra   = ingress, persistence, scheduling, capacity, and delivery
Runtime = task lifecycle, execution, scoped capabilities, and recovery
App     = resolve inputs to tasks and reconcile those tasks
```

The code contains workers, queues, claims, leases, controllers, and adapters.
Those are private ways the Host does its five jobs. They are not concepts an
App author must compose or understand.

## Process modes

Only the long-running daemon hosts Apps. Other modes reuse bounded execution or
read state without attaching request workers, schedules, task workers, or
recovery.

| Mode                           | Hosts Apps | Runs bounded agents/workflows       |
| ------------------------------ | ---------- | ----------------------------------- |
| Daemon with scheduling enabled | Yes        | Yes                                 |
| Direct agent/workflow          | No         | Yes                                 |
| Gym                            | No         | Yes                                 |
| Web/read-only process          | No         | Only through explicit control calls |
| Status CLI                     | No         | No                                  |

## Startup

```text
open stores
  -> load agents and Apps
  -> validate one complete App generation
  -> attach event routes, schedules, observers, and task workers
  -> recover unfinished work
  -> attach external ingress and Conversation adapters
```

Reload prepares a full replacement before publication. Generation-owned timers,
subscriptions, and workers are closed when replaced.

## Deployment

Reload applies current agent and App definitions; it does not replace Host
code. A Host deployment belongs to a live `may-agent` App task. The immutable
candidate must contain the current canonical May commit before it may replace
the process binary and SDK. A project App may report a Host compatibility gap,
but its task cannot authorize a global May deployment. Historical releases and
worktrees are evidence, never rollout targets.

## Store first, then run

The Host stores identity and intent before the Runtime queues work. The code calls this
"admission":

- an input event and any caller request are persisted before task resolution;
- a subscribed fact becomes typed App input or an exact task wake;
- a task trigger is recorded before a worker is woken; and
- a child dependency is stored before the child starts.

This is why restart recovery does not depend on an in-memory queue.

The admission queue is crash insurance, not a standing work loop. A newly
accepted event enters the in-memory fast path immediately. Startup and App
reload each recover at most 16 retained plans; the safety pass runs at most once
per minute, selects only plans whose one-minute retry cooldown elapsed, and
uses the `(status, updated_at)` index. A route that remains invalid therefore
stays visible without continuously consuming CPU or rewriting its error row.

## Capacity

The Host constructs one `HostCapacity` limit for task attempts. Per-App task
limits apply in addition. Request correlation and delivery do not consume a
separate App execution capacity because they do not execute App policy.

Capacity is backpressure, not policy. It decides when work may start, never
which work matters or whether the result is acceptable.

## Pausing

Pause has one meaning:

- admission and persistence continue;
- new task attempts do not start; and
- resume queues retained work from durable state.

The Host does not reject task intent merely because the App is paused.

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

`publish` synchronously validates, persists, and records only the exact durable
request, Task wake, or operation needed for acceptance. It then returns. The
App, workflow, agent, command, network call, and presentation work run
asynchronously; inline routing never performs the work it admits.

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
process heap, external memory, and RSS on demand. Normal health probes do not
pay that observation cost.

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
  -> only a repeated platform-contract defect becomes a may-agent App task
```

The Host does not call a model to decide mechanical recovery. Consecutive
error-only turns cause one bounded cancellation, interrupted unbound sessions
receive at most two delayed resume attempts, and exhaustion emits an
escalation. Any semantic decision after that belongs to the accountable App or
human, not infrastructure.

The separate maintenance process also performs the small 30-second delivery
expiry and lifecycle-pair repair pass. Keeping it out of `DbWriter`'s insert
path prevents a periodic history query from taxing the next incoming event.

## Recovery

At startup the Host:

- releases or repairs stale claims and leases;
- repairs request correlation and requeues runnable tasks;
- preserves completed results and delivery evidence;
- resumes only compatible sessions that are not owned by a Task; and
- leaves paused task work retained but unqueued.

For a resource-backed App, recovery is indexed insurance: one bounded startup
query, one nearest-due timer, indexed expired-lease repair, and a bounded safety
query. The safety query advances an indexed cursor across bounded pages so a
large lost ready set cannot starve rows beyond the first page. Events remain
the ordinary trigger. The Runtime does not continuously deserialize every App
task or refill the ready set by scanning the whole tree.

The same rule applies before a task exists. Interrupted event-to-App admission
is recovered in bounded due batches with a retry cooldown. The ordinary event
path does not wait for that recovery timer.

Recovery preserves request and task identities. Requests correlate callers;
tasks own App work. Logs and traces are evidence, not reconstruction authority.

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
the EventBus, manager, database, task store, App owner, or model runner.

## Shutdown

Shutdown closes ingress, timers, observers, workers, and adapters; drains or
interrupts bounded attempts under policy; persists terminal evidence; and
leaves unfinished requests and tasks recoverable. It never marks unfinished
work complete.
