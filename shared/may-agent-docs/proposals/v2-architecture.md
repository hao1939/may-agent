# Proposal: May-Agent v2 Architecture

A **metric-driven, event-based autonomous agent system** where:
- Users define typed metrics that drive agent direction
- Agents are role/responsibility/context scopes — multiple agents for scoping, not limitation
- Everything is an event: timers, metric changes, messages, session completions
- Workflows relieve agents from orchestration decisions — predefined, robust, extensible
- `pi-coding-agent` provides the full agent runtime — we don't reinvent it

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
│  Agent tools    ──────────▶ inbox.message     ──▶ runAgent()         │
│  (send, finish)             session.end       ──▶ MetricEngine       │
│                             tool.executed     ──▶ SQLite audit       │
│                                                                      │
│  Pi-coding-agent events are bridged into system events via           │
│  session.subscribe()                                                 │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ all events persisted
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     SQLite (single queryable store)                   │
│  metrics │ metric_snapshots │ sessions │ events │ projects │ inbox    │
└──────────────────────────────────────────────────────────────────────┘
```

**No Scheduler component.** Timers are event sources on the bus — same as metric breaches or inbox messages.

**No Agent Runner component.** `pi-coding-agent`'s `createAgentSession()` IS the runtime. We just wire it to the bus.

---

## Components

### 1. Event Bus (~100 LOC)

Typed pub/sub. The backbone.

```typescript
type SystemEvent =
  | { type: "heartbeat"; agent: string }
  | { type: "metric.breach"; metric: Metric; value: number }
  | { type: "metric.recovered"; metric: Metric }
  | { type: "metric.stalled"; metric: Metric }
  | { type: "session.end"; agent: string; id: string; outcome: Outcome; summary: string }
  | { type: "session.compacted"; agent: string; id: string; reason: string }
  | { type: "tool.executed"; agent: string; sessionId: string; tool: string; args: any }
  | { type: "inbox.message"; to: string; from: string; content: string }
  | { type: "project.stalled"; project: string; owner: string }

// Everything is just: event → handler
bus.on("heartbeat", (e) => runAgent(e.agent, buildHeartbeatTask(e.agent), "heartbeat"));
bus.on("metric.breach", (e) => runAgent(e.metric.owner, buildBreachTask(e), "metric.breach"));
bus.on("inbox.message", (e) => runAgent(e.to, buildInboxTask(e), "inbox.message"));

// Timers are just event sources
registerTimer("may", "*/20 * * * *");  // emits heartbeat every 20min

// All events persisted for audit
bus.onAny((e) => db.insertEvent(e));

// UI backends are just event bus subscribers
bus.onAny((e) => socketServer.broadcast(e));   // WebSocket → web UI
bus.onAny((e) => telegramNotifier.handle(e));  // Telegram alerts
bus.onAny((e) => consoleRenderer.render(e));   // Console output
```

UI backends are not a separate component — they're just subscribers on the bus.

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

#### Type-Specific Config Examples

```typescript
// Gauge
{ source: "query", query: "SELECT avg(latency) FROM requests WHERE ts > ?",
  measure_interval: 300000,
  alert: { mode: "sustained", threshold: 200, direction: "above", consecutive: 3 } }

// Counter
{ source: "query", query: "SELECT count(*) FROM sessions WHERE agent='coder' AND started_at > ?",
  measure_interval: 3600000,
  alert: { mode: "rate", min_rate: 1.0, per: "hour", stall_after: "2h" } }

// Health
{ source: "command", command: "curl -sf http://localhost:8080/health",
  measure_interval: 60000,
  alert: { mode: "consecutive_failures", count: 3 } }

// Derived
{ formula: "metrics.successes / metrics.total",
  alert: { mode: "threshold", threshold: 0.95, direction: "below" } }
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

**No custom agent runtime.** `pi-coding-agent` provides:

