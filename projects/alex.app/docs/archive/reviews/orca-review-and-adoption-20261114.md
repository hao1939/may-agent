# Learning from `stablyai/orca`: Coalesced Wakes, SQLite WAL Hygiene, and Declarative Control Dispatch

**Supports:** [Purpose and value](../1-principles/purpose.md) through [Events and Task admission](../2a-design/events.md), [Storage](../2a-design/storage.md), and the [Host/App boundary](../2a-design/system-boundary.md). Reduce event and storage overhead on the live Host path while ensuring wake-driven consumers never silently miss a final state update.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first), [one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource), and [robust enough for the goal](../1-principles/design-philosophy.md#robust-enough-for-the-goal). Keep durable state in SQLite (`app_tasks`, `app_inbox_items`, `events`) and treat live wake notifications as replaceable invalidations that coalesce into a single re-read rather than a bounded FIFO payload queue that can silently drop the last wake.

**Status:** Draft proposal for review (2026-11-14). Compares [`stablyai/orca`](https://github.com/stablyai/orca) at [`c445f7dbc1af22eb360bf6838a9a123ba0f9cf03`](https://github.com/stablyai/orca/tree/c445f7dbc1af22eb360bf6838a9a123ba0f9cf03) against `may-agent` `origin/main` at [`f13f94d12d`](https://github.com/hao1939/may-agent/commit/f13f94d12d) (after Host PRs [#520](https://github.com/hao1939/may-agent/pull/520), [#523](https://github.com/hao1939/may-agent/pull/523), and [#524](https://github.com/hao1939/may-agent/pull/524)). No source merge or document edit establishes live activation.

---

## 1. What the Comparison Teaches

Both `stablyai/orca` and `may-agent` coordinate long-running coding agents across local/remote worktrees, terminals, and structured conversations backed by synchronous SQLite in WAL mode. Where `may-agent` provides a generic Host with programmable Apps (`alex.app`, `may.app`, `aks-rp-e2e.app`) and declarative Task reconciliation (`app-task-reconciler.ts`), Orca is a multi-host desktop/CLI/mobile supervisor for interactive coding agents (`claude`, `codex`).

Inspecting Orca's runtime (`src/main/runtime/`) against `may-agent`'s current implementation highlights **where `may-agent` is already stronger** and **four concrete mechanisms where Orca is simpler or safer**:

| Question | `stablyai/orca` (`c445f7dbc1`) | `may-agent` (`f13f94d12d`) | Proposed `may-agent` Action |
| :--- | :--- | :--- | :--- |
| **How do state changes wake live consumers (UI, socket, Telegram)?** | **105 LOC total** (`src/main/runtime/events/` + `crew-changes.ts` + `runtime-message-waiters.ts`): synchronous SQLite commit + dirty-facet invalidation + `queueMicrotask` coalescing. Never drops a final wake. | **`EventBus` listener queue (`src/app/core/events/bus.ts`, 1,379 LOC):** 256-slot FIFO payload queue (`EVENT_LISTENER_BACKLOG_LIMIT = 256`) that drops overflowed events with a `console.error`, leaving wake-driven readers like Telegram (`src/app/transport/telegram.ts:641`) stale if the final wake is dropped ([R3](control-socket-simplification.md#r3--p1-make-missed-wake-recovery-observable-to-every-subscriber)). | **Candidate 1 (High Priority):** Replace bounded FIFO wake dropping with per-subscriber dirty-key coalescing (`app.task.updated` / `conversation.updated`) and an explicit `onResync` callback on overflow. |
| **How are SQLite WAL high-water size and savepoint temp files bounded?** | `OrchestrationDb` (`src/main/runtime/orchestration/db/orchestration-db.ts:44–49`) sets `PRAGMA journal_size_limit = 8388608` (8 MiB WAL truncation cap) and `PRAGMA temp_store = MEMORY` on every writable connection, and guards `ROLLBACK` with `if (!db.isTransaction) return`. | `src/lib/db/connection.ts`, `state-db.ts`, and `app-task-resource-store.ts` set `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;` without `journal_size_limit` or `temp_store = MEMORY`. | **Candidate 2 (High Priority):** Add `PRAGMA journal_size_limit = 8388608; PRAGMA temp_store = MEMORY;` to writable SQLite connections in `src/lib/db/connection.ts` and `app-task-resource-store.ts`. |
| **How is NDJSON socket framing bounded and parsed?** | `createIncrementalNdjsonFramer` (`src/shared/main-process-ndjson-framer.ts`) scans with `input.indexOf('\n', cursor)` ($O(N)$), enforces `maxLineBytes` *before* joining chunks, and detaches retained tails from V8 `SlicedString` parent buffers. | `packages/control/src/{client.ts,server.ts}` use `buffer.split("\n")` on every `data` chunk ($O(N^2)$ on multi-chunk responses) without an pre-parse line-byte cap or V8 `SlicedString` detachment. | **Candidate 3 (Medium Priority):** Replace `buffer.split("\n")` in `packages/control/src/{client.ts,server.ts}` with an $O(N)$ `indexOf("\n", cursor)` loop and a bounded line-length guard. |
| **How is the Unix control socket path owned across restarts?** | `src/main/daemon/AGENTS.md`: binds a private scratch socket, proves any incumbent at the canonical path is dead (`ECONNREFUSED`), atomically `rename()`s onto the canonical path, and **never** unlinks the canonical path on shutdown unless inode-verified. | `packages/control/src/server.ts:1278` calls `unlinkSync(socketPath)` in `cleanup()` on `exit` without checking `statSync(socketPath).ino`, which can delete a replacement daemon's newly bound socket during overlapping restarts. | **Candidate 4 (Medium Priority):** Record `boundInode = statSync(socketPath).ino` after `listen()` and only `unlinkSync(socketPath)` in `cleanup()` when the current inode still matches `boundInode`. |
| **How are Task/Worker state transitions enforced?** | `transitionLifecycleWithDb` (`src/main/runtime/orchestration/db/lifecycle-transition.ts`, 175 LOC) validates every state change against a single declarative `LEGAL_TRANSITIONS` table and executes one CAS `UPDATE ... WHERE id = ? AND state IN (...)`. | `AppTaskResourceStore` + `app-task-reconciler.ts` own rich Kubernetes-style `spec`/`status`/Conditions and `PendingTaskSettlement` replay, which are more expressive than Orca's flat worker states. | **Keep May's Task Resource Engine**, and optionally extract a small declarative phase-transition table for readability when touching `app-task-store.ts`. |
| **How are agent skills structured for prompt efficiency?** | `skill-guides/orchestration.md` is **128 lines**, delegating edge cases (recovery, placement, gates) to 5 tiny on-demand `references/*.md` files (15–90 lines each). | Already adopted in May's `2b-manual/<name>/SKILL.md` layout ([Host #452](model-surface-and-prompt-hygiene-20261111.md)); continue enforcing compact entry skills with on-demand references. | **Already aligned** with [model surface and prompt hygiene](model-surface-and-prompt-hygiene-20261111.md). |

---

## 2. Detailed Proposals (Ordered by Value-to-Complexity Ratio)

### Candidate 1: Coalesced Wake Invalidations & Explicit Missed-Wake Resync (Solving R3)

#### Problem in `may-agent` Today
In `src/app/core/events/bus.ts:1165–1215`, `EventBus.on()` queues full `Event` objects in a 256-slot per-listener array (`EVENT_LISTENER_BACKLOG_LIMIT = 256`). When a burst of stream tokens (`text`, `tool_call`) or batch Task settlements exceeds 256 queued items:
1. `bus.ts` drops the oldest queued event and logs a warning (`[event-bus] listener backlog exceeded...`).
2. Local wake-driven consumers—most notably Telegram (`src/app/transport/telegram.ts:641`, which schedules `readAppConversationResource` only when `conversation.updated` arrives) and control-socket subscribers (`packages/control/src/server.ts:375`, which emit `app.task.updated` / `conversation.updated`)—receive **no resync signal** if the final wake in a burst is dropped and no subsequent business event arrives. That is the exact defect identified in [Control Socket Review R3](control-socket-simplification.md#r3--p1-make-missed-wake-recovery-observable-to-every-subscriber).

#### How Orca Solves It (`src/main/runtime/events/` & `runtime-message-waiters.ts`)
Orca separates **stream payloads** from **resource invalidation wakes**:
* `CrewChanges` (`src/main/runtime/orchestration/crew/crew-changes.ts`, 21 LOC) and `RuntimeMessageWaiters.notifyRouted` (`src/main/runtime/orchestration/mailbox/runtime-message-waiters.ts`, 140 LOC) never push replaceable wakes through a bounded FIFO queue that can drop the last item.
* Instead, invalidations mark a **dirty key set** (`Set<string>`) and flush once per microtask (`queueMicrotask`) after the SQLite transaction commits. Whether 1 or 10,000 updates happen in the same tick for `(appId, conversationId)` or `(appId, taskId)`, the dirty set holds at most 1 entry per resource key—**$O(\text{distinct resources})$ memory, zero dropped final wakes, and 1 coalesced re-read per tick**.

#### Proposed Change in `may-agent` (~60 LOC net, zero wire-protocol break)
1. **In `src/app/core/events/bus.ts` (Listener Delivery):**
   * Partition each listener's pending queue into:
     * `fifoQueue`: ordered stream events (capped at `EVENT_LISTENER_BACKLOG_LIMIT = 256`).
     * `coalescedWakes: Map<string, Event>`: replaceable resource wakes (`conversation.updated` keyed by `conversation:${appId}:${conversationId}`, and Task wake events keyed by `task:${appId}:${taskId}`). Replacing an existing key in `coalescedWakes` updates the latest wake in-place without consuming a FIFO slot or ever dropping the final wake!
   * Add an optional `onOverflow?: () => void` callback (or deliver a synthetic `{ type: "subscriber.resync.required" }` notification once when `fifoQueue` overflows and drains) so any subscriber can trigger a single authoritative re-read on gap recovery.
2. **In `packages/control/src/server.ts` (Outbound Socket Wakes):**
   * Coalesce outbound `app.task.updated` and `conversation.updated` frames per connected client across the current microtask (`pendingTaskWakes: Map<string, ...>`, `pendingConversationWakes: Map<string, ...>` flushed via `queueMicrotask`), while keeping `sessions` stream frames synchronous and ordered.

---

### Candidate 2: SQLite WAL Size Cap (`journal_size_limit`) & In-Memory Savepoint Journals (`temp_store = MEMORY`)

#### Problem in `may-agent` Today
In `src/lib/db/connection.ts`, `src/app/http/read-model/state-db.ts`, and `src/app/core/state/app-task-resource-store.ts`, writable SQLite connections run:
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
```
Without `PRAGMA journal_size_limit`, SQLite's `.state/may.db-wal` file **never shrinks after a checkpoint** unless truncated explicitly; a single large migration or batch test run leaves `-wal` permanently at its high-water mark on disk. And without `PRAGMA temp_store = MEMORY`, nested SQLite `SAVEPOINT` journals or large `ORDER BY` temp B-trees spill to `/tmp` (`SQLITE_IOERR_GETTEMPPATH` / disk-full aborts when `/tmp` is constrained).

#### How Orca Solves It (`src/main/runtime/orchestration/db/orchestration-db.ts:44–49`)
Every writable database in Orca sets:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA journal_size_limit = 8388608; -- Truncate WAL back to 8 MiB after checkpoint
PRAGMA temp_store = MEMORY;          -- Keep savepoint journals in RAM
```
And in `rollbackLifecycleWriteTransaction` (`lifecycle-transition.ts:34`), Orca checks whether SQLite already auto-aborted the transaction (e.g. on `SQLITE_FULL` or `SQLITE_IOERR`) before running `ROLLBACK`, so the original I/O error is never masked by `"cannot rollback - no transaction is active"`.

#### Proposed Change in `may-agent` (~15 LOC)
* Set `PRAGMA journal_size_limit = 8388608; PRAGMA temp_store = MEMORY;` on writable connections in `src/lib/db/connection.ts` and `src/app/core/state/app-task-resource-store.ts`.

---

### Candidate 3: $O(N)$ Incremental NDJSON Framing with Line-Length Guard (`packages/control`)

#### Problem in `may-agent` Today
Both `packages/control/src/server.ts:442` and `packages/control/src/client.ts:108` frame incoming socket chunks via:
```ts
buffer += chunk.toString();
const lines = buffer.split("\n");
buffer = lines[lines.length - 1];
```
When a query (`app.tasks.list`, `query.events`, `query.sql`) returns a multi-hundred-KB payload across many socket `data` events, `buffer.split("\n")` re-scans and re-allocates the incomplete line on every chunk ($O(N^2)$). Moreover, `lines[lines.length - 1]` retains a V8 `SlicedString` view into the parent chunk buffer.

#### How Orca Solves It (`src/shared/main-process-ndjson-framer.ts`)
Orca scans with `let nl = buffer.indexOf("\n", cursor)` in $O(N)$ time, enforces a `maxLineBytes` ceiling (16 MiB) before parsing, and detaches retained tails so an idle socket never pins a large parent string in V8 heap memory.

#### Proposed Change in `may-agent` (~35 LOC)
* Extract a shared 35-line `consumeNdjsonLines(buffer, chunk, onLine, maxLineBytes)` helper in `packages/control/src/protocol.ts` and use it in both `server.ts` and `client.ts`.

---

### Candidate 4: Inode-Verified Socket Cleanup on Shutdown (`packages/control/src/server.ts`)

#### Problem in `may-agent` Today
In `packages/control/src/server.ts:1276–1282`:
```ts
const cleanup = () => {
  try {
    if (existsSync(socketPath)) unlinkSync(socketPath);
  } catch { /* ignore */ }
};
```
If a new Host daemon binds `may.sock` before the exiting daemon's `exit` handler runs `cleanup()`, the old process unlinks the **new** daemon's live socket file, leaving the new Host unreachable over `may.sock`.

#### How Orca Solves It (`src/main/daemon/AGENTS.md`)
Orca treats canonical socket path ownership as a strict invariant: a daemon may only touch a socket path if it proves it still owns the inode it bound.

#### Proposed Change in `may-agent` (~10 LOC)
* Capture `const boundInode = statSync(socketPath).ino` immediately after `server.listen(socketPath)` succeeds, and in `cleanup()` only call `unlinkSync(socketPath)` when `statSync(socketPath).ino === boundInode`.

---

## 3. Recommended Execution Sequence

Each candidate above is self-contained, preserves all existing Host/App contracts and wire formats, and can be verified independently:

1. **Slice 1 (Wake Reliability + Socket Hygiene — Candidates 1, 3, & 4):**
   * Coalesce replaceable wakes (`conversation.updated`, Task wakes) in `EventBus` listener queues and `packages/control/src/server.ts` so bursts never drop a final wake (closing [R3](control-socket-simplification.md#r3--p1-make-missed-wake-recovery-observable-to-every-subscriber)).
   * Add $O(N)$ `indexOf("\n")` framing and inode-verified socket `cleanup()` in `packages/control`.
   * **Verification:** Add unit tests in `src/app/core/events/bus.test.ts` and `packages/control/src/control-socket.test.ts` proving that a 1,000-event burst of `text` + `conversation.updated` never drops the latest `conversation.updated` wake and triggers at most one coalesced socket wake per tick, and that a replacement server's socket inode survives an old server's `close()`.
2. **Slice 2 (SQLite WAL & Savepoint Hygiene — Candidate 2):**
   * Add `PRAGMA journal_size_limit = 8388608; PRAGMA temp_store = MEMORY;` to writable SQLite connections in `src/lib/db/connection.ts` and `src/app/core/state/app-task-resource-store.ts`.
   * **Verification:** Assert `PRAGMA journal_size_limit` (`8388608`) and `PRAGMA temp_store` (`2` / `MEMORY`) in `src/lib/db/connection.test.ts`.
