# Sessions

**Design status:** Accepted.
**Implementation status:** Implemented, including per-turn trace propagation,
fail-closed start persistence, and terminal error persistence. Shared execution
limits, scoped helpers and caller-driven standalone resume are implemented.
The [earlier trial](../archive/reviews/execution-consolidation-poc-20260914.md)
retains its original scope and limits; source status does not establish the
deployed artifact.

## The Model

Every agent interaction is a **session** — a single LLM conversation with tools.

The following is a schematic Host storage view. Migrations may add columns;
Host maintenance must inspect the effective schema. App code uses bounded
`ctx.read.execution` and other [SDK reads](sdk.md), not SQL or a generic query
service.

```sql
CREATE TABLE sessions (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',  -- running | idle | done | error | interrupted
  kind            TEXT,             -- chat | job | call
  source          TEXT,             -- what triggered it
  parentSessionId TEXT,             -- who spawned this session
  requestId       TEXT,             -- legacy correlation metadata; not lifecycle identity
  workflowRunId   TEXT,
  projectId       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  stepLabel       TEXT,             -- workflow step label (in practice, always equals `agent` when non-null)
  lastActivityAt  INTEGER           -- last observed activity timestamp (ms)
);
```

## State Machine

```
created → running → idle      (chat turn completed; same chat session can receive the next message)
                  → done      (completed job/call sessions)
                  → error
                  → interrupted
```

No "pending" or "queued" state. Sessions start running immediately when spawned.
Periodic App work arrives as ordinary input and executes through its Task and
bounded attempt. Liveness observation and optional time production are owned by
[Heartbeat](heartbeat.md) and [Cron](cron.md), not by a special heartbeat session
or workflow lifecycle.

Chat sessions are persistent conversations. A successful chat turn moves the
session from `running` back to `idle`; the next human message wakes the same
session. A retryable empty assistant turn does not terminal-close the
conversation: the runtime removes the empty assistant message, retries the same
user request once, and if the retry is still empty leaves the session `idle`
with a visible error on the `session.idle` event.

This persistent-chat policy applies to direct agent chat. Ordinary May Console
and Telegram input publishes one human `conversation.message.created`: one May
request correlates the turn, and one bounded session makes each May decision.
Durable destination work belongs to its Tasks. A restart may replace that
session without replacing or replaying the opening event, request, Topic, or
destination Tasks. See [Human Control
Surfaces](human-control-surfaces.md).

## Chat Turn Causality

A persistent chat session can participate in many traces. Session identity
answers "which conversation?"; trace identity answers "which human turn or
causal chain?" They must not be conflated.

Each queued input carries the trace of its triggering
`chat.start.requested` or `session.steer.requested` event. While processing that
turn, tool emissions, calls/forks, workflows, CLI tasks, and the terminal
`session.idle` / `session.end` use that turn trace. The terminal session event
adds a closure link to the opening intent. The next unrelated human turn gets a
new trace even though the session id remains unchanged.

`requestId` is retained only as legacy metadata. It must not open, close, or
correlate lifecycle pairs. Persisted event ids, explicit pair contracts, and
trace links are authoritative.

## Session controls

Steer and cancel are required event types with an exact `target.sessionId`.
The Host rejects a missing or nonexistent target before issuing a receipt. A
bare cancel never expands to cancel-all.

Acceptance means the deterministic session controller durably correlated the
operation or the exact idempotent state already holds. It does not mean the
session has reached its requested terminal state. Callers use the opening event
ID and linked session read to observe progress.

## Session lineage

Awaited agent calls carry `parentSessionId` where available. Workflow steps also
carry `workflowRunId`; a workflow without a parent agent session need not invent
one. Task ownership uses the exact runtime-supplied Task/attempt binding, not
either lineage field. A current session may mutate the attempt's owner session
and recovery lease only when that binding includes the exact current
`attemptId`; generation and Task identity alone are insufficient authority.
Legacy bindings without an attempt ID remain readable as historical context but
cannot acquire current execution ownership. Helpers inherit Task context without
replacing the owner; a later sequential workflow owner can associate only with
its exact attempt binding. Trace links describe event causality. The [cooperation
contract](agents.md) owns helper lifetime; the hosted execution scope enforces
it using the live caller's execution scope.

