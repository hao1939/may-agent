# Proposal: May-Agent v2 Architecture

**Status**: ✅ Phases 1–5 implemented. Observation phase active. See `v2-migration-plan.md` and `v2-implementation-notes.md` for what landed.

Goal: reduce runtime complexity by converging on one primitive:

```
event → runAgent() → session.end
```

Migration must be incremental. The current system is production-active.

---

A **metric-driven, event-based autonomous agent system** where:
- **Projects are context.** Each project carries its own history, background, goals, and accumulated experience. Agents pick up that context when they work, so each iteration builds on what came before instead of starting fresh.
- **Metrics are vitals.** Typed metrics measure progress toward project goals (and overall system health). Metrics are how the system *sees itself* — they don't drive work directly so much as they signal what needs attention.
- **Heartbeats are agency.** A heartbeat is the recurring moment when an agent has the chance to be autonomous: read context, decide what's worth doing, act, record. Heartbeats are how ownership manifests. See `design/heartbeat-as-agency.md`.
- Agents are role/responsibility/context scopes — accountability boundaries that own a domain.
- Everything is an event: timers, metric changes, messages, session completions.
- Workflows relieve agents from orchestration decisions.
- `pi-coding-agent` provides the full agent runtime — we don't reinvent it.
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
| Storage (files + SQLite) | Project docs, knowledge bases |
| Safety (guards as middleware) | — |
| Continuity (crash recovery) | — |
| Workflows (step execution) | Implement-and-verify, review flows |

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
- **Memory across sessions**: metrics history, lessons, past session summaries (needs further design)

The agent just works. The infra triggers, frames, protects, records, and connects the dots.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Event Bus                                   │
│                                                                      │
│  Event Sources              Events               Event Handlers      │
│  ─────────────              ──────               ──────────────      │
│  Timers (cron)  ──────────▶ heartbeat         ──▶ runAgent()         │
│  Metric Engine  ──────────▶ metric.breach     ──▶ runAgent()         │
│                             metric.recovered                         │
│                             metric.stalled                           │
│  Agent tools    ──────────▶ message.created   ──▶ ack + queue      │
│  (message, finish)          session.end       ──▶ MetricEngine       │
│                             tool.executed     ──▶ SQLite audit       │
│                                                                      │
│  Pi-coding-agent events are bridged into system events via           │
│  session.subscribe()                                                 │
└───────────────────────────────────────────────────────────────────────┘
                                    │ all events persisted
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     SQLite (single queryable store)                   │
│  metrics │ metric_snapshots │ sessions │ events │ projects            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Event Bus (~100 LOC)

Typed pub/sub. The backbone.

```typescript
type SystemEvent =
  | { type: "heartbeat"; agent: string }
  | { type: "handler.started"; handler: string; agent: string }
  | { type: "handler.completed"; handler: string; agent: string; durationMs: number }
  | { type: "handler.failed"; handler: string; agent: string; error: string; durationMs: number }
  | { type: "metric.breach"; metric: Metric; value: number }
  | { type: "metric.recovered"; metric: Metric }
  | { type: "session.start"; agent: string; id: string; trigger: string; task: string }
  | { type: "session.end"; agent: string; id: string; outcome: Outcome; summary: string }
  | { type: "tool.executed"; agent: string; sessionId: string; tool: string; args: any }
  | { type: "message.created"; from: string; to: string; content: string; intent?: string; artifact?: string; priority?: "P0" | "P1" | "P2" | "P3" }

// Heartbeat is a bus event — anything can trigger it: cron timer, socket command,
// manual trigger, another agent. The bus is the single path.
bus.on("heartbeat", (e) => runAgent(e.agent, buildHeartbeatTask(e.agent), "heartbeat"));

// Metric breach: only P0 (urgent) metrics fork directly. Everything else informs
// the owning agent's next heartbeat via prompt context.
bus.on("metric.breach", (e) => {
  if (e.metric.priority === "P0") runAgent(e.metric.owner, buildBreachTask(e), "metric.breach");
  // P1+: breach is in DB, owning agent will see it at next heartbeat
});

// Messages: persisted to events table (owner = to_agent), included in next heartbeat.
// No separate messages table — events table with owner field serves as inbox.
bus.on("message.created", (e) => { /* already persisted by bus.emit() */ });

// Timers are event sources — cron emits heartbeat events on the bus
registerTimer("may", "*/20 * * * *");  // emits { type: "heartbeat", agent: "may" }

// Event persistence is part of emit, not a subscriber.
// Implemented inside bus.emit():
//   function emit(e: SystemEvent) {
//     db.insertEvent(e);              // durable first
//     for (const h of handlers) h(e); // then side-effects
//   }

// UI backends are just event bus subscribers
bus.onAny((e) => socketServer.broadcast(e));   // WebSocket → web UI
bus.onAny((e) => telegramNotifier.handle(e));  // Telegram alerts
bus.onAny((e) => consoleRenderer.render(e));   // Console output
```

