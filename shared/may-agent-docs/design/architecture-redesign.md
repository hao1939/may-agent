# May-Agent Architecture Redesign

## Current State

Everything lives in one monolith (`may.ts` — 1089 lines). Models, cron, UI, recovery, context learning, event routing — all tangled together.

## Core Concept

Core owns an EventBus. Subscribers attach to it. Core emits events. That's the only integration point.

```typescript
// The entire event system
class EventBus {
  private subscribers: Array<(event: AgentEvent) => void> = [];

  subscribe(fn: (event: AgentEvent) => void): () => void {
    this.subscribers.push(fn);
    return () => { this.subscribers = this.subscribers.filter(s => s !== fn); };
  }

  emit(event: AgentEvent): void {
    for (const fn of this.subscribers) {
      try { fn(event); } catch { /* never breaks core */ }
    }
  }
}
```

Zero subscribers = silent. Core still works. Add subscribers for what you need.

## Components

### 1. Core

The multi-agent runtime. Owns the EventBus.

**Contains:**
- EventBus (created by core, subscribers attach from outside)
- SubagentManager (session lifecycle, agent registry)
- Agent tools (coding, agents, workflow, finish, cli-agents)
- Workflow engine
- Compaction, handoff, context summarization
- Session persistence (JSONL on filesystem)

**API:**
```typescript
const bus = new EventBus();
const manager = new SubagentManager({ eventBus: bus, persistDir, projectRoot });

manager.register(agentDef);
manager.run("coder", task);
manager.callAgent("coder", task);
manager.input(sessionId, text);
manager.cancel(sessionId);
```

**Core emits, never subscribes.** Core calls `bus.emit(event)` when things happen. It never calls `bus.subscribe()` — that's for consumers.

**Core does NOT import:** DB, socket, console, telegram, cron, models config.

### 2. Subscribers

Each subscriber is a function that receives events. Independent of each other. Register what you need.

```typescript
// Full system
bus.subscribe(consoleRenderer);      // render to terminal
bus.subscribe(dbWriter);             // persist to SQLite
bus.subscribe(socketBroadcaster);    // stream to web UI clients
bus.subscribe(telegramForwarder);    // forward to telegram
bus.subscribe(contextLearner);       // post-session learning

// Gym runner — nothing. Zero subscribers. Core still works.

// Oneshot — just DB
bus.subscribe(dbWriter);
```

**Subscriber examples:**

```typescript
// Console: render primary session, hide background
function consoleRenderer(event: AgentEvent) {
  if (event.type === "text" && event.sessionId === primarySid) {
    process.stdout.write(event.text);
  }
}

// DB: track sessions and requests
function dbWriter(event: AgentEvent) {
  if (event.type === "session_start") upsertSession(db, event);
  if (event.type === "session_end") updateSession(db, event);
  if (event.type === "message_created") insertRequest(db, event);
}

// Socket: broadcast to connected clients
function socketBroadcaster(event: AgentEvent) {
  for (const client of clients) {
    if (client.filter === null || client.filter.has(event.sessionId)) {
      client.write(JSON.stringify(event));
    }
  }
}
```

### 3. Interfaces

Connections between humans and core. Each subscribes to the bus and sends commands to core.

**Socket server:**
- Subscribes to bus → broadcasts events to connected clients
- Receives commands → calls manager.input/steer/cancel/fork

**Console:**
- Subscribes to bus → renders events to terminal
- Readline → calls manager via ChatSession helper

**Telegram:**
- Subscribes to bus → forwards notifications to chat
- Receives messages → calls manager via ChatSession

### 4. Cron System

Time-triggered job execution. Separate module.

- Reads cron.json, manages intervals
- Triggers jobs via manager.run() (in-process) or socket (cross-process)
- Handlers (evaluate-sessions, watchdog) are JS functions called directly
- Does NOT subscribe to bus (it triggers, doesn't observe)

### 5. Web UI

HTTP server + static dashboard.

- REST API reads from DB (sessions, requests, stats)
- WebSocket proxies to socket server for real-time events
- Does NOT import core — connects via socket + DB

### 6. DB (SQLite)

Just a subscriber. Receives events, writes rows.

- `sessions` — mirrors session lifecycle events
- `requests` — tracks message/task assignments
- `evaluations` — quality scores (written by evaluator handler)
- `gym_runs` / `gym_checks` — benchmark results

Web UI and cron handlers READ from DB. The DB subscriber WRITES to DB. No other component writes directly.

## Event Types

```typescript
type AgentEvent =
  // Session-scoped (carry sessionId)
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; outcome?: string }

  // System-scoped
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "message_created"; from: string; to: string; task: string; requestId: string }
  | { type: "context-learn"; agentName: string; sessionId: string }
  | { type: "eval"; verdict: string; efficiency: number; quality: number };
```

## Dependency Graph

```
                    ┌──────────┐
                    │  Web UI  │
                    │ (reads)  │
                    └────┬─────┘
                         │ socket + DB reads
                         │
┌──────────┐   subscribe ┌────┴──────────────────────────┐ subscribe   ┌──────────┐
│ Console  ├────────────▶│         EventBus              │◀────────────┤ Telegram │
└──────────┘             │  (owned by core, open to all) │             └──────────┘
                         └────┬──────────┬───────────────┘
                    subscribe │          │ subscribe
                         ┌────┴───┐ ┌───┴────┐
                         │   DB   │ │Context │
                         │Writer  │ │Learner │
                         └────┬───┘ └────────┘
                              │ writes
                         ┌────┴───┐
                         │ SQLite │
                         └────────┘

         ┌────────┐
         │  Cron  │──── manager.run() ───▶ Core
         └────────┘
```

## What Core Can Do Without Any Subscribers

- Run agents (sessions execute, tools work, results return)
- Call agents synchronously (workflows chain steps)
- Fork agents asynchronously (parallel work)
- Message agents (emits event — if no DB subscriber, message is lost, logged to stderr)
- Session persistence (JSONL on filesystem — not DB)
- All orchestration works

What's missing without subscribers: no UI, no DB tracking, no context learning, no telegram. Core is fully functional but unobserved.

## Migration Path

### Phase 1: Define EventBus in core
- 15-line class: subscribe + emit
- Core creates it, passes it down to manager/tools
- may.ts subscribes existing consumers

### Phase 2: Move DB writes to subscriber
- Today: core calls upsertSession() directly
- After: DB subscriber handles session_start/session_end events
- Core no longer imports db.ts

### Phase 3: Thin may.ts
- Parse args → create EventBus → init core → register subscribers → start interfaces
- Under 200 lines
- Each mode (--chat, --cron, --oneshot) registers different subscribers

### Phase 4: Separate cron
- Extract to standalone module
- Runs in-process or as separate binary
- Triggers via manager.run(), no bus subscription needed