## Persistence

Sessions persist to:

1. **Disk** (`meta.json`, `session.jsonl`, and terminal `result.json`) — full
   task, conversation, and result artifacts
2. **SQLite** (`sessions` table) — bounded lifecycle/lineage projection, task
   preview, and artifact reference/hash/size

Disk is the source of truth for full session content. The DB is the queryable
index. See [storage.md](storage.md) for the cross-record storage contract.

## Persistence Integrity

New session identities must be unique across isolated execution processes and
restarts, including sessions started in the same millisecond. Use a random UUID
alongside the diagnostic prefix/timestamp, not a process-local counter. Existing
session IDs and artifact paths remain unchanged; consumers treat IDs as opaque.

The manager registers live state before emitting `session.start`. The event is
persisted before side-effect subscribers run; if persistence fails, manager
state is rolled back and the registry records the start error. Consumers must
therefore never observe a durable session start for an unregistered session.

Terminal `session.end` data includes `status`, `outcome`, and `error`. The
runtime writes those fields to terminal `result.json` and projects the bounded
lifecycle fields into SQLite. Disk remains the full transcript/result source,
while SQLite is the canonical bounded read model for lifecycle queries.

`lastActivityAt` is updated by progress and terminal writes. Stale-session
checks may use it directly; historical rows created before the field existed
remain migration data rather than a reason to weaken the current contract.

Agent tool calls must also have a bounded lifecycle. A shell command is not
still running merely because a descendant retained stdout or stderr after the
invoked shell exited. Shell commands run synchronously inside isolated execution
workers, so the long-running daemon does not directly own or reap their
subprocesses. Each worker owns one exact process group and returns output and
exit status as data. Timeout and abort settle independently of output-stream
closure; they must not leave the session, workflow, and owning task permanently
running behind a zombie process.