| Capability | Provided by |
|-----------|-------------|
| LLM loop + tool execution | `AgentSession` (wraps pi-agent-core `Agent`) |
| Session persistence (crash-safe) | `SessionManager` — append-only per message |
| Auto-compaction | Built-in, triggers on context threshold |
| Auto-retry | Built-in, handles 429/503/overloaded |
| Overflow recovery | Built-in |
| Coding tools | `createCodingTools(cwd)` — read, write, edit, bash, grep, find, ls |
| Tool sandboxing | Built-in, scoped to `cwd` |
| Custom tools | `customTools` option |
| Event subscription | `session.subscribe(listener)` |

**Our glue** wires pi-coding-agent into the event/metric system:

```typescript
async function runAgent(agentName: string, task: string, trigger: string): Promise<SessionResult> {
  const config = loadConfig(agentName);
  const sessionId = generateId();
  const startedAt = Date.now();

  // ── Create session (pi-coding-agent does everything) ───────────
  const { session } = await createAgentSession({
    cwd: config.workspace,
    model: resolveModel(config.model),
    tools: createCodingTools(config.workspace),
    customTools: [
      finishTool,
      sendTool(bus),                    // agent action → system event
      systemStatusTool(db),             // agent reads metrics/sessions
      runWorkflowTool(bus, db),         // agent triggers workflows
      queryDbTool(db),                  // raw SQL for power agents
    ],
  });

  // ── Inject system prompt (metrics drive direction) ─────────────
  session.agent.state.systemPrompt = buildPrompt(config, db);

  // ── Bridge: pi-coding-agent events → system EventBus ───────────
  let turns = 0;
  session.subscribe((event) => {
    switch (event.type) {
      case "agent_end":
        const result = extractResult(event.messages);
        db.insertSession({ id: sessionId, agent: agentName, task, trigger, turns, startedAt, ...result });
        bus.emit({ type: "session.end", agent: agentName, id: sessionId, ...result });
        break;
      case "tool_execution_end":
        bus.emit({ type: "tool.executed", agent: agentName, sessionId, tool: event.toolName, args: event.args });
        break;
      case "turn_end":
        turns++;
        if (turns >= config.maxTurns) session.agent.abort();
        break;
      case "compaction_end":
        bus.emit({ type: "session.compacted", agent: agentName, sessionId, reason: event.reason });
        break;
    }
  });

  // ── Run ────────────────────────────────────────────────────────
  await session.prompt(task);
  return extractResult(session.agent.state.messages);
}
```

#### The Integration Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────┐    prompt injection    ┌────────────────────┐    │
│  │  Metrics │ ──────────────────────▶│  Agent (pi-coding) │    │
│  │  Engine  │                        │                    │    │
│  │          │◀─── session.end ───────│  tools: send,      │    │
│  │  measure │     (counter update)   │  system_status,    │    │
│  │  alert   │                        │  run_workflow,     │    │
│  │  emit    │                        │  finish            │    │
│  └────┬─────┘                        └─────────┬──────────┘    │
│       │                                        │               │
│       │ metric.breach                          │ inbox.message  │
│       ▼                                        ▼               │
│  ┌─────────────────── Event Bus ──────────────────────────┐    │
│  │  heartbeat │ metric.breach │ session.end │ inbox.message│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Three integration points:**

1. **Metrics → Agent** (prompt injection): Agent sees typed metrics in system prompt — this IS the "direction"
2. **Agent → System** (custom tools emit events): `send()` → `inbox.message`, `finish()` → session result, `run_workflow()` → more agent runs
3. **System → Metrics** (measurement from session data): Counter/gauge metrics query the sessions table, closing the loop

---

### 4. Prompt Assembly (~100 LOC)

Where metrics become agent direction.

```typescript
function buildPrompt(config: AgentConfig, db: Db): string {
  return [
    config.soul,                                  // SOUL.md — role identity
    config.domain,                                // DOMAIN.md — domain knowledge
    formatMetrics(db.getMetrics(config.name)),     // typed metric display with status
    formatProjects(db.getProjects(config.name)),   // active projects with iterations
    formatInbox(db.getUnreadInbox(config.name)),   // pending messages from other agents
    config.lessons,                                // LESSONS.md — learned patterns
  ].filter(Boolean).join("\n\n---\n\n");
}
```