---

### 2. Metric Engine (~500 LOC)

Typed metrics with type-specific measurement, alerting, and display.

#### Types

| Type | Semantics | Measurement | Alert Modes |
|------|-----------|-------------|-------------|
| **Gauge** | Point-in-time, can go up/down | Sample via query/command | Threshold (instant/sustained), trend (rate of change) |
| **Counter** | Monotonically increasing, exposed as rate | Query delta between intervals | Rate too high/low, stalled (no increment for N intervals) |
| **Health** | Boolean pass/fail | Command exit code or query returns rows | Consecutive failures (configurable count) |
| **Derived** | Computed from other metrics | Formula referencing other metric IDs | Same as gauge (on computed value) |

#### Schema

```sql
CREATE TABLE metrics (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,  -- 'gauge' | 'counter' | 'health' | 'derived'
  owner       TEXT NOT NULL,  -- agent responsible for this metric
  config      TEXT NOT NULL,  -- JSON: type-specific source, thresholds, alert rules
  current     REAL,
  status      TEXT DEFAULT 'ok',  -- 'ok' | 'breach' | 'stalled' | 'failing'
  project     TEXT,
  description TEXT,
  created_at  INTEGER,
  updated_at  INTEGER
);

CREATE TABLE metric_snapshots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id   TEXT NOT NULL,
  value       REAL,
  measured_at INTEGER NOT NULL
);
```

#### Measurement + Alert Loop

```typescript
async function measure(metric: Metric): Promise<void> {
  const value = await measureByType(metric);  // type-specific
  db.insertSnapshot(metric.id, value);

  const prevStatus = metric.status;
  const newStatus = evaluateAlert(metric, value);  // type-specific alert logic

  if (newStatus !== prevStatus) {
    db.updateMetricStatus(metric.id, newStatus);
    if (newStatus === "breach") bus.emit({ type: "metric.breach", metric, value });
    if (newStatus === "ok" && prevStatus !== "ok") bus.emit({ type: "metric.recovered", metric });
    if (newStatus === "stalled") bus.emit({ type: "metric.stalled", metric });
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

### 3. Agent Runs — `pi-coding-agent` + Glue (~50 LOC)

**Target: no custom agent runtime loop.** `pi-coding-agent` owns the LLM/tool/session loop.

**Migration:** all callers use `AgentRuntime.runAgent()`. Initially it wraps the current manager. Eventually it delegates directly to pi-coding-agent.

`pi-coding-agent` provides:

| Capability | Provided by |
|-----------|-------------|
| LLM loop + tool execution | `AgentSession` |
| Session persistence (crash-safe) | `SessionManager` — append-only per message |
| Auto-compaction | Built-in, triggers on context threshold |
| Auto-retry | Built-in, handles 429/503/overloaded |
| Overflow recovery | Built-in |
| Coding tools | `createCodingTools(cwd)` |
| Tool sandboxing | Built-in, scoped to `cwd` |
| Custom tools | `customTools` option |
| Event subscription | `session.subscribe(listener)` |

**Our glue** wires pi-coding-agent into the event/metric system:

```typescript
async function runAgent(agentName: string, task: string, trigger: string): Promise<SessionResult> {
  const config = loadConfig(agentName);
  const sessionId = generateId();

  const { session } = await createAgentSession({
    cwd: config.workspace,
    model: resolveModel(config.model),
    tools: createCodingTools(config.workspace),
    customTools: [
      finishTool,
      messageTool(bus),                 // → message.created event
      systemStatusTool(db),             // read metrics/sessions
      runWorkflowTool(bus, db),         // trigger workflows
      queryDbTool(db),                  // read-only SQL
    ],
  });

  session.agent.state.systemPrompt = buildPrompt(config, db);

  // Bridge pi-coding-agent events → system EventBus
  session.subscribe((event) => {
    if (event.type === "agent_end") {
      const result = extractResult(event.messages);
      db.insertSession({ id: sessionId, agent: agentName, task, trigger, ...result });
      bus.emit({ type: "session.end", agent: agentName, id: sessionId, ...result });
    }
    if (event.type === "tool_execution_end") {
      bus.emit({ type: "tool.executed", agent: agentName, sessionId, tool: event.toolName, args: event.args });
    }
  });

  await session.prompt(task);
  return extractResult(session.agent.state.messages);
}
```

---

### 4. Prompt Assembly (~100 LOC)

Where metrics become agent direction.

```typescript
function buildPrompt(config: AgentConfig, db: Db): string {
  return [
    config.soul,                                  // SOUL.md — role identity
    config.domain,                                // DOMAIN.md — domain knowledge
    formatMetrics(db.getMetrics(config.name)),     // typed metrics with status
    formatProjects(db.getProjects(config.name)),   // active projects
    formatMessages(db.getUnread(config.name)),     // pending messages
    config.lessons,                                // LESSONS.md — learned patterns
  ].filter(Boolean).join("\n\n---\n\n");
}
```

---

### 5. Workflows (~150 LOC)

Agent-defined step sequences with **two step types**: agent steps (LLM) and function steps (JS, no LLM).

```typescript
// Agent step — needs judgment
{ agent: "coder", task: "Implement: {{request}}" }

