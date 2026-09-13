# Sessions

**Design status:** Accepted.
**Implementation status:** Implemented, including per-turn trace propagation,
fail-closed start persistence, and terminal error persistence. Execution limits
and standalone recovery retain [consolidation gaps](../proposals/execution-entrypoint-consolidation.md).

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
Heartbeats are `call` sessions spawned by a bounded heartbeat workflow through
`ctx.agents.call()`. Query by their source/correlation, not by `kind`.

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

## Session Tree

```
Root (May heartbeat)
  ├── call("tech-lead", task)          ← child (blocks parent)
  │     └── call("dev", subtask)       ← grandchild
  └── fork("dev", task)                ← caller-owned helper (returns immediately)
```

- **call** = awaited result; agent calls carry `parentSessionId` where available
- **fork** = asynchronous, returns sessionId, child linked via `parentSessionId`

Workflow steps also carry `workflowRunId`; a workflow without a parent agent
session need not invent one. Task ownership uses the exact runtime-supplied
Task/attempt binding, not either lineage field. Trace links describe event
causality. The [cooperation contract](agents.md) owns helper lifetime; current
generic fork/recovery behavior does not fully enforce it.

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

**Candidate limitation:** the [feedback PoC](../archive/reviews/execution-feedback-poc-20260913.md)
removes manager silence cancellation only when both a Task binding and a finite
positive admitted timeout are present. Other managed non-chat entries can still
receive the five-minute no-observation deadline, even with a configured total
timeout. This is a remaining implementation inconsistency, not an accepted
alternative policy. The [consolidation proposal](../proposals/execution-entrypoint-consolidation.md)
requires verified bounds and cleanup before deleting that path and the separate
error-count cancellation. Idle chat context does not need a lifetime deadline.

An interrupted `call` returns to its caller; generic session auto-resume must
not start it again independently. The owning workflow or Task decides the next
bounded attempt using current state. Otherwise a timed-out call can keep editing
after its workflow settled, outside Task capacity and result fencing. Explicit
cancellation is likewise not an automatic retry request. Existing automatic
standalone `job` resume is a migration gap: durable obligations belong to Tasks;
local invocations return to their caller. Keep explicit permitted user resume
and stale-state/process cleanup without inventing another work owner.

## Data Retention

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

Heartbeats are `call` kind sessions—the workflow uses `ctx.agents.call()`,
which produces a call session. There is no separate `heartbeat` kind.