---

### 5. Workflows (~150 LOC)

Agent-defined step sequences with **two step types**: agent steps (LLM) and function steps (JS, no LLM). Function steps save LLM calls by interacting with infra directly.

**Crash-safe via pi-coding-agent session resume.** Each agent step is a full `runAgent()` call. If the process crashes mid-step, pi-coding-agent's `SessionManager` has the partial transcript on disk. On restart, resume via `continueRecent()`.

#### Two Step Types

```typescript
// Agent step — runs an LLM agent (expensive, for judgment/creativity)
{ agent: "coder", task: "Implement: {{request}}" }

// Function step — runs JS directly (cheap, for mechanical ops)
{ fn: "run-tests", exec: async (ctx) => {
    const r = await ctx.exec("bun vitest --run");
    return { outcome: r.exitCode === 0 ? "success" : "error", summary: r.stdout.slice(-500) };
  }
}
```

#### Workflow Step Context (for function steps)

Function steps get the same capabilities as agent tools — but without LLM overhead:

```typescript
interface WorkflowStepContext {
  // Equivalent to agent's coding tools
  exec: (cmd: string) => Promise<ExecResult>;   // = bash tool
  readFile: (path: string) => string;            // = read tool
  writeFile: (path: string, content: string) => void; // = write tool

  // Equivalent to agent's system tools
  db: Db;                                        // = query_db tool
  bus: EventBus;                                 // = send tool (emit events)
  runWorkflow: (name: string, input: Record<string, string>) => Promise<WorkflowResult>; // = run_workflow tool
  metrics: MetricEngine;                         // = system_status tool (read/write metrics)

  // Step context
  prev?: StepResult;                             // previous step's result
  input: Record<string, string>;                 // workflow input vars
}
```

**Principle: function steps can do anything an agent can — minus judgment.** The context interface mirrors the tool surface. If an agent has a tool for it, a function step has a method for it. The difference: agents add reasoning, function steps are mechanical.

#### Example: implement → test → fix → measure (2 LLM calls, 2 JS calls)

```typescript
// agents/tech-lead/workflows/implement-and-verify.ts
export default {
  name: "implement-and-verify",
  steps: [
    { agent: "coder", task: "Implement: {{request}}" },
    { fn: "test", exec: async (ctx) => {
        const r = await ctx.exec("bun vitest --run");
        return { outcome: r.exitCode === 0 ? "success" : "error", summary: r.stdout.slice(-500) };
      },
    },
    { agent: "coder", task: "Fix failures:\n{{prev.summary}}", when: "prev.outcome == 'error'" },
    { fn: "record-metric", exec: async (ctx) => {
        const count = ctx.db.prepare("SELECT count(*) as c FROM sessions WHERE outcome='success' AND started_at > ?").get(Date.now() - 86400000);
        return { outcome: "success", summary: `${count.c} successes in 24h` };
      },
    },
  ]
}
```

#### Runner (with crash recovery)

```typescript
async function runWorkflow(name: string, input: Record<string, string>): Promise<WorkflowResult> {
  const workflow = loadWorkflow(name);
  const runId = generateId();
  let prev: StepResult | undefined;

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];

    // Crash recovery: skip completed steps
    const existing = db.getWorkflowStep(runId, i);
    if (existing?.outcome === "success") { prev = existing; continue; }
    if (existing?.outcome === "interrupted" && step.agent) {
      prev = await resumeAgent(existing.sessionId);
      db.updateWorkflowStep(runId, i, prev);
      continue;
    }

    // Evaluate 'when' condition
    if (step.when && !evaluate(step.when, { prev })) continue;

    // Execute based on step type
    if (step.agent) {
      const task = template(step.task, { ...input, prev });
      prev = await runAgent(step.agent, task, `workflow:${name}`);
    } else if (step.fn) {
      const ctx: WorkflowStepContext = { db, bus, exec, readFile, writeFile, runWorkflow, metrics, prev, input };
      prev = await step.exec(ctx);
    }

    db.insertWorkflowStep({ runId, index: i, agent: step.agent || step.fn, ...prev });
  }

  return { steps: results, outcome: prev!.outcome };
}
```

