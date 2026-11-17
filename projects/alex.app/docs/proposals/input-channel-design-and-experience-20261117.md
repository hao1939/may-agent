# Unified Input Channel Design: 2-Mode Mental Model & HTTP + WebSocket Foundation

**Supports:** [Human Control Surfaces](../2a-design/human-control-surfaces.md), [Message Lifecycle](../2a-design/message-lifecycle.md), and [Conversation Execution](../2a-design/conversation-execution.md).

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource) and [simple first](../1-principles/core-principles.md#simple-first).

**Design status:** Accepted Direction — PR 1 (Merged in [#581](https://github.com/hao1939/may-agent/pull/581)) and PR 2 (Ready in [#587](https://github.com/hao1939/may-agent/pull/587)) promoted into [Human Control Surfaces](../2a-design/human-control-surfaces.md), [HTTP Boundary](../2a-design/http-boundary.md), [Web UI](../2a-design/webui.md), and [May Console](../2a-design/may-console.md). Remaining cutover: **PR 3 (In-Process Daemon HTTP + WebSocket Unification)**.

---

## 1. The Mental Model: Two Modes Only

Every interaction with `may-agent` — whether by a **human** (in WebUI, Telegram, or Console) or by an **agent** (`alex`, `gym`, CLI, or an external coding agent) — operates in one of **two modes**:

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

Instead of maintaining **two** competing transport stacks — a custom NDJSON Unix Socket protocol (`packages/control`) **and** an HTTP server (`src/app/http/server.ts`) that proxies back into the Unix socket — **HTTP + WebSocket (`/ws`) is the single fundamental channel protocol for all clients.**

### Why HTTP + WebSocket Is Strictly Better Than Custom NDJSON Socket + Proxy

| Dimension | Legacy Dual Stack (Unix Socket + HTTP Proxy) | Unified HTTP + WebSocket Foundation |
| --- | --- | --- |
| **Multi-Agent Concurrency** | Custom line-delimited socket pipe; interleaves push events and command replies unless custom correlation/FIFO queues are maintained. | Native HTTP request/response concurrency. 50 agents can call `GET /api/task` and `POST /api/task/input` simultaneously with zero framing or queue state. |
| **Server Architecture** | Browser → HTTP Server → Unix Socket → Daemon (`~250 lines` of `sendDaemonFrameWithRetry`, `sendAppInputWithRetry`, `proxyWebSocket`). | Direct in-process HTTP + `/ws` handlers in the daemon. Zero socket proxy hops, zero intermediate socket timeouts. |
| **Console (`may-console`)** | `2,000 lines` with 6 manual FIFO arrays (`pendingTaskReads`, `pendingConversationReads`, etc.) to match socket replies. | Standard `await fetch(...)` for every command/input + 1 WebSocket for push wakes. Eliminates all 6 FIFO queues (`~600 lines` removed). |
| **Universal Agent Access** | Requires custom `@may-agent/control` socket client. | Any agent, CLI, test, or `curl` can call `http://127.0.0.1:PORT/api/*` directly. |

---

## 3. Canonical HTTP + WebSocket API Specification

All human surfaces (**WebUI**, **Console**, **Telegram** in-process) and **Agent clients** share one exact API contract organized around the Two Modes:

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
| `POST /api/task/input` | Send generation-fenced feedback / steering to one Task | `{ appId, taskId, expectedGeneration, message, inputKind?: "message", idempotencyKey }` (or `ref` instead of `appId` + `taskId`) | `202 { accepted: true, appId, taskId, generation, eventId, inboxId, replayed }` (`409` on generation mismatch or closed Task) |
| `POST /api/events` (`app.task.cancel.requested` / `retry` / `reopen`) | Fenced lifecycle controls for one Task | `{ type: "app.task.cancel.requested" \| "app.task.retry.requested" \| "app.task.reopen.requested", target: { appId, taskId }, data: { generation, resourceVersion, reason, controlKey } }` | `{ ok: true, eventId, delivery: "accepted" }` |

### Agent Cooperation Rules for Task-Focused Mode

Real-world cooperation between an external agent (or human reviewer) and a running `may-agent` Task requires three guarantees beyond raw HTTP endpoints:

1. **Fast Discovery by `ref` or Keyword (`GET /api/task?ref=` & `GET /api/tasks?q=`):**
   - Agents and humans should never need raw SQLite queries or full internal `input/appdep_...` Task IDs to locate work.
   - `GET /api/task?ref=d98bb682` resolves the 8-char Task `ref` directly.
   - `GET /api/tasks?q=581&includeDone=true` searches across `ref`, `taskId`, `outcome`, and `summary` so an agent can locate the Task for `"PR 581"` in one HTTP call.
2. **Authoritative Steering (`POST /api/task/input` Refines Work Without Contradicting `spec.acceptance`):**
   - Initial Task `outcome` and `acceptance` must express the **durable goal**, not freeze a brittle 1,500-word implementation script.
   - When new caller/human feedback arrives via `POST /api/task/input`, it is authoritative steering for the current Task rather than a "contradiction" that forces the worker to refuse action until the parent Task rewrites `spec.acceptance`.
3. **Round Limits Cap Autonomous Loops, Not New Human/Caller Feedback:**
   - Execution round caps (such as `develop-change` round limits) exist to prevent an agent from looping autonomously without progress during a single unguided attempt/generation.
   - Admitting new human or caller review feedback (`POST /api/task/input` or a revised Task `generation`) represents newly requested work and must replenish or grant a fresh execution pass rather than deadlocking on prior autonomous rounds.

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
- **Done in PR #587 (`2bd331265f`, open & CI green):**
  - Enriched `conversation.requests[].taskRefs` with 8-char `ref` in `readAppConversationResource` (`src/app/core/state/conversations.ts`).
  - Consistent `ref` support across `GET /api/task/transcript?ref=<ref>` (`src/app/http/task-transcript.ts`) and `POST /api/task/input` `{ ref }` (`src/app/http/task-input.ts`).
  - Case-insensitive keyword search `GET /api/tasks?q=<query>` across `ref`, `taskId`, `outcome`, and `summary` (`src/app/human-task-service.ts`).
  - Retired human-facing `/topics`, `/topic`, and `selectedTopic` from Telegram (`src/app/transport/telegram.ts`, `telegram-format.ts`) and Console (`packages/terminal/bin/may-console.cjs`).

---

### Remaining Work (PR 3): Unify Daemon HTTP + WebSocket Server & Retire HTTP-to-Socket Proxy
1. **Direct In-Process HTTP + `/ws` Control Server:**
   - Run the HTTP + `/ws` control routes (`src/app/http/server.ts`) directly against the daemon's in-process `HumanTaskService`, `EventInterface`, and `EventBus` rather than proxying every browser/agent request through a second Unix domain socket (`sendDaemonFrameWithRetry`, `sendAppInputWithRetry`, `proxyWebSocket`).
2. **Migrate `may-console` (`packages/terminal/bin/may-console.cjs`) to HTTP + WebSocket:**
   - Replace the 6 manual socket FIFO correlation queues (`pendingTaskListReads`, `pendingTaskReads`, `pendingConversationReads`, etc.) with standard `fetch()` calls + 1 WebSocket subscription for push wakes.
3. **Auto-Close Converged `close`-Disposition One-Shot Assignments:**
   - Ensure converged one-shot assignments with `taskDisposition: { kind: "close" }` are closed promptly so completed Tasks do not linger in `idle`.
