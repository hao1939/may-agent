# Event System Refinement: Clear, Loud, and Fact-Only Events

**Supports:** [Core Principles](../1-principles/core-principles.md), [Agent App](../2a-design/agent-app.md), [Events And Task Admission](../2a-design/events.md), [Task Resource Engine](../2a-design/task-resource-engine.md), and [Unified Input Channel Design](./input-channel-design-and-experience-20261117.md).

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource) and [simple first](../1-principles/core-principles.md#simple-first).

**Design status:** Proposal for Review.

---

## 1. Problem Statement: Why the Event System Feels Muddy Today

An audit of `src/app/core/events/bus.ts`, `src/app/core/events/interface.ts`, `src/lib/db-writer.ts`, and the live `/app/.state/may.db` (`23,280` rows in `events`) reveals why our event system has grown hard to reason about:

**We currently overload one `EventBus` and one SQLite `events` table for 5 completely different mechanisms:**

1. **High-Frequency Internal Timers & Heartbeats (66.3% of all rows in `events`!):**
   - `runtime.daemon.heartbeat`: **7,025 rows** (written every 30s).
   - `trigger.metrics-evaluate`: **6,988 rows** (written every 60s via a `may.app` schedule).
   - `trigger.metrics-snapshot`: **1,468 rows** (written every 5m via a `may.app` schedule).
   - `conversation.supervision.review`: **482 rows** (written every 15m via a `may.app` schedule).
   - *Total:* **15,963 rows** of timer noise in the durable `events` journal!
2. **Synchronous Commands / RPC Controls Disguised as Events:**
   - Task lifecycle mutations (`app.task.cancel.requested`, `app.task.retry.requested`, `app.task.reopen.requested`, `app.task.close.requested`), Conversation stop (`conversation.turn.stop.requested`), and Host lifecycle controls (`runtime.reload.requested`, `runtime.restart.requested`, `runtime.shutdown.requested`) are synchronous, fenced RPC commands. Routing them through pub/sub `EventBus` adds indirection without decoupled fan-out.
3. **Hidden SQLite Table Mutations Inside `DbWriter` Event Persistence:**
   - Emitting `session.start`, `session.end`, or `session.idle` on `EventBus` secretly mutates the `sessions` table inside `DbWriter.handler` (`src/lib/db-writer.ts:288`).
   - Emitting `metric.threshold_changed` or `metric.alert_resolved` secretly mutates metric definitions/alerts inside `DbWriter`.
4. **Duplicated Execution & Step Telemetry (21.6% of all rows in `events`):**
   - `session.start` (`1,184`), `session.end` (`994`), `project.task.reconcile.started` (`748`), `skill.loaded` (`578`), `workflow.started` (`234`), `workflow.completed` (`228`), `handler.workflow_dispatched` (`204`), `workflow.step_started` (`101`), `workflow.step_completed` (`100`).
   - Dedicated tables (`sessions`, `app_task_attempts`, `workflow_runs`, `execution_usage`) *already* record these executions with proper schemas.
5. **Ephemeral UI Wakes & Live Output Streams Mixed with Durable Facts:**
   - In-memory stream chunks (`text`, `tool_call`, `tool_result`, `turn_end`, `info`, `prompt`) and UI push notifications (`conversation.updated`, `app.task.updated`) flow through the same `EventBus` as durable domain facts.

### The Accidental Complexity This Created
Because all 5 categories share one bus and table, the runtime had to invent layers of defensive bookkeeping:
- Three internal symbol flags on events (`EVENT_RECORD_ONLY`, `EVENT_INTERFACE_INPUT`, `EVENT_APP_ADMISSION_REDELIVERY_REQUIRED`).
- Three overlapping delivery state columns in `events` (`delivery_status = 'pending' | 'accepted' | 'unhandled'`, `delivery_route = 'direct' | 'noop'`, `app_admission_pending = 0 | 1`).
- A hardcoded whitelist `INTENTIONAL_OBSERVATION_EVENT_TYPES` in `src/app/metric-source-measurement.ts` (`project.approval.resolved`, `evaluation.task_report_published`, `evaluation.metric_report_published`, `scout.research.qualified`) just to stop `record`-mode facts from triggering false `unhandled_events` alerts!
- Self-subscribed schedules in `scout-knowledge-lib.app` (`schedule -> emit scout.explore -> subscribe to scout.explore -> toInput`) even though `AppSchedule` already supports direct `input: { kind, data }`.

---

## 2. Core Principle: What Is an Event?

To make events **clear and loud**, we establish one strict rule across the 3-Layer Architecture:

> **An Event is a durable, immutable Fact (`past_tense`) about a meaningful state change that independent consumers (App `subscriptions` or Task `Conditions`) react to.**
>
> - **Commands & Inputs are direct calls, NOT Events.**
> - **Timers & Heartbeats are internal clocks, NOT Events.**
> - **Table mutations belong to the owning store, NOT `DbWriter` event side-effects.**
> - **Live UI/WebSocket notifications are Ephemeral Wakes, NOT durable Events.**

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. DIRECT COMMANDS & INPUTS (Synchronous Service / HTTP Calls)             │
│    Caller invokes owning authority directly and gets an immediate receipt: │
│    • Conversation: sendMessage(), stopTurn()                               │
│    • App / Task Input: receiveInput(), submitTaskInput()                   │
│    • Task Control: retryTask(), cancelTask(), reopenTask(), closeTask()    │
│    • Runtime Admin: reload(), restart(), shutdown()                        │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                         commits state & emits facts
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 2. DURABLE DOMAIN EVENTS (`events` table — Loud, Past-Tense Facts Only!)   │
│    Every row in `events` is a high-signal domain or lifecycle fact:        │
│    • External World Observations (`*.github.pull-request.state`,           │
│      `credential.state`)                                                   │
│    • Cross-Task / Cross-App Coordination (`app.dependency.updated`,        │
│      `evaluation.*_report_published`, `scout.research.qualified`,          │
│      `project.library_health.observed`, `project.knowledge.maintained`)    │
│    • Metric State Transitions (`metric.breach`, `metric.recovered`)        │
│    • Accountable Lifecycle Failures & Milestones (`project.task.reconciled`│
│      `app.input.admission.failed`, `app.observer.failed`)                  │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                        notifies connected clients
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ 3. EPHEMERAL WAKES & LIVE STREAMS (In-Memory PubSub -> WebSocket `/ws`)    │
│    Never written to SQLite `events`:                                       │
│    • Resource wakes: `conversation.updated`, `app.task.updated`            │
│    • Live session stream: `text`, `tool_call`, `tool_result`, `info`       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Classification of Current Events: Keep, Convert, or Retire

### A. KEEP as Durable Domain Events (Loud, High-Signal Facts in `events`)

These are the **only** events that belong in the durable `events` journal. Every single one is a past-tense fact that wakes a Task `Condition`, triggers an App `subscription`, or records a primary cross-boundary transition:

| Category | Event Types | Producer | Consumer (`subscriptions` / `Conditions`) |
| --- | --- | --- | --- |
| **1. External Observer Facts** | `may.github.pull-request.state`<br>`alex.github.pull-request.state`<br>`credential.state` | App `observers` (`github-pull-request`, `xhs-credential`) | Task `Conditions` waiting on external state changes + App `observations` |
| **2. Cross-Task & Cross-App Facts** | `app.dependency.updated`<br>`evaluation.task_report_published`<br>`evaluation.metric_report_published`<br>`evaluation.review_failed`<br>`evaluation.human_decision.requested`<br>`scout.research.qualified`<br>`project.library_health.observed`<br>`project.knowledge.maintained` | Host dependency resolver (`app-inbox-runtime.ts`) & App workflows (`evaluator`, `scout`) | Waiting caller Task `Conditions` (`app.dependency.updated`) and App `subscriptions` (`may.app`, `alex.app`, `scout.app`) |
| **3. Metric Alert Transitions** | `metric.breach`<br>`metric.recovered` | `MetricService.evaluate()` on state transition | `may.app`, `alex.app`, and `scout.app` `subscriptions` |
| **4. Task & Runtime Failure / Milestone Facts** | `project.task.reconciled`<br>`app.input.admission.failed`<br>`app.observer.failed`<br>`handler.failed`<br>`workflow.owner.requested` | Task reconciler, App Inbox, Observer runner, Standalone workflow escalation | `alex.app` automatic review / recovery `subscriptions` & `may.app` operational oversight `subscriptions` |

---

### B. CONVERT to Direct Calls, Timers, or Dedicated Tables (Remove from `events`)

| Current Event Type(s) | Current Problem | Target Replacement |
| --- | --- | --- |
| `trigger.metrics-snapshot` (`1,468` rows)<br>`trigger.metrics-evaluate` (`6,988` rows) | Declared as `schedules` in `may.app` that emit `trigger.*` events into SQLite every 60s/300s for the Host to catch. | **Direct Host Timer:** Run `measureSourceMetrics` and `evaluateMetrics` on an internal Host timer in `reporting.ts` / `daemon-events.ts`. Zero rows in `events`. |
| `conversation.supervision.review` (`482` rows) | Declared as a 15m `schedule` in `may.app` only so `app-inbox-runtime.ts` calls `recoverRetainedConversationTaskReturns()`. | **Internal Recovery Loop:** `app-inbox-runtime.ts` already runs a 60s `recoverNow()` timer; call `recoverRetainedConversationTaskReturns()` there directly. Retire the event. |
| `runtime.daemon.heartbeat` (`7,025` rows) | Inserts a new row into `events` every 30s just so `maintenance.ts` can read `MAX(timestamp)`. | **1-Row Runtime Liveness Stamp:** Store the latest heartbeat timestamp in a single-row key/table (or `.state/daemon-heartbeat.json`), replacing 7,000+ event rows. |
| `scout.explore` (`215` rows)<br>`scout.digest`<br>`project.library_health.tick` | `scout-knowledge-lib.app` schedules emit an event and `scout-knowledge-lib.app` subscribes to its own event to produce `AppInput`. | **Direct Schedule Input:** Use `schedule.input: { kind, data }` directly in `scout-knowledge-lib.app` (matching `alex.app`). |
| `app.task.cancel.requested`<br>`app.task.retry.requested`<br>`app.task.reopen.requested`<br>`app.task.close.requested` | Synchronous fenced Task controls routed through `EventBus` (`task-control-events.ts`). | **Direct Fenced Task Control API:** Invoke `appTasks.cancelTask` / `retryTask` / `reopenTask` / `closeTask` directly from the control/HTTP handler (`POST /api/task/control`). |
| `runtime.reload.requested`<br>`runtime.restart.requested`<br>`runtime.shutdown.requested` | Process admin commands routed through `EventBus`. | **Direct Host Admin API:** Call the Host control handlers directly from the HTTP/CLI endpoint. |
| `app.task.ready`<br>`app.task.cancelled`<br>`app.task.reopened`<br>`app.task.attempt.stopped` | Used as internal in-process signals between `app-task-runtime.ts`, `app-inbox-runtime.ts`, and `task-wake.ts`, while accidentally writing to `events`. | **Direct In-Process Callback + Ephemeral `app.task.updated` Wake:** Call `wakeLoadedAppTasks` / `refreshTaskCallerResults` directly and emit only the ephemeral `app.task.updated` wake for WebSocket clients. |
| `app.task.communication.updated` (`81` `unhandled` rows) | Uses the `events` table as a key-value receipt store for `applyTaskCommunication` idempotency. | **Task Change Receipt:** Store the communication replay receipt on the Task/Attempt state (`changeReceipts` / `app_task_communication_receipts`) instead of polluting `events` with `unhandled` rows. |
| `session.start` (`1,184` rows)<br>`session.end` (`994` rows)<br>`session.idle` | `DbWriter` intercepts these events to mutate the `sessions` SQLite table as a side effect. | **Direct `sessions` Table Ownership:** `SubagentManager` writes `upsertSession` / `updateSessionDb` directly and notifies `app-task-runtime` via callback. |
| `workflow.started` / `completed` / `step_started` / `step_completed` / `handler.workflow_dispatched`<br>`project.task.reconcile.started` / `profiled` / `executor.progress`<br>`skill.loaded` (`578` rows) | Low-level execution telemetry duplicated into `events`. | **Owned by Execution Tables & Live Stream:** `workflow_runs`, `app_task_attempts`, and `execution_usage` already persist durable execution records; live progress goes to the ephemeral WebSocket stream. |

---

### C. RETIRE Dead & Legacy Event Types

These legacy event types are remnants of earlier architectures (`projects`, v2 inter-agent messaging, direct Pi session chat, and manual metric threshold edits) and should be deleted from `bus.ts`, `interface.ts`, `command-router.ts`, and `db-writer.ts`:

- `project.comment.created`, `project.owner.requested`, `project.status_changed`, `project.nudge`
- `chat.start.requested`, `session.steer.requested`, `session.cancel.requested`, `session.cancel_all.requested`
- `message.created`, `message.delivery_failed`, `channel.delivery.completed`, `channel.delivery.failed`
- `cli.task.requested`, `cli.task.started`, `cli.task.completed`, `cli.task.failed`
- `metric.threshold_changed`, `metric.alert_resolved`, `metric.feedback.routed`, `metric.alert_judged`
- Legacy flat union variants in `bus.ts` (`type: "workflow"`, `type: "heartbeat"`)

---

## 4. Target Architecture: How Events & Watchers Act in the System

Once Commands, Timers, DB side-effects, and Ephemeral Streams are separated from Durable Domain Events, the event pipeline becomes small, explicit, and loud:

### 1. One Durable Event Contract (`AppDomainEvent`)
Every durable event emitted via `events.emit(event)` or an App observer has one canonical envelope:
```ts
type DurableEvent = {
  id?: number;
  type: string;                  // Past-tense domain fact, e.g. "may.github.pull-request.state", "metric.breach"
  source: string;                // Producing authority, e.g. "app:may:observer:github-pull-request", "metric-service"
  owner?: string;                // Accountable owner
  target?: { appId?: string; taskId?: string; project?: string; metricId?: string };
  localKey?: string;             // Idempotency key scoped to (source, type, localKey)
  timestamp: number;
  data: Record<string, unknown>;
};
```

### 2. Extensible Resource Watcher Architecture: Pluggable Per-Resource Watchers & Two Watch Modes (`one-shot` vs. `continuous`)

A live case study on **PR #587** (`alex · e462ebfe`) exposed why our current watcher behavior was brittle:
1. `e462ebfe` pushed commit `40ce344111`, waited on its PR `Condition`, saw green CI (`Quality` + `Container`), and transitioned to `converged` (`conditionIds: []`) at `09:55 UTC`.
2. Eleven minutes later (`10:06 UTC`), GitHub Copilot posted **2 new inline review comments** (`4598046301`, `4598046372`) on that exact commit while PR #587 was still `OPEN`.
3. Because the PR watch was treated as a **one-shot** Condition that cleared as soon as CI passed (`c.state = 'true'` / `t.phase = 'converged'`), the Host stopped watching PR #587 while the PR was still open!

To make watching external resources both **rock-solid** and **effortless to extend**, we establish **two orthogonal concepts**:

---

#### A. Pluggable Per-Resource Watchers (One Watcher Plugin per External Resource Kind)

Each external resource kind (GitHub Pull Request, GitHub Issue, CI Run, Credential State, Metric, Deployment, etc.) is observed by **one dedicated, self-contained `ResourceWatcher` (`ResourceObserver`) plugin**:

```ts
export type ResourceObserver = {
  id: string;                  // e.g. "github-pull-request", "github-issue", "xhs-credential"
  type: string;                // Emitted event type, e.g. "alex.github.pull-request.state"
  description: string;
  intervalMs: number;
  timeoutMs: number;
  /** Inspect one exact resource and return its current fact + fingerprint + terminal status. */
  inspect(resource: string, context: { signal: AbortSignal }): Promise<{
    fingerprint?: string;      // Stable hash of meaningful resource state
    closed?: boolean;          // True when the resource itself reached a terminal state (e.g. PR merged/closed)
    [key: string]: unknown;
  }>;
};
```

- **How Extension Works:** When we want `may-agent` to support a new external event/resource kind (e.g., `github-issue`, `ci-workflow-run`, `docker-container`, `linear-issue`), we simply **register one new `ResourceObserver`** with `inspect(resource)`.
- **Zero Core Changes Needed:** The Host's generic watcher engine (`bindResourceObserver` + `observationDemandReader` + `app-task-condition-tracker`) automatically handles:
  - **Demand discovery** (finding which resources are currently watched by any open Task).
  - **Deduplicated polling** (polling each unique `(observerId, resource)` **once** per interval even if 5 Tasks watch it).
  - **M:N fan-out** (waking all Tasks watching that resource).
  - **Automatic unsubscription** when either the resource closes or all watching Tasks close.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                  PLUGGABLE RESOURCE WATCHERS (1 per Resource Kind)         │
│  • github-pull-request  -> inspects `github:owner/repo#587`                │
│  • github-issue         -> inspects `github:owner/repo#120`                │
│  • xhs-credential       -> inspects `xhs`                                  │
│  • metric-evidence      -> inspects `metric-id`                            │
│  (Adding a new event/resource kind = adding 1 `defineObserver()` plugin!)  │
└────────────────────────────────────────────────────────────────────────────┘
                                      │
                        Host polls each unique active
                        `resource:<id>` ONCE per interval
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  M:N TASK ↔ RESOURCE SUBSCRIPTION ROUTER                   │
│                                                                            │
│   Task A (alex/e462ebfe) ──┬──► [continuous] resource:github:...#587       │
│                            │                                               │
│   Task B (may/8ecb1df2)  ──┴──► [one-shot]   resource:github:...#582       │
│                                              (expected: { merged: true })  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

#### B. Two Explicit Watch Modes: `one-shot` vs. `continuous` (Consistent)

When a Task subscribes to an event or resource, it chooses one of **two watch modes** depending on its intent:

| Dimension | Mode 1: `one-shot` Watch (Default for exact target state) | Mode 2: `continuous` Watch (Consistent watch while resource is open) |
| --- | --- | --- |
| **Intent** | *"Wake me **once** when this exact expected state is reached."* | *"Keep notifying me of **any meaningful change** (`fingerprint` change) to this resource while it is open."* |
| **Examples** | • Wait for child Task / App request to finish (`app.dependency.updated` `status: "done"`).<br>• Wait for human approval (`project.approval.submitted`).<br>• Wait only for `credential.state` `state: "ready"`. | • Watch an open PR (`github:hao1939/may-agent#587`) for any CI completion, new Copilot/human review comment, review decision, head push, or merge/close.<br>• Watch a live deployment or incident resource until resolved. |
| **When does it wake the Task?** | **Once**, when the incoming event matches `expected`. | **Every time** the resource's `fingerprint` changes (and matches optional filter criteria), even if the Task is currently `converged` / `idle` waiting for human review! |
| **What happens after it wakes the Task?** | Transitions to `state = "true"` (satisfied) and **unsubscribes immediately**. | Updates `status.observed` (recording the latest `fingerprint`), wakes the Task, and **stays subscribed (`state = "false"`)** while the resource remains open! |
| **When does it unsubscribe?** | 1. As soon as `expected` matches (`state = "true"`), **OR**<br>2. When the **Task closes** (`closed` / `cancelled`), **OR**<br>3. When the **Resource closes** (`closed: true` / `state: "closed"`). | 1. When the **Resource closes** (`closed: true` / `state === "closed"` / `merged === true` — after delivering that final terminal event once!), **OR**<br>2. When the **Task closes** (`closed` / `cancelled`). |

---

#### C. Why This Solves Every Case Cleanly

1. **Solves the PR #587 Late Review Comment Bug Automatically:**
   - When `alex · e462ebfe` opens PR #587, it attaches a **`mode: "continuous"`** watch on `resource:github:hao1939/may-agent#587`.
   - When CI passes at `09:55 UTC`, the watch wakes `e462ebfe` (`fingerprint` changed). `e462ebfe` reports "PR #587 is ready for review" (`phase = "converged"` / `idle`), **and the `continuous` watch stays active** because PR #587 is still `open` and `e462ebfe` is not `closed`!
   - When Copilot (or Hao) posts review comments at `10:06 UTC`, the PR watcher sees the new `fingerprint`, emits `alex.github.pull-request.state`, and wakes `e462ebfe` immediately!
   - When Hao finally merges (or closes) PR #587, the PR watcher sees `state === "closed"` (`merged === true`), delivers that final event to `e462ebfe` (and any other watching Task), and **auto-unsubscribes**!
2. **Supports True M:N (`Task ↔ Resource`) Without Duplicate Polling:**
   - One Task can hold multiple watches (`one-shot` or `continuous`) across multiple resources (e.g., watching PR #582 + PR #587 + child Task `appdep_...`).
   - Multiple Tasks (e.g., Alex's PR Task + May's supervisor Task + a downstream stacked-PR Task) can watch `resource:github:hao1939/may-agent#587` simultaneously — the `github-pull-request` watcher polls GitHub **once** and fans the event out to all watching Tasks.
3. **Eliminates `github-pull-request-live` PR-Body Scraping:**
   - Because `continuous` resource watches remain active until the PR closes or the Task closes, we can delete the duplicate `github-pull-request-live` PR-body scraper (`-300` LOC) in `shared/tools/github-pull-request.ts`.

### 3. One Clear Admission & Delivery Lifecycle
When a durable event is emitted:
1. **Persist & Deduplicate (`events` table):**
   - Written atomically with `(source, event_type, local_key)` deduplication.
2. **Match Against Declarative Consumers (`app-inbox-runtime.ts`):**
   - **Exact-Task Target (`event.target.taskId`):** External watcher facts for a Task-owned resource (like `alex.github.pull-request.state` for an open PR) wake the owning Task directly (`exact-task` route) and satisfy any matching Condition.
   - **App `subscriptions`:** Each matching subscription runs its pure `toInput(event)` translator and admits the resulting `AppInput` into `app_inbox`.
   - **Open Task `Conditions` (`kind: "event"`):** Any open Task waiting on an event Condition matching `event.type` (and optional `source` / `filter`) records the matched observation and wakes the Task reconciler.
   - **App `observations`:** Declared observation streams remain readable via `ctx.read.observations(type)` without needing a hacky `INTENTIONAL_OBSERVATION_EVENT_TYPES` whitelist.
3. **Clear & Loud Delivery Status:**
   - Because `events` only contains real domain facts (no heartbeats, timer ticks, or `skill.loaded` noise), every event has a transparent outcome:
     - `matched` (admitted to ≥1 exact Task, App subscription, Task Condition, or declared App observation)
     - `unmatched` (loud signal: a domain fact was emitted that no consumer matched!)
     - `failed` (loud signal: a matching subscription's `toInput` or admission threw an error, triggering recovery and `app.input.admission.failed`).

### 4. Separate Ephemeral Wake & Stream Bus (`LiveStreamBus`)
- Live UI notifications (`conversation.updated`, `app.task.updated`) and live session token/tool streams (`text`, `tool_call`, `tool_result`, `turn_end`, `info`) flow through a lightweight in-memory emitter directly to WebSocket `/ws` subscribers and Console.
- They never touch `DbWriter` or the SQLite `events` table.

---

## 5. Implementation Roadmap (Incremental, Verifiable Slices)

1. **Slice 1 — Unified M:N Resource Watcher Lifecycle (Subscribe Until Resource Closes or Task Closes):**
   - Update `ResourceObserver` demand and condition routing (`src/app/core/state/observation-demand.ts`, `src/app/adapters/producers/resource-observer.ts`, and `src/app/core/tasks/app-task-runtime.ts`) so a Task's subscription to a resource (`resource:github:hao1939/may-agent#587`) stays active across multiple updates (`fingerprint` changes) and across `converged` (`idle`) phases while the PR is still open.
   - Support true **M:N (`Task ↔ Resource`)** fan-out: poll each unique `(type, resource)` once per interval and fan out changed resource facts to **all** subscribed open Tasks (`app_task_condition_routes`).
   - Enforce the **Two Unsubscribe Rules**:
     1. Unsubscribe automatically when the **Task closes** (`closed` / `cancelled` in `app_task_cancellations`).
     2. Unsubscribe automatically when the **Resource closes** (e.g., `state === "closed"` or `merged === true` on a PR), after delivering the terminal fact once to all subscribed Tasks.
   - Retire the duplicate `github-pull-request-live` PR-body-scraping observer in `shared/tools/github-pull-request.ts` so `ResourceObserver` is the single authority for watching PRs.

2. **Slice 2 — Stop the 66% Timer & Heartbeat Flood in `events`:**
   - Replace `trigger.metrics-snapshot` and `trigger.metrics-evaluate` schedules in `may.app` with a direct Host timer in `daemon-events.ts` / `reporting.ts`.
   - Retire `conversation.supervision.review` from `may.app` schedules and run `recoverRetainedConversationTaskReturns` inside the existing `app-inbox-runtime.ts` recovery tick.
   - Replace `runtime.daemon.heartbeat` rows in `events` with a lightweight heartbeat stamp read by `maintenance.ts`.
   - Convert `scout-knowledge-lib.app` schedules (`scout.explore`, `scout.digest`, `project.library_health.tick`) to direct `schedule.input` definitions.

3. **Slice 3 — Move Hidden SQLite Side-Effects & Communication Receipts Out of `events`:**
   - Move `sessions` table writes (`session.start`, `session.end`, `session.idle`) out of `DbWriter` into `SubagentManager` direct calls.
   - Store `applyTaskCommunication` idempotency receipts on Task state instead of emitting `unhandled` `app.task.communication.updated` rows into `events`.
   - Stop persisting low-level telemetry (`skill.loaded`, `workflow.step_*`, `project.task.reconcile.started` / `profiled` / `executor.progress`) into `events`.

4. **Slice 4 — Separate Direct Control Commands & Ephemeral Wakes from Durable Domain Events:**
   - Route Task controls (`retry`, `cancel`, `reopen`, `close`), Conversation `stopTurn`, and Host `reload`/`restart`/`shutdown` directly through their owning services and HTTP endpoints rather than `EventBus`.
   - Separate ephemeral UI wakes (`conversation.updated`, `app.task.updated`, live session stream) from durable domain events, and retire dead legacy event types (`project.comment.created`, `project.nudge`, `chat.start.requested`, `session.steer.requested`, `cli.task.*`, etc.).