#### Crash-Safety

| Step type | Crash recovery |
|-----------|---------------|
| Agent step | Pi-coding-agent `SessionManager` has partial transcript → `continueRecent()` |
| Function step | Re-run (functions are short, idempotent) |

Agents trigger workflows via the `run_workflow` tool. Workflows compose — a function step can call `runWorkflow()` for nested orchestration.

---

### 6. Custom Tools (~300 LOC)

These are the agent↔system bridge. Pi-coding-agent provides coding tools (read/write/edit/bash/grep/find/ls). We add system-level tools:

| Tool | Agent action | System effect |
|------|-------------|---------------|
| `finish` | Declare task complete with summary | Session ends, result persisted |
| `send` | Message another agent | `inbox.message` event → next run includes it |
| `system_status` | View metrics, sessions, projects | Reads from SQLite |
| `run_workflow` | Trigger a named workflow | Sequential agent runs |
| `query_db` | Raw SQL (power agents only) | Direct SQLite access |

---

### 7. Storage: Files vs DB

**Principle: Files for things humans/agents edit. DB for things the system produces and queries.**

#### Files (human/agent-editable, git-tracked, hot-reloadable)

| Data | Location | Edited by |
|------|----------|-----------|
| Agent identity | `agents/<name>/SOUL.md` | Human |
| Domain knowledge | `agents/<name>/DOMAIN.md` | Human/optimizer |
| Learned lessons | `agents/<name>/LESSONS.md` | Evaluator agent |
| Heartbeat instructions | `agents/<name>/heartbeat.md` | Human |
| Agent config | `agents/<name>/agent.json` | Human |
| Workflow definitions | `agents/<name>/workflows/*.ts` | Human/agent |
| Additional knowledge | `agents/<name>/knowledge/` | Human/agent |
| Project definitions | `agents/<name>/projects/*.md` | Human/agent |
| Session transcripts | Pi-coding-agent's SessionManager format | System (library handles it) |

#### DB (system-produced, queryable, time-series)

```sql
-- Metrics (typed, with snapshots for trends)
CREATE TABLE metrics (id, name, type, owner, config, current, status, project, description, created_at, updated_at);
CREATE TABLE metric_snapshots (metric_id, value, measured_at);

-- Session metadata (queryable summaries — full transcripts in files)
CREATE TABLE sessions (id, agent, task, trigger, outcome, summary, started_at, ended_at, turns, tokens_in, tokens_out, cost);

-- Event audit trail
CREATE TABLE events (id, type, agent, payload_json, created_at);

-- Inter-agent communication
CREATE TABLE inbox (id, to_agent, from_agent, content, created_at, read_at);

-- Project index (cache of project.md frontmatter — file is source of truth)
CREATE TABLE project_index (id, name, owner, status, iteration, path, last_synced_at);
```

#### Project Index Pattern

Projects live as `project.md` files (human/agent-editable). DB has a **read-only index** synced on access:

```typescript
function syncProjectIndex(agentsRoot: string): void {
  const projectFiles = glob("agents/*/projects/*.md");
  for (const file of projectFiles) {
    const frontmatter = parseFrontmatter(file);
    db.upsertProjectIndex({ ...frontmatter, path: file, last_synced_at: Date.now() });
  }
}
```

---

### 8. Config Loader (~100 LOC)

```
agents/
  may/
    agent.json          -- name, model, tools, maxTurns, cron
    SOUL.md             -- identity and role
    DOMAIN.md           -- domain knowledge
    LESSONS.md          -- learned lessons
    heartbeat.md        -- heartbeat instructions
    workflows/          -- workflow definitions (data)
    knowledge/          -- additional context files
```

