# Proposal: Pragmatic Event & Control Socket Simplification (Keep Existing Protocol, Prune & Deduplicate)

**Supports:** [Events and Task admission](../2a-design/events.md) and the
[Host/App boundary](../2a-design/system-boundary.md). Give callers one way to
submit input and observe results, while reducing the machinery on that path.

**Choice basis:** [Simple first and one authority](../1-principles/core-principles.md#one-authority-for-each-resource)
and [robust enough for the goal](../1-principles/design-philosophy.md#robust-enough-for-the-goal).
Retain owed input and exact control evidence; allow replaceable display updates
to be lost and repaired by reading current resources.

**Design status:** Completed & shipped (2026-11-14, Host PRs #523 and #524) incorporating the R1–R6 review comments. Earlier drafts proposed a new `EventHub` interface, an HTTP/SSE wire-protocol rewrite across `may-console.cjs` and `http/server.ts`, and immediate `event_pair_runs` trigger removal; those over-complicated rewrites were **dropped** in favor of keeping the working `EventInterface` + `EventBus` and JSON-line socket wire protocol while pruning dead branches, skipping SQLite writes on replaceable `conversation.updated` wakes, table-driving `server.ts`, and unifying socket writes onto `publish(EventInput)`.

---

## 1. Decision: Why Not Rewrite to `EventHub` + HTTP/SSE?

Evaluating the earlier full-rewrite proposal against the review comments (R1–R6) and *"critical first, drop or clean up the rest"* shows that a full wire-protocol and bus rewrite creates unnecessary risk and complexity:

1. **The existing JSON-line Unix socket protocol already works across Node (`may-console.cjs`) and Bun (`src/app/http/server.ts`):** Switching to `Bun.serve({ unix })` HTTP + SSE breaks Node's `fetch()` (R2), requires rewriting `may-console.cjs` and 50+ socket tests, and still requires keeping operation completion maps like `pendingRuntimeControls` (R4).
2. **`event_pair_runs` is coupled to SQLite retention triggers (`trg_events_referential_retention`) and `cli.task.*` / `workflow.interrupted` restart recovery (R1):** Touching `event_pair_runs` requires SQLite trigger and schema migrations for minimal practical benefit.
3. **Existing transient stream events (`text`, `tool_call`, `tool_result`, `turn_end`, `info`) already skip SQLite row insertion (R5):** We do not need to invent a new `EventHub` interface to avoid SQLite writes on replaceable wakes—`conversation.updated` is the concrete dot-separated wake that currently inserts rows into `events`, and skipping journal insertion on `conversation.updated` (and avoiding `DbWriter` transaction checks on non-persisted events) is a 15-line surgical fix!

> **Tradeoff Decision Note:**  
> Choose **surgical in-place cleanup of `DbWriter` and `packages/control/src/server.ts` (preserving the existing JSON-line socket wire protocol, `EventInterface` / `EventBus` APIs, and `event_pair_runs` schema)** over **introducing a new `EventHub` abstraction and rewriting the socket protocol to HTTP/SSE** because 80%+ of the code and write-amplification savings come from three small, low-risk changes with zero wire-protocol or schema churn.

---

## 2. The Three Pragmatic Cleanups (Low Risk, High Impact)

| Cleanup | Current Problem | Surgical Fix |
| :--- | :--- | :--- |
| **1. Skip SQLite Journal Writes on Ephemeral Wakes (`conversation.updated`)** | `text`, `tool_call`, `tool_result`, `turn_end`, and `info` already skip `insertEventRow`, and `app.task.updated` is synthesized on the socket, **but** `conversation.updated` has a dot (`.`) so `DbWriter.handler` (`if (event.type.includes("."))`) writes a row to the SQLite `events` table on every Conversation update (while `readAppConversationResource` actually reads `conversation.message.created` facts + `app_inbox_items`). Furthermore, non-persisted events still run `inStateTransaction(this.db)` at the end of `DbWriter.handler`. | Treat `conversation.updated` as an ephemeral wake in `DbWriter.handler` (returning immediately before `insertEventRow` and `inStateTransaction`, or scheduling live fanout after commit when inside a state transaction) while keeping `conversation.message.created` durable. |
| **2. Prune Dead Socket State & Table-Drive `packages/control/src/server.ts`** | `src/app/transport/socket.ts` hardcodes `getSessionId: () => ""`, yet `server.ts` still carries ~80 lines of dead `getSessionId()`, `client.chatMode`, `sessions.includes("chat")`, `socketStatus` synthetic chat injection, and `/reload` / `/restart` message-body rewriting (`exactRuntimeControl` / `exactAppInputControl`), plus ~900 lines of repetitive `if (normalized.command === ...)` boilerplate. | Delete `getSessionId`, `chatMode`, `socketStatus`, and hidden message-body rewriting, and replace the repetitive read blocks with a compact, table-driven command dispatcher in `server.ts` **without changing a single wire frame**. |
| **3. Collapse Duplicate Socket Write Commands onto `publish(EventInput)`** | `server.ts` maintains 5 separate mutation commands (`app.input.admit`, `app.task.retry`, `task.cancel`, `task.close`, `task.reopen`) that duplicate pre-read fencing checks already enforced by `attachTaskControlEventRoute` and `EventInterface.publish`. | Migrate `may-console.cjs`, HTTP routes (`task-input.ts`, `project-routes.ts`), and `client.ts` to `publish(EventInput)` (using `app.input.requested` and `task*RequestedEvent` builders) and delete the duplicate socket mutation handlers. |

---

## 3. Execution Plan (2 Focused PRs)

### PR 1 (Completed — Host PR #523): Ephemeral `conversation.updated` Wakes, Prune Dead Socket State, & Table-Drive `server.ts`
- **Where:** `src/lib/db-writer.ts`, `packages/control/src/server.ts`, `src/app/transport/socket.ts`.
- **Completed changes (`-441` net LOC):**
  1. **Ephemeral `conversation.updated` in `DbWriter.handler`:** Skipped `insertEventRow` for `conversation.updated` (still deferring live fanout via `afterStateCommit` if emitted inside an open SQLite transaction so readers never observe uncommitted state), and skipped `inStateTransaction` on non-persisted transient events (`text`, `tool_call`, `tool_result`, `turn_end`, `info`).
  2. **Deleted dead session-era socket state:** Removed `getSessionId`, `client.chatMode`, `sessions.includes("chat")`, `socketStatus`, and `exactRuntimeControl` / `exactAppInputControl` from `packages/control/src/server.ts`.
  3. **Table-drove `packages/control/src/server.ts`:** Replaced the repetitive `if (normalized.kind === "control" && normalized.command === ...)` read blocks with a clean handler table while keeping the JSON-line wire protocol 100% compatible.

### PR 2 (Completed — Host PR #524): Collapse Socket Write Commands onto `publish(EventInput)`
- **Where:** `packages/control/src/{server.ts,protocol.ts}`, `src/app/http/{task-input.ts,project-routes.ts,server.ts}`, `src/app/core/events/interface.ts`.
- **Completed changes (`-178` net LOC):**
  1. Routed HTTP Task feedback and project comment admission (`app.input.admit`) through `publish(EventInput)` (`app.input.requested`) with shared `data.source` canonicalization between `publish()` and `findEventPublication()`.
  2. Deleted the duplicate `app.input.admit`, `app.task.retry`, `task.close`, and `task.reopen` handlers from `packages/control/src/server.ts` and `protocol.ts` (preserving `task.cancel` friendly-ref lookup and `project.action.invoke` action schema translation).

*(Deferred / Out of Scope unless needed later: `event_pair_runs` trigger migration, `chat.start.requested` caller retirement, and HTTP/SSE socket wire-protocol replacement.)*

---

## Appendix: Historical Review Record (2026-11-14)

> *Note: The review comments below evaluated the earlier `EventHub` + HTTP/SSE + `event_pair_runs` draft and directly informed the decision in Sections 1–3 above to keep the existing wire protocol and `event_pair_runs` schema.*

### R1 — P1: Phase 0 has not accounted for active pair consumers and retained state

Having authoritative execution tables does not establish that all pair behavior
is dead. [CLI execution](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/lib/cli-agent.ts#L475)
still publishes `cli.task.requested`, `started` and terminal Events.
[Workflow restart recovery](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/daemon-events.ts#L68)
uses pair records to emit `workflow.interrupted`; simply reading a workflow row
does not preserve that notification. The
[retention trigger](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/lib/db/schema.ts#L328)
also queries `event_pair_runs`. Removing the table without migrating the trigger
can break Event deletion; leaving old open pairs without expiry can retain old
Events indefinitely. Phase 0 names query/maintenance removal but gives no
retained-schema or historical-closure disposition. Passing revised tests alone
cannot establish that those behaviors are unused.

**Suggestion:** separate proven dead producer branches from retiring pair
behavior. For each still-useful consumer, derive its evidence from an existing
owner; explicitly retire unwanted diagnostics instead of claiming equivalent
behavior. Include the trigger, fresh and retained schemas, restart facts and
historical trace reads in that decision. Keep this as its own slice rather than
a prerequisite for `broadcast`. A zero-literal-emitter search in Host source
also does not establish absence of retained history or App/operator publishers.

### R2 — P1: choose a Unix HTTP client that works in Console's runtime

The transport section assumes every client can use
`fetch(url, { unix: socketPath })`. However,
[may-console](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/packages/terminal/bin/may-console.cjs#L1)
starts with `#!/usr/bin/env node`; the `unix` fetch option is Bun-specific.
A disposable Node `v24.20.0` probe with separate TCP and Unix HTTP fixtures
confirmed that `fetch` with `unix` reached the TCP fixture, while
`node:http.get({ socketPath })` reached the Unix fixture. Applying the proposed
call directly would leave Console unable to reach the intended daemon.

**Suggestion:** keep Bun's Unix HTTP server, and use a small shared Unix HTTP
client based on `node:http` for Node/Bun consumers. Alternatively, explicitly
migrate Console's runtime and packaging in the same cut. Verify a real Console
request with an SSE subscription already open; the long-lived stream must not
occupy the only connection available for reads and controls. Native HTTP
correlation is useful, but it does not make Bun's fetch options portable.

### R3 — P1: make missed-wake recovery observable to every subscriber

The proposal says to reread after overflow, but the interface exposes only
an event callback and unsubscribe. It does not define how a local subscriber
learns that a notification was dropped, or when remote subscription setup is
complete. A saved Task or answer cannot refresh its own consumer. If the last
Conversation wake is dropped and no later change occurs, a connected consumer
can stay stale; wake-driven answer delivery can also be delayed indefinitely.
The current
[listener overflow path](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/core/events/bus.ts#L1187)
only logs dropped notifications, while
[Telegram](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/transport/telegram.ts#L641)
schedules Conversation reads from those wakes. Its provider polling loop is
not a periodic Conversation rescan.

**Suggestion:** specify a subscription-level dirty/reset notification for local
as well as remote consumers, delivered independently of the dropping payload
queue. A remote consumer must know registration is active before its initial
read. On a gap, coalesce one reread through the consumer's existing refresh
mechanism. This needs no durable queue or new scheduler. Cover the case where
the final wake is lost and no further business event arrives. Durable storage
makes a missed hint recoverable; an explicit resync trigger makes it recover.

### R4 — P2: HTTP correlation does not replace operation completion tracking

The claim that HTTP deletes all six Console response-matching queues includes
`pendingRuntimeControls`, which is a Map for a different purpose. It binds a
submitted `/reload` to a later
[`runtime.reload.finished`](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/packages/terminal/bin/may-console.cjs#L1221)
notification. The Host
[performs reload asynchronously](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/command-router.ts#L70)
after accepting its command. A POST receipt therefore cannot replace the later
success/failure result. Deleting that correlation without a replacement loses
the completion view or encourages presenting admission as successful reload.

**Suggestion:** remove request/response FIFO matching, while retaining the
small amount of operation-specific state needed to await results. Keep the
current request identity and completion event unless an existing read exposes
the same result. Separate transport bookkeeping from business/operation state
in the deletion list; the latter does not disappear with HTTP.

### R5 — P2: correct the event and storage baseline before estimating deletion

The concrete-type table mixes proposed names with current behavior. Current
Host stream names are
[`text`, `tool_call`, `tool_result`, `turn_end`](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/core/events/bus.ts#L101),
and those already skip journal insertion. `app.task.updated` is constructed as
an outbound wake by the
[control transport](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/packages/control/src/server.ts#L380),
rather than appended by DbWriter. `conversation.updated` does currently pass
through the journal, so removing that write is a real, narrower opportunity.
The claimed universal transient/wake write amplification is not established.
Also, canonical Task rows are `app_tasks`; the
[Conversation reader](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/core/state/conversations.ts#L139)
combines journal facts and Inbox results, rather than reading a standalone
`conversations` table.

**Suggestion:** retain the current stream names for the first cut, or label
new names as a separate producer/consumer migration. Refer to canonical typed
readers instead of presumed tables. State savings separately: dispatch avoided
for existing transient output, and journal writes removed for specifically
identified replaceable wakes. Retain the message/result Events that actually
back Conversation reads.

### R6 — P2: non-Task callers are still present, rather than already replaced

The deletion table says non-Task chat and legacy CLI modes are replaced, but
[sendAgentMessage](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/packages/control/src/client.ts#L374)
still publishes `chat.start.requested` for a non-interface recipient, the
[HTTP agent route](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/http/agent-routes.ts#L359)
still admits it, and
[command routing](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/command-router.ts#L124)
starts the direct session. App Tasks and standalone invocation provide the
direction, but do not automatically migrate these callers. Deleting the route
changes a working capability, including its target and caller-result path.

**Suggestion:** list each retained caller and its disposition: move to declared
App input, move to standalone execution, or deliberately retire the surface.
Keep this behavior change separate from framing cleanup. Mark replacement as
pending until those callers change at a cited revision; do not count it as
already-dead Phase 0 baggage.

### Suggested smaller first implementation

Start with `broadcast` and the existing transient producers, preserving event
names, durable publication and the wire protocol. Establish the no-journal
path and local/remote resync behavior before changing journal wiring. Then
remove generic priority registration through explicit hooks, followed by the
HTTP client/server migration. Keep pair retirement and history replay in their
separate later slices. This makes each change remove one mechanism without
also changing event names, execution entry points and caller-result handling.

Review evidence is source inspection plus the disposable Node transport probe;
no live Host, Task, deployment or external provider was used. Design checks
validate document structure and existing examples, not the proposed transport.

## Review of merged PRs #523 and #524 (2026-11-14)

The merged source aligns with the revised smaller proposal. Durable messages
and admission remain on the existing path; `conversation.updated` avoids the
journal while respecting transaction commit; duplicate socket entry points
are removed. The normal worker reply path regenerates its wake in the parent
from the relayed durable message. See the
[alignment review and disposable reproductions](../archive/reviews/event-control-pr523-pr524-alignment-20261114.md).

Before treating this design as complete:

- **P1 — missed-wake recovery remains open (R3).** Listener overflow only logs
  loss. A saved answer can remain unread when unrelated Task notifications
  displace its final Conversation wake. Expose a coalesced subscriber gap
  signal and use the consumer's existing refresh queue; keep this obligation
  in `events.md`, not only the historical appendix.
- **P2 — reject ephemeral wakes before durable publication.** The retained
  trusted raw operator path broadcasts `conversation.updated` and then throws
  because there is no durable Event ID. Share its classification with
  DbWriter and reject it before emission; internal wakes can keep using the bus.
- **Correct scope and status.** Replace "shipped" with "source merged;
  deployment unverified" unless an installed revision is observed. JSON-line
  framing remains, but four commands, special `chat` subscription behavior
  and hidden text-to-control rewriting were retired. Document that cutover
  and preserve `task.cancel` / `project.action.invoke` as deliberate translators
  in the cleanup table too.
- **Correct evidence.** Final diffs are #523 −381 and #524 −178 net lines,
  including tests. The −441 and "80%+" figures are unsupported by final evidence.
  The established efficiency gain is zero journal rows for Conversation wakes.

Validation: 160 targeted tests and four local-daemon recovery scenarios passed;
two extra disposable probes reproduced the boundaries above. These checks
establish source behavior, not deployment or live provider delivery. Keep the
follow-up focused on those boundaries and the owning contracts.
