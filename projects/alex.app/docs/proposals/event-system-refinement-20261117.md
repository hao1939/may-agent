# Event System Refinement: Clear, Loud, and Fact-Only Events

**Supports:** [Core Principles](../1-principles/core-principles.md), [Agent App](../2a-design/agent-app.md), [Events And Task Admission](../2a-design/events.md), [Task Resource Engine](../2a-design/task-resource-engine.md), and [Unified Input Channel Design](./input-channel-design-and-experience-20261117.md).

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource) and [simple first](../1-principles/core-principles.md#simple-first).

**Design status:** Proposal for Review.

---

## 1. What needs improvement

Current EventBus traffic mixes durable facts, input/control commands, internal
timers, execution telemetry and live UI notifications. Some store writes are
hidden in the journal subscriber. This makes ownership, admission and later
completion harder to follow. The [dated audit](../archive/reviews/event-system-refinement-review-20261117.md)
retains observed row counts and the PR #587 late-comment case; those measurements
are not enduring API requirements.

**Implementation status:** **Slice 1 (PR #591)** and **Slice 2 (PR #588 & PR #593)** are merged into `origin/main` (`e489ff32b6`) and deployed to the live Host (`deploy-20261118T004957Z-2673375`), together with their paired Apps updates (`ae40ed0fca` and `73ab3ccd30` on `/app` `main`).
- `runtime.daemon.heartbeat` now writes to `<persistDir>/instances/<instance>/<interface>.heartbeat.json` (zero `events` rows).
- Periodic metric collection (`300_000` ms) and evaluation (`60_000` ms) now run on direct `.unref()` Host timers (`attachDaemonMetricTimers`, zero `trigger.metrics-*` rows).
- `scout-knowledge-lib.app` schedules now use direct `input: { kind, data }` definitions (zero self-subscribed schedule event hops).
- Continuous resource watches (`mode: "continuous"`) now remain active across `converged` (`idle`) Tasks and multiple `fingerprint` changes with M:N fan-out, and `github-pull-request-live` is retired from active App definitions.
- **Remaining:** **Slice 3** (`DbWriter` `sessions` side-effect mutations, `app.task.communication.updated` receipt storage, and low-level execution telemetry removal) and **Slice 4** (direct control endpoints & ephemeral `/ws` wake separation).

## 2. Core Principle: What Is an Event?

To make events **clear and loud**, we establish one strict rule across the 3-Layer Architecture:

> **An Event is a durable, immutable Fact (`past_tense`) about a meaningful state change that independent consumers (App `subscriptions` or Task `Conditions`) react to.**
>
> - **Commands and inputs request effects from an owning API; facts report committed observations.**
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

These are candidate durable fact families. A fact can have zero current consumers; that alone is not a failure. Required delivery applies to an addressed obligation or declared consumer, and must remain visible until its own admission succeeds:

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

These names are retirement candidates, not a verified list of dead producers.
Check current writers, subscriptions, control clients, startup and recovery before
removing each one from `bus.ts`, `interface.ts`, `command-router.ts` or `db-writer.ts`.
A retained operator cancellation/diagnostic capability still needs its owning API;
removing public helper-session actions does not remove Host supervision. Record
an exact replacement or proof of no supported consumer for each removal:

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

Continuous observation is a retained interest, not a forever-unfulfilled business
prerequisite. A changed fact must be durably associated with every interested
Task and make eligible work runnable even while interest remains active. Keep
interest, last delivered fingerprint, input acceptance and attempt convergence
independent. Unchanged observations need no repeated model call. Reuse existing
Condition routes and event/inbox recovery rather than adding a second watch
registry or relying on an in-memory subscriber.

Share a resource read only within the same trusted observer source/type and
resource. Equal observer IDs under different App definitions or credentials do
not establish equivalent visibility. Each interested Task keeps its own durable
delivery/consumed fingerprint; processing one subscriber must not advance another.

The observer/App defines what terminal means for its resource; generic Host code
must not infer it from GitHub-specific fields. Retain the final observation and
its consumer routes before retiring demand, so a failed wake can recover. A
closed/cancelled Task must not be resurrected. Offer the terminal observation to
each interested Task even when its expected success predicate remains false;
retiring demand must not leave the owner asleep forever or fabricate success.
A failed provider read is not resource termination. Define explicit removal or owner
transfer for withdrawn monitoring; local readiness alone does neither.

| Dimension | Mode 1: `one-shot` Watch (Default for exact target state) | Mode 2: `continuous` Watch (Consistent watch while resource is open) |
| --- | --- | --- |
| **Intent** | *"Wake me **once** when this exact expected state is reached."* | *"Keep notifying me of **any meaningful change** (`fingerprint` change) to this resource while it is open."* |
| **Examples** | • Wait for child Task / App request to finish (`app.dependency.updated` `status: "done"`).<br>• Wait for human approval (`project.approval.submitted`).<br>• Wait only for `credential.state` `state: "ready"`. | • Watch an open PR (`github:hao1939/may-agent#587`) for any CI completion, new Copilot/human review comment, review decision, head push, or merge/close.<br>• Watch a live deployment or incident resource until resolved. |
| **When does it wake the Task?** | **Once**, when the incoming event matches `expected`. | **Every time** the resource's `fingerprint` changes (and matches optional filter criteria), even if the Task is currently `converged` / `idle` waiting for human review! |
| **What happens after it wakes the Task?** | Satisfies the exact prerequisite and releases its observation demand. | Retains interest and saves delivery independently for each Task. Input handling and attempt convergence do not remove interest or force a prerequisite to remain false. |
| **When does it unsubscribe?** | After the expected fact, authorized withdrawal, Task closure/cancellation, or a terminal resource observation delivered for reconsideration. A false success predicate remains false. | After an observer-declared terminal fact is saved for every interested Task, Task closure/cancellation, or authorized withdrawal/transfer of monitoring. |

---

#### C. Intended PR follow-through behavior

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
3. **Per-consumer delivery:**
   - Retain each required destination and its admission outcome through the
     existing route/inbox records. A successful subscriber does not acknowledge
     another subscriber's failed translation or delivery. Retry the failed
     obligation without duplicating already accepted input.
   - Exact addressing selects a destination; it grants no authority. Validate
     trusted ingress provenance, App input and current Task fences through the
     owning admission API. An observer fact is evidence for owner judgment.
   - Because `events` only contains real domain facts (no heartbeats, timer ticks, or `skill.loaded` noise), every event has a transparent outcome:
     - `matched` (admitted to ≥1 exact Task, App subscription, Task Condition, or declared App observation)
     - `unmatched` (diagnostic when delivery was required; a legitimate record-only fact may have no consumer).
     - `failed` (loud signal: a matching subscription's `toInput` or admission threw an error, triggering recovery and `app.input.admission.failed`).
   - These aggregate labels summarize delivery. They cannot replace saved
     obligations, establish semantic completion, or erase partial failures.

### 4. Separate Ephemeral Wake & Stream Bus (`LiveStreamBus`)
- Live UI notifications (`conversation.updated`, `app.task.updated`) and live session token/tool streams (`text`, `tool_call`, `tool_result`, `turn_end`, `info`) flow through a lightweight in-memory emitter directly to WebSocket `/ws` subscribers and Console.
- They never touch `DbWriter` or the SQLite `events` table.

---

## 5. Implementation Roadmap (Incremental, Verifiable Slices)

1. **Slice 1 — Unified M:N Resource Watcher Lifecycle (Subscribe Until Resource Closes or Task Closes):**
   - Update `ResourceObserver` demand and condition routing (`src/app/core/state/observation-demand.ts`, `src/app/adapters/producers/resource-observer.ts`, and `src/app/core/tasks/app-task-runtime.ts`) so a Task's subscription to a resource (`resource:github:hao1939/may-agent#587`) stays active across multiple updates (`fingerprint` changes) and across `converged` (`idle`) phases while the PR is still open.
   - Support **M:N (`Task ↔ Resource`)** fan-out: share reads for an equal trusted observer source/type/resource and fan out changed facts to all interested open Tasks (`app_task_condition_routes`), with each route's delivery retained independently.
   - Enforce the **Two Unsubscribe Rules**:
     1. Unsubscribe automatically when the **Task closes** (`closed` / `cancelled` in `app_task_cancellations`).
     2. Retire demand on an observer/App-declared terminal observation, after retaining delivery to every interested Task. Generic Host code does not interpret GitHub-specific fields. Provider errors retain interest; terminal facts wake reconsideration even when the expected success state is false.
   - Retire `github-pull-request-live` PR-body discovery only after existing owned PRs have equivalent retained demand, missed-change recovery and routing. A new demand path for newly published PRs alone is insufficient migration evidence.

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


## Cutover constraints for later cleanup

Do not infer safety from lower journal row counts. Before moving a session or
metric write out of `DbWriter`, inspect its producer, writer priority, subsequent
subscribers and startup recovery together. The owning store commits before its
fact/wake is offered; failure must not emit a successful transition. Remove the
old writer in the same source cutover so one operation does not mutate twice.
Use existing transactions/receipts and recovery, rather than a second outbox or
parallel authority without demonstrated need.

A direct command API must preserve identity, authority/generation fences, durable
admission and replay of the original receipt. Swapping NDJSON for HTTP alone
establishes none of those. Move one owned boundary at a time with its production
caller and contrasting retry/restart path. A lost ephemeral wake must be
recoverable from retained work. New timing/liveness storage must remain readable
by existing health/recovery consumers before retiring its event producer.

## Connected acceptance using the May coding trial

Use the existing candidate PR and retained owning Task; no artificial Task per
stage or new feedback loop is needed. The current callable trial uses ordinary
Conditions and rearming for steps 1–3. Shared continuous demand and its terminal
retirement in steps 4–5 are acceptance for the later watcher slice; do not report
them as installed or block the current trial on that separate implementation.

1. Submit once through supported public ingress. Retry the identical submission
   with the same key and verify the same receipt and destination. Changed input
   gets a fresh key; stale generation and conflicting replay must fail clearly.
2. Revise saved requirements/checkout through the creator. Verify actual saved
   generation, retained caller/usage/evidence and a scheduled reconsideration.
   New feedback and a new generation do not reset cumulative development usage.
   Fulfill the exact older setup escalation separately; do not make a new
   request solely to manufacture a wake.
3. Run the workflow, publish a PR, consume real current-head CI and send its
   review link. Then add one substantive reviewer comment through the normal
   review channel after readiness; verify observation, same-Task wake, workflow
   repair and new-head CI. Record any manual relay as intervention.
4. Check two interested Tasks share a resource read and both receive meaningful
   changes; processing one route must not consume the other's interest. Repeat
   an unchanged observation and confirm no duplicate work. Recover a missed
   ephemeral wake from retained input rather than republishing a new obligation.
5. Close/merge the fixture resource or withdraw its interest through its owner.
   Confirm final observation is retained, no further polls/models run for it,
   closed Tasks stay closed, and unrelated work/Conditions survive. This fixture
   action does not authorize merging the implementation PR.

A successful notification is a provider receipt, not GitHub approval. Record exact
Host/SDK/App revisions and the supported transport used. Source tests establish
portable mechanics; this trial establishes their connected use and its limits.