Hot-reload: files read at session start. Edit → takes effect next run.

---

## Summary

| Component | LOC | Role |
|-----------|-----|------|
| Event bus | ~100 | Backbone — connects everything |
| Metric engine (typed) | ~500 | THE core value — measures, alerts, drives direction |
| Agent runs (glue) | ~50 | Wire pi-coding-agent to bus |
| Prompt assembly | ~100 | Metrics → agent direction |
| Workflows | ~150 | Robust orchestration sequences |
| Custom tools | ~300 | Agent↔system bridge |
| SQLite store | ~200 | Single queryable truth |
| Config loader | ~100 | Load agent definitions |
| **Total** | **~1,500** | |

Down from ~22,600 LOC.

---

## Flows

### Autonomous heartbeat

```
Timer → heartbeat("may") → runAgent("may", heartbeat.md, "heartbeat")
  → pi-coding-agent creates AgentSession
  → system prompt includes: metrics 🔴⚠️✅, projects, inbox
  → agent sees build_health FAILING → calls run_workflow("fix-build", {})
  → workflow: coder implements fix → fn: run tests → done
  → session.end → metric engine re-measures build_health → ✅
```

### Reactive metric breach

```
MetricEngine measures api_latency → 300ms (threshold 250ms, 3 consecutive)
  → metric.breach event → runAgent("may", "api_latency breached...", "metric.breach")
  → agent investigates, triggers workflow
```

### Inter-agent communication

```
Agent "arc" calls send("may", "auth failures repeating — suggest rate limiting")
  → inbox.message event → persisted to inbox table
  → next may heartbeat → prompt includes inbox → may acts on it
```

### Evaluation (event-driven, real-time)

```
session.end event (any agent)
  → bus handler: runAgent("evaluator", "Evaluate session ${id}...", "session.end")
  → evaluator reads session transcript, scores quality/efficiency
  → updates metrics: agent_x_quality [gauge], agent_x_efficiency [gauge]
  → appends lessons to agents/<name>/LESSONS.md
  → if quality drops → metric.breach → may notified
```

---

## Value Added vs Current System

| Gain | Why it matters |
|------|---------------|
| **Typed metrics** (gauge/counter/health/derived) | Agents understand what a number means — rate, trend, consecutive failures. Better decisions. |
| **Event-driven reactivity** | Real-time response to breaches, messages, completions. Not just cron polling. |
| **Real-time evaluation** | Every session evaluated immediately. Lessons before next run. |
| **One pattern for everything** | Heartbeats, breaches, evaluation — all `event → runAgent()`. |
| **15x less code** (1,500 vs 22,600 LOC) | Fits in your head. New contributor productive in an hour. |
| **Free library upgrades** | Pi-coding-agent improves → we benefit automatically. |
| **Function steps in workflows** | Save ~50% LLM calls on mechanical operations. |
| **UI backends for free** | WebSocket/Telegram/console = bus subscribers. |

## What We Lose

| Lost | Severity | Mitigation |
|------|----------|------------|
| **14 tool guards** | Medium | Pi-coding-agent sandboxing + add back as needed. |
| **Session trees / cascading cancel** | Low | Agents independent. Turn budgets suffice. |
| **Mid-session steering** | Low | Sessions short. Next heartbeat handles it. |
| **Direct agent-to-agent calls** | Low | Workflows orchestrate. Send for async. |

---

## Migration Path

1. Add `@mariozechner/pi-coding-agent` as dependency
2. Implement event bus + metric engine (can coexist with current system)
3. Implement `runAgent()` glue function using `createAgentSession()`
4. Port metric definitions from current flat schema to typed schema
5. Wire cron configs (from agent.json) as timer event sources
6. Add custom tools (send, system_status, run_workflow, finish)
7. Port workflow definitions to simple step format
8. Verify: same agents fire, metrics measured, sessions complete
9. Delete: SubagentManager, workflow-tool.ts, guards, JSONL persistence, growth