// Function step — mechanical, no LLM
{ fn: "run-tests", exec: async (ctx) => {
    const r = await ctx.exec("bun vitest --run");
    return { outcome: r.exitCode === 0 ? "success" : "error", summary: r.stdout.slice(-500) };
  }
}
```

#### Workflow Step Context

Function steps use the same safety boundary as agent tools. They do not open DB files directly, bypass path restrictions, or write outside allowed roots.

```typescript
interface WorkflowStepContext {
  exec: (cmd: string) => Promise<ExecResult>;            // scoped, same sandbox as bash tool
  readFile: (path: string) => string;                    // scoped to workspace
  writeFile: (path: string, content: string) => void;   // scoped to workspace
  queryDb: (sql: string) => any[];                       // read-only
  emit: (event: SystemEvent) => void;                    // bus.emit
  runWorkflow: (name: string, input: Record<string, string>) => Promise<WorkflowResult>;
  prev?: StepResult;
  input: Record<string, string>;
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
  "from": "arc",
  "to": "dev",
  "intent": "implementation-request",
  "artifact": "agents/shared/projects/auth-rewrite/proposal.md",
  "content": "Proposal approved. Please implement."
}
```

**Default behavior (convention over configuration):** messages are ack'd and queued for the receiver's next heartbeat. They do NOT immediately trigger a new agent session. Agents can register custom handlers to override this if urgency requires it.

#### Work Queue Pattern

An agent-level convention (not infra). `agents/shared/work-queue.md` has sections: Proposed → Approved → Done. Agents only implement Approved items.

Infra observes via metrics: `work-queue.proposed-pending`, `work-queue.approved-pending`. Work queue metrics are measured from the file by source command; the file remains source of truth.

---

### 7. Projects — the context that drives the work

A project is **the context an agent needs to do meaningful work**: history (what's been tried), background (why this matters), goals (what done looks like), and accumulated experience (what we've learned). Projects make metrics and work items intelligible — a metric without a project is a free-floating number; a session without a project is ad-hoc work.

The autonomous loop runs on projects:

```
project goal
  └─ has metrics that measure progress
      └─ metric breach signals "this iteration didn't work"
          └─ agent's next heartbeat reads project context (history, goal, experience)
              └─ agent decides next iteration based on context
                  └─ agent runs an iteration session
                      └─ writes journal entry capturing what was tried
                          └─ project advances; metric updates; loop
```

Without this loop, agents thrash — re-discovering the same problem each breach, making the same fix that didn't work last time. Project context is what gives them continuity.

Project files keep the current canonical structure:

```markdown
# agents/shared/projects/<projectId>/project.md

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

Projects answer: "given this metric is red, what's the context?"

Project status values: active, blocked, waiting, closed. Only humans/may close projects.

