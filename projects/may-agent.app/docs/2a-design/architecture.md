# May-Agent Architecture

**Design status:** Accepted. This is the system's architecture reference.
**Implementation status:** Active and partially converged; subsystem gaps are
owned by their linked design docs and trackers.

> **Update (2026-06-18):** The system has evolved from handler-centric to
> **project-app-centric**. The canonical execution model is now:
>
> ```
> project-app (app.ts) → events → tasks → workflow or owner → observed state
> ```
>
> Project-apps own their agents, schedules, task routing, and task trees.
> Legacy handlers on may's cron are being consolidated — see
> [project-app-v3.md](project-app-v3.md) for the canonical app model and
> [system-operations-model.md](../3-proposals/system-operations-model.md) for
> the ops consolidation plan.

Core primitive:

```
event or resync → task intent → app queue → reconciler → workflow or owner → structured result
```

The project-app migration is complete. Standalone infrastructure handlers
remain a separate runtime mechanism.

---

A **project-centered, event-based autonomous agent system** where:
- **Project-apps are the primary unit.** Each `*.app/app.ts` declares its owner,
  schedules, one task resolver, app observations, and actions. Reusable
  workflows are discovered by filename.
  The app is how May-agent organizes work for a domain project.
- **Projects are context and ownership.** Each project carries its own history,
  background, goals, accumulated experience, and current lifecycle state.
  `active` means push now; `waiting` means watch until a resume signal makes
  work actionable again.
- **Metrics are signals.** Typed metrics measure progress toward project goals and system health. Metrics do not judge or decide; they signal what may need attention.
- **App schedules replace heartbeats.** For app-owned agents, recurring work
  fires from app.ts schedules, not blind heartbeat timers. Heartbeats remain
  only for standalone agents such as `dev` while they are still outside a
  project-app.
- Agents are role/responsibility/context scopes — accountability boundaries that own a domain.
- Events are durable signals that something can react to: timers, metric
  changes, messages, session completions, and project owner requests. Facts
  that nobody reacts to should be stored as state/logs instead of invented as
  events.
- Workflows relieve agents from orchestration decisions.
- `pi-agent-core` provides the low-level agent loop plus reusable harness
  primitives. May-agent owns the event, session, workflow, and scoped-resource
  integration around it.
- **Convention over configuration**: every component has sensible defaults. Agents opt into custom behavior only when needed.

---

## Infra vs Agent Boundary

The infra provides **primitives**. Agents build patterns on top.

| Infra provides | Agents build |
|---------------|-------------|
| Event bus (typed pub/sub) | Approval gates, escalation chains |
| Metrics (typed measurement + alerting) | Quality standards, SLOs |
| Messages (async, persisted) | Work requests, status updates |
| Sessions (runAgent, persist, resume) | Multi-step strategies |
| Scoped skill discovery and invocation | Reusable situational methods |
| Scoped workflow catalog and TypeScript executor | Repeatable orchestration |
| Storage (files + SQLite) | Project docs, knowledge bases |
| Safety (guards as middleware) | — |
| Continuity (crash recovery) | — |
| Workflows (step execution) | Verified-coder, project task flows |

The infra doesn't know about "work queues" or "approval gates." Those are agent behaviors using messages and project status. The infra just delivers messages and runs agents.

---

## Agent Independence

The infra is seamless — it triggers and frames, but the agent doesn't depend on it.