Provider requests may have a shorter fixed limit than their invocation. The
current Pi model-request adapter uses a five-minute abort limit; that is a
provider-call boundary, not a universal five-minute coding limit. Tool progress
does not renew the invocation allowance. Silence and repeated tool errors are
evidence for the owner, not independent permission to stop or steer work. The
[execution boundary](system-boundary.md#execution) owns these shared rules.

The [execution consolidation record](../archive/reviews/execution-consolidation-poc-20260914.md)
documents removal of manager silence cancellation and error-count stopping. The common scope
uses a 30-minute default when no invocation limit is configured; a caller's
remaining allowance can shorten it. One-shot CLI retains its five-minute default.
Direct chat creates a scope per active turn, closes it before becoming idle, and
does not charge idle time against the next turn. Old-turn cleanup cannot close a
new scope on the same session.

Cancellation signals the work first. While it or required helpers are draining,
live status remains running, with the interruption reason available. Repeated
cancellation is harmless. Terminal results follow cleanup; disappearing from
the live map is not evidence of success. In-process cancellation is cooperative;
existing worker/process isolation handles supported unresponsive execution.

An interrupted `call` returns to its caller; generic session auto-resume must
not start it again independently. The owning workflow or Task decides the next
bounded attempt using current state. Otherwise a timed-out call can keep editing
after its workflow settled, outside Task capacity and result fencing. Explicit
cancellation is likewise not an automatic retry request. The startup policy omits
automatic standalone `job` resume: durable obligations belong to Tasks; local
invocations return to their caller. Explicit permitted user resume and
stale-state/process cleanup remain, without inventing another work owner.

## Data Retention

### Checkpoint evidence

The optional checkpoint tool appends coarse progress to
`.state/checkpoints/<sessionId>.jsonl`. This is execution evidence, not another
Task result or automatic authority to repeat an external effect. The proposed
numbering rule makes the session log authoritative: a recreated tool or restarted
process continues from retained progress in that state directory. Separate
installations would not share a counter. The per-agent latest file remains a
convenience pointer.

The [tool cleanup](../proposals/authority-boundary-simplification.md#independent-tool-cleanup),
merged in Host #198 as `28670dd2`, implements this by reading the highest saved
step before each synchronous append. It accepts reading the coarse-progress log instead of maintaining
another cache/lifecycle. Execution has one writer per session; this does not
add cross-process writer coordination or transactional checkpoint/pointer/digest
writes. Existing history is retained. The September 18 review at `dd548cab`
predated that merge; it is historical evidence, not current implementation
status. Source status does not identify the deployed artifact.

### Retained sessions

Runtime maintenance expires old SQL projections in bounded batches. It does not
delete a live record merely because its original task is large: new task text
is bounded in SQL by construction and the full task stays in `meta.json`.
Completed session directories expire with their SQL session rows after the
default 14-day window. Cleanup first verifies the row is terminal and the
directory has no active marker, retires the DB row, and only then removes the
directory. Longer retention or export is an explicit archival concern.

The runtime keeps promises only for active work and a small bounded cache of
recent completed results. Older results are reconstructed from the durable
session transcript on demand; full message histories must never accumulate in
an unbounded in-memory map. Terminal state is metadata; it is not a filesystem
location.

See `events.md` → "Data Retention" for the full retention table.

## Implementation

- **Manager:** `projects/may-agent/src/lib/manager.ts` — spawns/manages sessions
- **DB writes:** `projects/may-agent/src/lib/db-writer.ts` and `projects/may-agent/src/lib/db/sessions.ts`
- **DB schema:** `projects/may-agent/src/lib/db/schema.ts`
- **Reads:** Apps use scoped SDK execution/Task reads. The Host-private
  `query-service.ts` and explicitly granted maintenance tools are not App SDK APIs.

## Design Decisions

### kind and autoClose define the lifecycle policy

`autoClose` controls lifecycle state only. It never controls filesystem
location and is not a user-facing concept:

- Chat sessions use `autoClose: "never"` → successful turns become `idle`
- Job/call sessions use `autoClose: "immediate"` → completion becomes terminal

Callers don't set it directly — it's derived from `kind`. `autoClose` remains a
lifecycle policy; every kind retains the same permanent session directory and
the design does not move full sessions into SQLite.

### Permanent path invariant

For session `s_123`, every artifact stays below `.state/sessions/s_123/`.
Closing, resuming, process recovery, evaluation, and retention must not rename
that directory. `[ACTIVE]` marks sessions that the runtime may resume; status
in `meta.json` and SQLite records the lifecycle. `[STARTED]` is only a turn/crash
sentinel. Neither marker changes the artifact path.

`kind` ("chat" | "job" | "call") is both an observability tag and a lifecycle
policy selector. `kind: "chat"` with `autoClose: "never"` uses the persistent
chat-turn path (`running → idle`) rather than the bounded job path
(`running → done/error/interrupted`).

Periodic App review uses ordinary input, Task, and attempt execution. See
[Heartbeat](heartbeat.md) for liveness signals and [Cron](cron.md) for optional
time-based input production; neither defines a session kind.

## Tool discovery and exact identity

The agent tool describes bounded helpers owned by the live caller. Both `call`
and `fork` take `task`; scheduling priority belongs to durable work policy,
not a no-op helper argument. Message priority remains receiver context.
Tools should expose implemented controls and derive parameter types from the
same schema given to the model. Session list results retain exact IDs for
subsequent reads or permitted control; only human-readable previews shorten.
[#237](https://github.com/hao1939/may-agent/pull/237) implements this cleanup.

Completion suggestions are saved evidence, not activated behavior. The daemon
registers digest and last-session writers. The unregistered context updater
and file-read tracker are removed by merged
[#238](https://github.com/hao1939/may-agent/pull/238); historical rows and saved
completion facts remain. See the [reporting/adoption convention](../2b-manual/agent-convention.md#reporting-is-not-adoption).