DB has a read-only index synced from files. The index is derived from canonical markdown sections, not frontmatter (current project files don't use frontmatter).

```sql
CREATE TABLE project_index (id, name, owner, status, path, last_synced_at);
```

---

### 8. Storage

**Files** for things humans/agents edit. **DB** for things the system produces and queries.

#### Files (git-tracked, hot-reloadable)

| Data | Location |
|------|----------|
| Agent identity | `agents/<name>/SOUL.md` |
| Domain knowledge | `agents/<name>/DOMAIN.md` |
| Lessons | `agents/<name>/LESSONS.md` |
| Heartbeat instructions | `agents/<name>/heartbeat.md` |
| Config | `agents/<name>/agent.json` |
| Workflows | `agents/<name>/workflows/*.ts` |
| Projects | `agents/shared/projects/<id>/project.md` |
| Work queue | `agents/shared/work-queue.md` |
| Session transcripts | Pi-coding-agent SessionManager format |

#### DB (queryable, time-series)

```sql
CREATE TABLE metrics (id, name, type, owner, config, current, status, project, description, created_at, updated_at);
CREATE TABLE metric_snapshots (metric_id, value, measured_at);
CREATE TABLE sessions (id, agent, task, trigger, outcome, summary, started_at, ended_at, turns, tokens_in, tokens_out, cost);
CREATE TABLE events (id, type, source, owner, data, timestamp, urgency);
CREATE TABLE project_index (id, name, owner, status, path, last_synced_at);
```

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
| Metric engine | Typed measurement + alerting → drives agent direction |
| Agent runs (glue) | Wire pi-coding-agent to bus, ~50 LOC |
| Prompt assembly | Metrics + projects + messages → system prompt |
| Workflows | Agent steps + function steps, crash-safe |
| Messages | Async inter-agent communication |
| Projects | Context scope for metrics and work |
| Storage | Files (editable) + SQLite (queryable) |

~1,500 LOC core skeleton. Realistic production target: 8k–12k LOC (guards, Telegram, error handling, edge cases). The goal is fewer execution paths, not minimum LOC.

---

## Flows

### Autonomous heartbeat

```
Timer → heartbeat("may") → runAgent("may", heartbeat.md, "heartbeat")
  → system prompt includes: metrics, projects, messages
  → agent sees build_health FAILING → calls run_workflow("fix-build", {})
  → workflow: coder implements fix → fn: run tests → done
  → session.end → metric engine re-measures → ✅
```

### Reactive metric breach

```
MetricEngine measures api_latency → 300ms (threshold 250ms, 3 consecutive)
  → metric.breach → runAgent("may", "api_latency breached...", "metric.breach")
  → agent investigates, triggers workflow
```

### Inter-agent communication

```
Agent "arc" calls message("dev", { intent: "implementation-request", artifact: "..." })
  → message.created → persisted → next dev run includes it in prompt
```

---

## What We Lose

| Lost | Severity | Mitigation |
|------|----------|------------|
| **14 tool guards** | **HIGH** | Must be ported as runtime middleware before cutover. |
| **Production hardening** | **HIGH** | Preserve DB backup, Telegram context, zombie cleanup. |
| **Session trees / cascading cancel** | Low | Agents independent. Turn budgets suffice. |
| **Mid-session steering** | Low | Sessions short. Next heartbeat handles it. |

---

## Migration Strategy

0. Build a parallel test harness that runs both runtimes against the same heartbeat fixture and compares session.end shape. Ensures the wrapper is contract-compatible before cutover.
1. Define `AgentRuntime.runAgent()` interface wrapping current manager
2. Route dev/arc/scout through it first
3. Port guards as runtime middleware
4. Add typed metrics incrementally
5. Add function workflow steps
6. Collapse cron into event-source + handler
7. Migrate evaluator
8. Migrate May last
9. Delete old manager only after no imports remain

---

## Acceptance Criteria

Before old runtime deletion:
- dev/arc/scout complete 20 consecutive heartbeats without error
- session.error-rate-6h does not increase
- handler.success-rate stays >0.95
- message.created events persist and display in receiver context
- Telegram replies remain context-enriched
- DB backup/restore cycle verified

Guard acceptance (specific):
- finish-guard blocks unsupported completion
- read-before-edit blocks blind edits
- verify-after-write blocks unverified writes
- path guard blocks out-of-scope writes
- query_db remains read-only and never exposes DB file path
- tool schema guard blocks malformed tool calls
- commit guard prevents unsafe/unreviewed commits where configured

Work queue observability:
- work-queue.proposed-pending is measured
- work-queue.approved-pending is measured
- oldest approved item age is visible