From the agent's perspective, every session is:
1. Receive a prompt (don't care who sent it — timer, metric breach, or human)
2. See context in system prompt (don't care if it was injected by MetricEngine or typed by hand)
3. Do work with coding tools
4. Finish

The infra provides:
- **Trigger**: when to run (timers, events) — replaceable by a human typing "go"
- **Framing**: what matters (metrics, messages, projects in prompt) — replaceable by a human writing context

The agent provides:
- **Work**: judgment + action with coding tools

The infra also provides what the agent cannot provide for itself:
- **Observability**: session metadata, token usage, cost, duration — all recorded without agent awareness
- **Traceability**: every tool call, every event, every message persisted with timestamps and agent attribution
- **Correlation**: which heartbeat triggered which workflow, which metric breach led to which fix — the event trail connects them
- **Safety**: tool guards — the agent can't police itself
- **Continuity**: crash recovery, session resume — the agent doesn't manage its own persistence
- **Resource management**: model routing, rate limit handling — transparent to the agent

Future investment areas:
- **Memory across sessions**: projects, journals, and `context.md` provide continuity today. (`last-session.md` is auto-generated at session end — a snapshot, not durable memory; see KE-916.) Richer cross-session memory is a future area.

The agent just works. The infra triggers, frames, protects, records, and connects the dots.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Event Bus                                   │
│                                                                      │
│  Event Sources              Events               Event Handlers      │
│  ─────────────              ──────               ──────────────      │
│  Timers (cron)  ──────────▶ trigger.*         ──▶ handler → workflow │
│  Metric Engine  ──────────▶ metric.breach     ──▶ alert workflow     │
│                             metric.recovered                         │
│                             metric.stalled                           │
│  Agent tools    ──────────▶ message.created   ──▶ ack + queue      │
│  (message, finish)          session.end       ──▶ MetricEngine       │
│                             tool_call         ──▶ UI/console (ephemeral) │
│                             tool_result       ──▶ UI/console (ephemeral) │
│                                                                      │
│  Pi-coding-agent events are bridged into system events via           │
│  session.subscribe()                                                 │
└───────────────────────────────────────────────────────────────────────┘
                                    │ bounded projections persisted
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│              SQLite (bounded metadata/coordination store)            │
│  metrics │ metric_snapshots │ sessions │ events │ projects            │
└──────────────────────────────────────────────────────────────────────┘
                                    │ artifact references
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│       Runtime artifacts (sessions, workflow runs, event bodies)       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Event Bus

Typed pub/sub plus a durable event store. The backbone.

Design contract:

- event names are dot-separated and stable;
- every event is persisted before side-effect subscribers run;
- events carry enough owner/project/session/workflow context to route and
  diagnose later;
- typed core events should converge with the event taxonomy in
  [events.md](events.md).

Current implementation note: `projects/may-agent/src/app/event-bus.ts` types the most common core
events today, while the event table can still persist dynamic event names from
adapters, workflows, and handlers. Treat untyped-but-documented event names as
implementation gaps, not as permission to invent incompatible names.

```typescript
type EventEnvelope<TData extends Record<string, unknown>> = {
  type: string;
  source?: string;
  owner: string; // "agent:<name>" or "human:<role>"
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  timestamp?: number;
  data: TData;
};

type SystemEvent =
  | EventEnvelope<{ entry: string }> & { type: "timer.tick" }
  | EventEnvelope<{ handler: string; agent: string; durationMs?: number; error?: string }> & { type: "handler.started" | "handler.completed" | "handler.failed" }
  | EventEnvelope<{ metricId: string; metricName: string; current: number; threshold: number; target?: number; message: string; priority?: "P0" | "P1" | "P2" | "P3" }> & { type: "metric.breach" }
  | EventEnvelope<{ metricId: string; metricName: string }> & { type: "metric.recovered" }
  | EventEnvelope<{ sessionId: string; agent: string; outcome: "done" | "error" | "interrupted"; status: string; summary: string; durationMs: number; finishParams?: Record<string, unknown>; workflowRunId?: string; projectId?: string }> & { type: "session.end" }
  | EventEnvelope<{ from: string; to: string; content: string; intent?: string; artifact?: string; priority?: "P0" | "P1" | "P2" | "P3" }> & { type: "message.created" }
  | EventEnvelope<{ projectId: string; author: string; text: string }> & { type: "project.comment.created" }
  | EventEnvelope<{ guard: string; action: string; reason: string; sessionId?: string; workflowRunId?: string; projectId?: string }> & { type: "guard.triggered" }

// Heartbeat is a workflow-backed handler. Cron, socket, or another event can
// trigger it; the handler builds/reuses workflow context and the workflow calls
// ctx.runAgent() for the owner.
// agentName("agent:may") -> "may"; human owners route through May.
bus.on("timer.tick", (e) =>
  runWorkflow(`${agentName(e.owner)}-heartbeat`, buildHeartbeatTask(e.owner), { source: "timer" })
);

// Metric breach creates durable alert state. The alert reactor resolves owner,
// dedups, and dispatches a triage workflow when the signal needs action.
bus.on("metric.breach", (e) =>
  runWorkflow("metric-alert-triage", buildAlertTask(e), { source: "metric-alert-reactor" })
);

// Messages: persisted to events table (owner = to_agent), included in the next owner review.
// No separate messages table — events table with owner field serves as inbox.
bus.on("message.created", (e) => { /* already persisted by bus.emit() */ });

// Timers are event sources — cron emits timer events on the bus.
registerTimer("may", "*/20 * * * *");  // emits { type: "timer.tick", source: "timer", owner: "agent:may", data: { entry: "may-heartbeat" } }

// Event persistence is the first-priority subscriber.
// Invariant:
//   function emit(e: SystemEvent) {
//     persistenceSubscriber(e);       // durable first
//     for (const h of handlers) h(e); // then side effects
//   }

// UI backends are just event bus subscribers
bus.onAny((e) => socketServer.broadcast(e));   // WebSocket → web UI
bus.onAny((e) => telegramNotifier.handle(e));  // Telegram alerts
bus.onAny((e) => consoleRenderer.render(e));   // Console output
```

---

### 2. Metric Engine

Typed metrics with type-specific measurement, alerting, and display.

#### Types

| Type | Semantics | Measurement | Alert Modes |
|------|-----------|-------------|-------------|
| **Gauge** | Point-in-time, can go up/down | Sample via query/command | Threshold (instant/sustained), trend (rate of change) |
| **Counter** | Monotonically increasing, exposed as rate | Query delta between intervals | Rate too high/low, stalled (no increment for N intervals) |
| **Health** | Boolean pass/fail | Command exit code or query returns rows | Consecutive failures (configurable count) |
| **Derived** | Computed from other metrics | Formula referencing other metric IDs | Same as gauge (on computed value) |

#### Schema

See [metrics.md](metrics.md) for the canonical schema (metrics + metric_snapshots tables).

#### Measurement + Alert Loop

```typescript
async function measure(metric: Metric): Promise<void> {
  const value = await measureByType(metric);  // type-specific
  db.insertSnapshot(metric.id, value);

  const prevStatus = metric.status;
  const newStatus = evaluateAlert(metric, value);  // type-specific alert logic

  if (newStatus !== prevStatus) {
    db.updateMetricStatus(metric.id, newStatus);
    if (newStatus === "breach") {
      bus.emit({
        type: "metric.breach",
        source: "metrics-snapshot",
        owner: resolveMetricOwner(metric),
        data: {
          metricId: metric.id,
          metricName: metric.name,
          current: value,
          threshold: metric.threshold,
          target: metric.target,
          message: explainBreach(metric, value),
          priority: metric.priority,
        },
      });
    }
    if (newStatus === "ok" && prevStatus !== "ok") {
      bus.emit({
        type: "metric.recovered",
        source: "metrics-snapshot",
        owner: resolveMetricOwner(metric),
        data: { metricId: metric.id, metricName: metric.name },
      });
    }
    if (newStatus === "stalled") {
      bus.emit({
        type: "metric.stalled",
        source: "metrics-snapshot",
        owner: resolveMetricOwner(metric),
        data: { metricId: metric.id, metricName: metric.name, message: explainStall(metric) },
      });
    }
  }
}
```

#### Display in Agent Prompts

```
## My Metrics
- **api_latency** [gauge]: 180ms (target: <200ms, threshold: 250ms) ✅
- **sessions_completed** [counter]: 12.3/hour (target: >10/hour) ✅
- **build_passing** [health]: FAILING (3 consecutive failures) 🔴
- **success_rate** [derived]: 0.87 = successes/total (target: >0.95) ⚠️
```

---

### 3. Agent Runs — `pi-agent-core` + May Runtime

**Target: one model/tool loop.** Pi's low-level `Agent` owns provider turns,
tool execution, queues, retry classification, and lifecycle events. May owns
durable session policy around that loop.

All execution paths should enter through the manager/SDK/workflow surfaces, not
through adapter-local LLM calls. Handlers prefer `sdk.runWorkflow(...)`; workflows
call `ctx.runAgent(...)` when an agent session is the next step.

The ownership boundary is:

| Capability | Provided by |
|-----------|-------------|
| Provider loop, tool execution, queues | Pi `Agent` |
| Provider retry/error normalization | Pi `Agent` + `pi-ai` |
| Lifecycle subscription | Pi `Agent.subscribe()` |
| Session JSONL and registry | May manager/persistence |
| Deterministic compaction and snapshots | May `transformContext` wrapper, using Pi token estimation |
| Overflow recovery and resume repair | May manager |
| Tool construction, guards, receipts, sandbox paths | May runtime |
| Event/trace bridging | May manager and EventBus |

Pi's harness compactor is not mixed into this low-level path: it assumes Pi's
session tree and `Models` auth runtime and performs an extra LLM call. If May
later adopts the harness session model end to end, that boundary can be
revisited. Until then, mixing the two persistence models would create two
sources of truth.

The exact runtime code lives behind manager/SDK/workflow surfaces; this sketch
shows the ownership boundary, not a literal function body to copy.

```typescript
async function runAgent(agentName: string, task: string, source: string): Promise<SessionResult> {
  const config = loadConfig(agentName);
  const sessionId = generateId();

  const agent = new Agent({
    initialState: {
      systemPrompt: resolveSystemPrompt(config),
      model: resolveModel(config.model),
      tools: buildTools(config),
    },
    beforeToolCall: buildGuards(config),
    transformContext: createSessionCompactionTransform(config, sessionId),
    getApiKey: resolveApiKey(config),
  });

  agent.subscribe((event) => {
    persistMessageEvents(event, sessionId);
    bridgeRuntimeEvent(bus, event, { sessionId, agentName, source });
  });

  await agent.prompt(task);
  await agent.waitForIdle();
  return finalizeDurableSession(agent.state.messages, sessionId);
}
```

---

### 4. Prompt Assembly

The system prompt is deliberately small and stable. Metrics, projects, messages,
and recent history are runtime/session context, not cached system prompt.

This is the design shape. The current implementation is
`projects/may-agent/src/lib/manager.ts -> resolveSystemPrompt()`.

```typescript
function resolveSystemPrompt(config: AgentConfig): string {
  return [
    shared.commonSense,                           // common-sense.md — shared fundamentals
    config.identity,                              // AGENTS.md — role identity
    formatRuntimeEnvironment(config),             // paths, workspace, tools
  ].filter(Boolean).join("\n\n---\n\n");
}
```

---

### 5. Workflows

Agent-defined step sequences with **two step types**: agent steps (LLM) and function steps (JS, no LLM).

```typescript
// Agent step — needs judgment
{ agent: "dev", task: "Implement: {{request}}" }

// Function step — mechanical, no LLM
{ fn: "run-tests", exec: async (ctx) => {
    const r = await ctx.exec("bun test");
    return { outcome: r.exitCode === 0 ? "success" : "error", summary: r.stdout.slice(-500) };
  }
}
```

#### Workflow Context

Function steps use the same safety boundary as agent tools. They do not open DB
files directly, bypass path restrictions, or write outside allowed roots.

Design contract: workflow code gets a context-specific handle over the same
infra capabilities as the SDK. It should not grow a parallel private API.

```typescript
interface WorkflowContext {
  task: string;
  agent: string;
  sdk: InfraSDK;
  runAgent(agent: string, task: string, opts?: RunOpts): Promise<TaskResult>;
  runWorkflow(name: string, task: string, opts?: RunOpts): Promise<WorkflowResult>;
  runFunction<T>(label: string, fn: () => Promise<T>): Promise<T>;
  done(summary: string): WorkflowResult;
  blocked(reason: string, context?: unknown): WorkflowResult;
}
```

#### Crash-Safety

| Step type | Recovery |
|-----------|---------|
| Agent step | `SessionManager.continueRecent()` |
| Function step | Re-run (short, idempotent) |

---

### 6. Messages

One inter-agent communication primitive. Async, persisted, receiver-owned, never blocking.

Messages carry intent + pointer, not large payloads. Shared artifacts remain source of truth.

```json
{
  "type": "message.created",
  "source": "agent:arc",
  "owner": "agent:dev",
  "data": {
    "from": "arc",
    "to": "dev",
    "intent": "implementation-request",
    "artifact": "projects/auth-rewrite/proposal.md",
    "content": "Proposal approved. Please implement."
  }
}
```

**Default behavior (convention over configuration):** messages are accepted
into the receiver's owner inbox and reviewed on the next app-owner pass or
standalone heartbeat. They do not immediately trigger a new agent session.
Urgent work should use an explicit event/session route.

#### Human in the Loop

Human messages arrive via Telegram, web UI, or socket. Routing:

| Scenario | Target |
|----------|--------|
| General message (not a reply) | May's chat session (`kind: "chat"`) |
| Reply to a specific session | That session, via `manager.send()` / `manager.input()` |

Chat sessions use `autoClose: "never"` and persist across restarts. Heartbeats and task work use separate job sessions.

#### Work Queue Pattern

An agent-level convention (not infra). `shared/work-queue.md` has sections: Proposed → Approved → Done. Agents only implement Approved items.

No dedicated work-queue metrics exist currently. The file remains source of truth for the proposal pipeline; agents and humans read it directly.

---

### 7. Projects — the context that drives the work

A project is **the context an agent needs to do meaningful work**: history (what's been tried), background (why this matters), goals (what done looks like), and accumulated experience (what we've learned). Projects make metrics and work items intelligible — a metric without a project is a free-floating number; a session without a project is ad-hoc work.

The autonomous loop runs on projects:

```
project goal
  └─ has metrics that emit signals
      └─ signal wakes a cron/event/heartbeat path
          └─ agent reads project context, signal evidence, and recent history
              └─ agent judges what the signal means
                  └─ agent runs an iteration session
                      └─ writes journal entry capturing what was tried
                          └─ later metrics/sessions validate or falsify; loop
```

Without this loop, agents thrash — re-discovering the same problem each breach, making the same fix that didn't work last time. Project context is what gives them continuity.

Project files keep the current canonical structure:

```markdown
# projects/<projectId>/project.md

## Goal
What we're doing and what done looks like.

## Metrics
Which metrics track this project.
- build_health (health)
- auth_latency (gauge, <200ms)

## Current State
Where we are now, what's active, recent changes.
Includes history of what's been tried to prevent loops.

## Plan
Next steps, approach, constraints.

## References
Related docs, PRs, prior art.
```

Projects answer: "given this signal, what goal and history make it meaningful?"

Project status values: `active`, `waiting`, `blocked`, `pending-review`,
`paused`, `done`, and `closed`. See [projects.md](projects.md) for lifecycle.

DB has a read-only index synced from files. See [projects.md](projects.md) for the canonical schema.

```sql
-- Core columns (see projects.md for full schema)
CREATE TABLE projects (id, name, owner, status, path, updated_at);
```

---

### 8. Storage

**Files** hold editable definitions and full runtime artifacts. **DB** holds
bounded metadata, indexes, and coordination state. See
[storage.md](storage.md) for the authoritative storage and migration contract.

#### Files (git-tracked, hot-reloadable)

| Data | Location | Notes |
|------|----------|-------|
| Agent identity | `agents/<name>/AGENTS.md` | Role and standing plan |
| Agent context | `agents/<name>/context.md` | Durable cross-session facts (auto-loaded) |
| Skills | `agents/<name>/skills/` | Reusable agent capabilities |
| Domain knowledge | `agents/<name>/DOMAIN.md` | Legacy; some agents only |
| Lessons | `agents/<name>/LESSONS.md` | Legacy; some agents only |
| Heartbeat instructions | `agents/<name>/heartbeat.md` | |
| Config | `agents/<name>/agent.json` | |
| Workflows | `projects/<id>.app/agents/<name>/workflows/*.ts`, `agents/<name>/workflows/*.ts` | Owned by the agent that learned and operates the process |
| Projects | `projects/<id>.app/project.json`, `projects/<id>.app/tasks/seed.json`, runtime `.state/tasks/state.json`, generated `.state/tasks/tree.json`, legacy `projects/<id>/project.md` | App definition and seed are source; runtime resources are authoritative and the tree is a read view |
| Work queue | `shared/work-queue.md` | |
| Session transcripts | Pi-coding-agent SessionManager format | |

Runtime-generated artifacts under `.state/` are not git-tracked. Full session
tasks/results, workflow inputs/results, large event bodies, and evaluation
evidence live there; SQLite stores their query projections and references.

#### DB (bounded query/coordination store)

Core tables (see individual docs for canonical schemas):

```sql
CREATE TABLE metrics (...);           -- see metrics.md
CREATE TABLE metric_snapshots (...);  -- see metrics.md
CREATE TABLE sessions (...);          -- see sessions.md
CREATE TABLE events (...);            -- see events.md
CREATE TABLE projects (...);          -- see projects.md
```

Full schemas are in `projects/may-agent/src/lib/db/schema.ts`, with query helpers in `projects/may-agent/src/lib/query-service.ts`. The docs above show the effective columns agents care about.

---

## Non-Negotiables

v2 must preserve:
- Tool guards (ported as runtime middleware)
- Event persistence (all events to SQLite)
- DB single connection + backup/restore
- Telegram context enrichment
- Shared project lifecycle
- query_db read-only access
- Model-specific quirks (gpt-5.5 responses/reasoning config)

---

## Summary

| Component | Role |
|-----------|------|
| Event bus | Backbone — typed pub/sub, all events persisted |
| Metric engine | Typed measurement + alerting → signals for agent judgment |
| Agent runs (glue) | Wire pi-coding-agent to bus |
| Prompt assembly | common-sense + AGENTS.md + runtime facts → system prompt |
| Workflows | Agent steps + function steps, crash-safe |
| Messages | Async inter-agent communication |
| Projects | Context scope for metrics and work |
| Storage | Files (editable) + SQLite (queryable) |

The goal is fewer execution paths, not minimum LOC.

---

## Flows

### Autonomous heartbeat

```
Timer/socket -> timer.tick -> heartbeat handler -> may-heartbeat workflow
  -> ctx.runAgent("may", assembled heartbeat task)
  -> runtime context includes metrics, projects, messages
  -> agent sees build_health FAILING -> calls run_workflow("fix-build", {})
  -> workflow: dev implements fix -> fn: run tests -> done
  -> session.end -> metric engine re-measures -> healthy signal
```

### Reactive metric breach

```
MetricEngine measures api_latency → 300ms (threshold 250ms, 3 consecutive)
  → metric.breach + metric_alert row
  → metric-alert-reactor resolves owner/dedupes
  → metric-alert-triage workflow runs owner judgment
  → owner investigates, fixes, downgrades with evidence, or escalates
```

### Inter-agent communication

```
Agent "arc" calls message("dev", { intent: "implementation-request", artifact: "..." })
  → message.created → persisted → next dev run includes it in prompt
```

---

## Current Convergence

The current direction is not "more infra logic." It is fewer execution paths:

- timers, adapters, and humans emit events;
- each app task resolver correlates semantic events to desired task state;
- one reconciler claims tasks and invokes a reusable workflow or owner fallback;
- standalone infrastructure handlers normalize mechanical system events;
- workflows collect context and run sessions/functions;
- sessions/functions emit evidence;
- metrics and events make the result observable.

Mechanical infra code may still call manager/runtime internals directly, but
new project judgment/action paths should follow task reconciliation. See
`system-boundary.md` for the design and
`../proposals/system-boundary-tracker.md` for historical implementation evidence.

### Runtime Code Shape

The shipped runtime mirrors that convergence:

- `projects/may-agent/src/app/may.ts` is the thin binary entry: version/path setup, lightweight
  emit/web-only modes, model registry setup, then `runAppRuntime`.
- `projects/may-agent/src/app/app-runtime.ts` is the long-running daemon assembly path.
- `projects/may-agent/src/app/daemon.ts` is a stable barrel over focused daemon modules:
  lifecycle, event subscribers, agent startup, requested session startup, and
  runtime loops.
- `projects/may-agent/src/app/agent-loader.ts` is a compatibility surface over
  `projects/may-agent/src/app/loader/*` modules for discovery, config validation, toolsets,
  heartbeat entries, handler hot-reload, and registry orchestration.
- Telegram remains in-process, split into transport, reply routing, outbound
  session-response policy, and the polling adapter.

Do not keep splitting modules just because a file is non-trivial. Split when a
sub-concern changes independently or still hides the event → workflow → session
model.
