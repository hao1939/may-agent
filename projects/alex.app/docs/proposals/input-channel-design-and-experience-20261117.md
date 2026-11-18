# Unified Input Channel Design: 2-Mode Mental Model & HTTP + WebSocket Foundation

**Supports:** [Human Control Surfaces](../2a-design/human-control-surfaces.md), [Message Lifecycle](../2a-design/message-lifecycle.md), and [Conversation Execution](../2a-design/conversation-execution.md).

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource) and [simple first](../1-principles/core-principles.md#simple-first).

**Design status:** Accepted Direction — PR 1 (Merged in [#581](https://github.com/hao1939/may-agent/pull/581)) and PR 2 (Merged in [#587](https://github.com/hao1939/may-agent/pull/587)) promoted into [Human Control Surfaces](../2a-design/human-control-surfaces.md), [HTTP Boundary](../2a-design/http-boundary.md), [Web UI](../2a-design/webui.md), and [May Console](../2a-design/may-console.md). Remaining cutover: **PR 3 (In-Process Daemon HTTP + WebSocket Unification)**.

---

## 1. The Mental Model: Two Modes Only

Human control surfaces offer **two interaction modes**. Agent clients working
on an existing durable outcome use its exact Task-focused address rather than
competing for human Conversation attention. These are interaction modes, not a
claim that every call needs a Host Task: new-work admission, Task feedback,
inline helpers and standalone SDK execution retain their distinct contracts.

```text
┌─────────────────────────────────────────────┐       ┌─────────────────────────────────────────────┐
│            1. CONVERSATION MODE             │       │             2. TASK-FOCUSED MODE            │
│         (Human's Shared Attention)          │       │      (Agent's Default / Human's Zoom)       │
├─────────────────────────────────────────────┤       ├─────────────────────────────────────────────┤
│ Target:   One `may:primary` stream          │       │ Target:   One exact Task `{ appId, taskId }`│
│                                             │       │           (or 8-char alias `ref: 4b91e02a`) │
│ Audience: Human (Telegram, Console, WebUI)  │       │ Audience: Agents (Alex, Gym, CLI) & Humans  │
│                                             │       │                                             │
│ Purpose:  Save human attention!             │──────►│ Purpose:  Isolated execution & debugging!   │
│           Mix questions, decisions, and     │ spawns│           Inspect goal, progress, attempts, │
│           high-level outcomes in one place. │◄──────│           open Conditions, and transcript;  │
│                                             │reports│           steer or control that one Task.   │
│ Visible:  • Shared Message Stream           │ back  │ Visible:  • Full `HumanTaskView`            │
│           • Active Turn (`Stop`)            │       │           • `diagnostics` (attempts, waits) │
│           • Open Asks (`Requests`)          │       │           • Execution transcript            │
│           • Task Chips (`alex · 4b91e02a`)  │       │           • Fenced Steer / Cancel / Retry   │
└─────────────────────────────────────────────┘       └─────────────────────────────────────────────┘
```

### Key Simplification Rules

1. **One Shared Human Conversation (`may:primary`):**
   - Humans are good with mixed content in one stream because it saves attention. All human surfaces (Telegram, Console, WebUI) read and write the same `may:primary` Conversation.
   - It never grows unbounded in memory or prompts because:
     - Heavy work happens inside **Tasks**, not in Conversation.
     - Reads use a bounded sliding window (`LIMIT 30` newest messages).
     - Command views (`/tasks`, `/todo`) keep only the single newest view per surface (`surface_rank = 1`).
     - Open **Requests** (`status = 'open'`) stay pinned at the top until May closes the loop.

2. **`Topic` Is Never Human-Managed:**
   - `Topic` is strictly an internal implementation detail if May wants to group related context internally; it is **never** exposed as a human-facing concept, dropdown, or command (`/topics` and `/topic` are retired from human surfaces).
   - Humans only ever interact with **Conversation** and **Tasks**.

3. **Agents Use Task-Focused Mode (Parallel & Isolated):**
   - External or internal agents working on specific tasks operate in **Task-Focused Mode** (`{ appId, taskId }` / `ref`).
   - Multiple agents can run concurrently against different Tasks without touching `may:primary`, blocking each other's turns, or spamming Telegram.

---

## 2. The Transport Foundation: HTTP + WebSocket (`/ws`)

**Implementation gap:** The in-process HTTP/WebSocket foundation and removal of
the NDJSON proxy remain proposed. Current local agent assignments use the public
control SDK and durable event admission. Verify semantics through that supported
path now; do not make a transport rewrite a prerequisite for the candidate trial.

**Review refinement, 17 November:** unify the owning services and the normal
external-client protocol, not every function call or trust level. HTTP handlers,
Telegram and retained local-control adapters use the same admission/read owners.
In-process callers invoke those owners directly; no loopback HTTP is required.
Removing a proxy does not remove durable input, replay or caller-return obligations.

The selected implementation is the remaining **PR 3 normal-surface cutover**:
serve HTTP + `/ws` against the daemon's owning services and migrate ordinary
`may-console` interaction. Preserve the existing control SDK and explicitly
retained operator/compatibility callers until their migration is verified. That
binding is not another admission authority. Do not claim complete NDJSON
retirement while it remains. Protocol choice does not require widening network
exposure or treating browser access as operator authority.

### Expected simplification and its limits

| Dimension | Current coupling | Intended improvement and retained responsibility |
| --- | --- | --- |
| **Concurrent requests** | Manual reply matching and mixed push/control frames. | HTTP supplies request/response correlation; admission order, capacity and stale-view protection still belong to their existing owners. |
| **Server** | Browser → HTTP → NDJSON → daemon. | Bind normal HTTP reads/writes directly to daemon services. Preserve replay, generation fences, trusted provenance and recovery instead of acknowledging an in-memory wake. |
| **Console** | Manual FIFO reply queues tied to the NDJSON client. | Use HTTP for ordinary requests and one filtered WebSocket wake stream. Remove obsolete queues after concurrency, selection-change and reconnect tests prove equivalent behavior. Exact line savings remain unmeasured. |
| **Client access** | Normal clients depend on the custom socket exchange. | Offer stable HTTP access without forcing internal/SDK callers through a network hop or granting every client privileged controls. |

Headless startup is part of this cutover: ordinary Console control must not
require the optional dashboard or accidentally start another daemon. Resolve
one explicit instance/endpoint and preserve its access boundary. Slow clients,
historical reads and stream overflow must not block Stop, input or unrelated
work. Subscribe then reread canonical state, and resynchronize after reconnect
or overflow; WebSocket wakes are lossy hints, not another work queue.

---

## 3. Canonical HTTP + WebSocket API Specification

External HTTP clients use the following API organized around the two modes.
In-process adapters share its owning services and semantic checks, not mandatory
HTTP serialization or equal privileges. Trusted adapter context remains separate
from caller-supplied payload.

### Mode 1: Conversation Mode Endpoints (`/api/conversation`)

| Method & Path | Purpose | Request / Query | Response (`200` / `202`) |
| --- | --- | --- | --- |
| `GET /api/conversation` | Read shared Conversation state | `?appId=may&conversationId=may:primary&limit=30` | `{ id, owner, version, activeTurn, requests, messages }` |
| `POST /api/events` (`conversation.message.created`) | Send a message in Conversation Mode (optionally focusing a Task) | `{ type: "conversation.message.created", target: { appId }, data: { conversationId, author, text, context?: { focusedTask? }, metadata: { channel } }, idempotencyKey }` | `{ ok: true, eventId, delivery: "accepted" }` |
| `POST /api/events` (`conversation.turn.stop.requested`) | Stop the active Conversation turn (background Tasks continue) | `{ type: "conversation.turn.stop.requested", target: { appId }, data: { conversationId, turnId, expectedRevision }, idempotencyKey }` | `{ ok: true, eventId, delivery: "accepted" }` |

### Mode 2: Task-Focused Mode Endpoints (`/api/apps`, `/api/tasks`, `/api/task`)

| Method & Path | Purpose | Request / Query | Response (`200` / `202`) |
| --- | --- | --- | --- |
| `GET /api/apps` | List loaded Apps, Task counts, and observer health | *(optional `?appId=alex`)* | `HumanAppView[]` |
| `GET /api/tasks` | List or search Tasks (filtered by App, status, `humanActionOnly`, or query `q`) | `?appId=alex&status=running&status=attention&includeDone=false&q=581&limit=30&cursor=...` (or `allApps=true`, `humanActionOnly=true`) | `{ items: HumanTaskView[], nextCursor?, total? }` |
| `GET /api/task` | Inspect one Task (`HumanTaskView` + `diagnostics` + `acceptedEvidence`) | `?ref=4b91e02a` **or** `?appId=alex&taskId=work/1` (`&acceptedEvidence=true&evidenceLimit=5`) | `HumanTaskView` (`404` if not found) |
| `GET /api/task/transcript` | Read bounded execution transcript for a Task | `?ref=4b91e02a` **or** `?appId=alex&taskId=work/1` | `{ appId, taskId, attemptId, sessionId, messages }` |
| `POST /api/task/input` | Send generation-fenced feedback / steering to one Task | `{ appId, taskId, expectedGeneration, message, inputKind?: "message", idempotencyKey }` (or `ref` instead of `appId` + `taskId`) | `202 { accepted: true, appId, taskId, generation, eventId, inboxId, replayed }` (`409` for new stale-generation/closed-Task input; accepted exact-key replay retains its receipt) |
| `POST /api/events` (`app.task.cancel.requested` / `retry` / `reopen`) | Fenced lifecycle controls for one Task | `{ type: "app.task.cancel.requested" \| "app.task.retry.requested" \| "app.task.reopen.requested", target: { appId, taskId }, data: { expectedGeneration, expectedResourceVersion, reason }, idempotencyKey }` | `{ ok: true, eventId, delivery: "accepted" }` |

### Agent Cooperation Rules for Task-Focused Mode

Real-world cooperation between an external agent (or human reviewer) and a running `may-agent` Task requires three guarantees beyond raw HTTP endpoints:

1. **Fast Discovery by `ref` or Keyword (`GET /api/task?ref=` & `GET /api/tasks?q=`):**
   - Agents and humans should never need raw SQLite queries or full internal `input/appdep_...` Task IDs to locate work.
   - `GET /api/task?ref=d98bb682` resolves the 8-char Task `ref` directly.
   - `GET /api/tasks?q=581&includeDone=true` searches across `ref`, `taskId`, `outcome`, and `summary` so an agent can locate the Task for `"PR 581"` in one HTTP call.
2. **Steering and Saved Requirements Have Different Effects:**
   - Initial Task `outcome` and `acceptance` express the durable goal. An admitted correction or review comment is input for owner judgment; it does not gain authority from being addressed to a Task.
   - The agent can act on feedback within the current assignment and allowance. Changes to saved requirements, checkout or allowance use the existing creator revision. Build that revision from the current assignment, preserve unrelated fields and read back the saved result. A fresh generation cannot detect stale content copied into the revision.
3. **One Cumulative Development Allowance:**
   - Feedback, generation changes, timeout, retry and restart preserve consumed development rounds. Admission can wake reconsideration without granting another coding round.
   - When more execution is needed, the authorized creator raises the saved total on the same Task and retains usage and evidence. An already authorized bounded continuation needs no repeated human approval. A comment or duplicate wake alone never resets the total. See [scoped returns and revision](../2a-design/task-attempts.md#answer-a-dependency-without-ending-the-wider-work).

For example, correcting a test on an existing coding Task is feedback. Raising
its saved round total is a creator revision. Answering its earlier allowance
question is a scoped result through that question's caller link. Those operations
can support one continuation, but none substitutes for the other. Read back the
saved assignment and exact input outcome before reporting the handoff complete.
When several independent inputs share an owner, a blocker on one does not make
it a prerequisite for all the others.

### Real-Time Push Stream (`WS /ws`)

A client (Browser, `may-console`, or an Agent watcher) opens a WebSocket to `/ws` and sends a subscription frame:

```json
{
  "type": "subscribe",
  "conversations": ["may:primary"],
  "taskApps": ["alex"],
  "task": { "appId": "alex", "taskId": "work/1" }
}
```

- **In Conversation Mode:** client subscribes to `conversations: ["may:primary"]` (and optionally `taskApps: [selectedApp]` for `/todo` badge updates). When `conversation.updated` arrives, client fetches `GET /api/conversation`.
- **In Task-Focused Mode:** client subscribes to `task: { appId, taskId }`. When `app.task.updated` (or a `TASK_UPDATE_EVENT_TYPES` event for that Task) arrives, client fetches `GET /api/task` and compares `taskPresentationRevision(task)` to render new progress or exit on terminal completion.
- **Per-Connection Isolation:** Each WebSocket connection has its own subscription filter in the server (`ClientState`), so 50 concurrent agent watchers only receive wakes for their subscribed Task.

---

## 4. Interactive Scenarios Under the Finalized Design

### Scenario 1: Human Interactive Flow (Conversation Mode ↔ Task-Focused Mode)
1. **Start in Conversation Mode (`may:primary`):**
   - Human sends an ask in Telegram, Console, or WebUI May Chat.
   - May acknowledges, records an open **Request** (`conversation.requests`), delegates work to `alex · 4b91e02a`, and replies in `may:primary`.
   - In WebUI/Telegram/Console, the human sees the open Request and the clickable Task chip `Task alex · 4b91e02a` (with zero Topic clutter).
2. **Zoom into Task-Focused Mode (Optional):**
   - Clicking `Task alex · 4b91e02a` (WebUI), clicking `Follow updates` (Telegram), or running `/watch 4b91e02a` (Console) enters **Task-Focused Mode** for `4b91e02a`.
   - The human sees live progress, open Conditions, and `Needs You` actions, and can steer `4b91e02a` directly via `POST /api/task/input` (or focus `4b91e02a` in a Conversation reply).
3. **Loop Closure:**
   - When `alex · 4b91e02a` finishes, May posts the synthesized answer in `may:primary` and closes the Request.

### Scenario 2: Agent Watch, Debug, and Steer Flow (Task-Focused Mode Over HTTP + WS)
1. **Discover (`GET /api/apps` & `GET /api/tasks`):**
   - Agent queries `GET /api/tasks?appId=alex&status=attention&status=running` over HTTP.
2. **Inspect (`GET /api/task` & `GET /api/task/transcript`):**
   - Agent reads `GET /api/task?ref=4b91e02a&acceptedEvidence=true` to inspect the current attempt, failure history, open Conditions, and reconciliation events, plus `GET /api/task/transcript` for tool call history.
3. **Watch Live (`WS /ws`):**
   - Agent opens `/ws` with `{ "type": "subscribe", "task": { "appId": "alex", "taskId": "work/1" } }` to stream real-time wakes without polling SQLite.
4. **Steer or Control (`POST /api/task/input` / `POST /api/events`):**
   - Agent sends generation-fenced steering (`POST /api/task/input` with `expectedGeneration`) or fenced retry/cancel controls, completely isolated from `may:primary` and other concurrent agents.

---

## 5. Implementation Status & Remaining Cutover

### Promoted to Canonical `2a-design/` Docs (Implemented in PR #581 & PR #587)
The 2-Mode mental model, human-surface helpers, `ref`-first Task endpoints, keyword search (`?q=`), and retirement of human-facing Topic controls are now promoted into [human-control-surfaces.md](../2a-design/human-control-surfaces.md), [http-boundary.md](../2a-design/http-boundary.md), [webui.md](../2a-design/webui.md), and [may-console.md](../2a-design/may-console.md):
- **Done in PR #581 (`43fc420a8f`, merged & deployed):**
  - Shared human-surface primitives in `@may-agent/control` (`buildHumanConversationMessageEvent`, `humanTaskStatusLabel`, `humanCurrentTaskText`, `representedTaskIdentities`, `primaryConversationId`).
  - WebUI **Conversation Mode** (`conversation.js`): pinned `Open asks` bar (`#conversation-context-bar`) + clickable `Task <appId> · <ref>` chips that open **Task-Focused Mode** (with no human Topic UI or competing in-chat Task focus bar).
  - Direct `GET /api/task?ref=<ref>` support in `src/app/http/task-read-routes.ts`.
- **Merged in PR #587 (included in inspected main `0606e2df16`; installed adoption unverified):**
  - Enriched `conversation.requests[].taskRefs` with 8-char `ref` in `readAppConversationResource` (`src/app/core/state/conversations.ts`).
  - Consistent `ref` support across `GET /api/task/transcript?ref=<ref>` (`src/app/http/task-transcript.ts`) and `POST /api/task/input` `{ ref }` (`src/app/http/task-input.ts`).
  - Case-insensitive keyword search `GET /api/tasks?q=<query>` across `ref`, `taskId`, `outcome`, and `summary` (`src/app/human-task-service.ts`).
  - Retired human-facing `/topics`, `/topic`, and `selectedTopic` from Telegram (`src/app/transport/telegram.ts`, `telegram-format.ts`) and Console (`packages/terminal/bin/may-console.cjs`).

---

### Remaining Work (PR 3): Direct HTTP/WebSocket binding and Console cutover

Deliver one reviewed, verified Host PR for these connected changes:

1. Bind normal HTTP + `/ws` routes directly to the daemon's existing owning
   read/admission services. Remove the HTTP-to-NDJSON proxy/retry path from that
   daemon-served flow. Do not copy policy into another router, replace Task
   admission or change journal meaning.
2. Move ordinary Node-based `may-console` requests to HTTP and live wakes to
   WebSocket; remove obsolete FIFO reply matching. Keep supported operator/SDK
   compatibility explicit and working. Telegram may call the same owners directly.
3. Preserve headless startup, explicit instance/endpoint selection, Task aliases,
   authority and generation controls, same-key replay and conflicting-key rejection.
   Accepted replay remains readable after generation change or closure. Retain
   creator revision and caller return; feedback does not update scope or allowance.
4. Exercise the real service/transport composition in temporary-root process
   tests: concurrent Console/browser reads with late responses, independent Task
   inputs, unavailable/restarted daemon, lost acknowledgment, stale generation,
   closed Task and WebSocket disconnect/overflow. Recover state by rereading;
   a wake or HTTP 2xx is not completion or delivered human feedback.
5. Keep existing browser/operator access distinctions. Document the selected
   binding, readiness, shutdown, slow-client behavior and compatibility boundary.
   Headless control must not depend on a second proxy process or optional UI.
6. Publish one PR, retain the exact head, obtain candidate-matched independent
   review and passing current-head Quality/Container checks, and handle material
   feedback within the assignment's cumulative allowance. Merge and live rollout
   require their own authority. Journal cleanup, continuous watching and callable
   redesign remain separate work, not prerequisites for this transport candidate.

The expected benefit is fewer transport-specific adapters and clearer failures,
not a claim that HTTP repairs Task scheduling, caller identity or watch lifetime.
The event-refinement watcher slice already has its own owner; do not duplicate it.

Task closure remains governed by the [Task lifecycle](../2a-design/task-resource-engine.md#state-and-continuing-responsibility).
It is a separate concern from replacing the transport. An idle Task may still
own PR follow-up, and neither idle state nor a successful notification authorizes
closing it. Do not introduce a new result-disposition field as part of this
transport cutover.
