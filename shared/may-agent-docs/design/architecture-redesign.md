# May-Agent Architecture Redesign

## Current State

Everything lives in one monolith (`may.ts` — 1089 lines). Models, cron, UI, recovery, context learning, event routing — all tangled together.

## Core Concept

One EventBus. Everyone talks on it. Core is just another participant.

```typescript
class EventBus {
  private subscribers: Array<(event: AgentEvent) => void> = [];

  subscribe(fn: (event: AgentEvent) => void): () => void {
    this.subscribers.push(fn);
    return () => { this.subscribers = this.subscribers.filter(s => s !== fn); };
  }

  emit(event: AgentEvent): void {
    for (const fn of this.subscribers) {
      try { fn(event); } catch { /* never breaks anyone */ }
    }
  }
}
```

The bus carries two kinds of events:
- **Observations** (from core): session_start, text, tool_call, session_end
- **Commands** (to core): input, fork, run, cancel, steer

Core subscribes to commands. Everyone subscribes to observations. The bus is the only interface.

## How It Works

```
Console types "fix the build"
  → bus.emit({ type: "input", agent: "may", text: "fix the build" })
  → core subscriber picks it up, starts session
  → bus.emit({ type: "session_start", sessionId, agent: "may" })
  → bus.emit({ type: "text", sessionId, text: "Let me look..." })
  → bus.emit({ type: "tool_call", sessionId, tool: "bash", args: ... })
  → bus.emit({ type: "session_end", sessionId, status: "done" })
  → console subscriber renders each event
  → DB subscriber persists each event
  → socket subscriber forwards to web UI
```

Everything is async. The console emits `input` and doesn't wait. Events flow back through the bus. Every subscriber sees everything.

## Components

### 1. Core

The multi-agent runtime. Subscribes to command events, emits observation events.

**Contains:**
- SubagentManager (session lifecycle, agent registry)
- Agent tools (coding, agents, workflow, finish, cli-agents)
- Workflow engine
- Compaction, handoff, context summarization
- Session persistence (JSONL on filesystem)

**Core subscribes to commands:**
```typescript
bus.subscribe((event) => {
  if (event.type === "input") manager.input(event.sessionId, event.text);
  if (event.type === "run") manager.run(event.agent, event.task, event.opts);
  if (event.type === "fork") manager.runAgent(event.agent, event.task, event.opts);
  if (event.type === "steer") manager.steer(event.sessionId, event.text);
  if (event.type === "cancel") manager.cancel(event.sessionId);
});
```

**Core emits observations:**
```typescript
// Inside manager, when things happen:
this.eventBus.emit({ type: "text", sessionId, agent, text });
this.eventBus.emit({ type: "session_end", sessionId, agent, status });
this.eventBus.emit({ type: "message_created", from, to, task });
```

**Core does NOT import:** DB, socket, console, telegram, cron.

### 2. Subscribers

Each subscriber is a function. Independent. Register what you need.

**Console renderer:**
```typescript
bus.subscribe((event) => {
  if (event.type === "text" && event.sessionId === primarySid)
    process.stdout.write(event.text);
  if (event.type === "tool_call" && event.sessionId === primarySid)
    console.log(`[${event.tool}] ${formatArgs(event.args)}`);
});
```

**DB writer:**
```typescript
bus.subscribe((event) => {
  if (event.type === "session_start") upsertSession(db, event);
  if (event.type === "session_end") updateSession(db, event);
  if (event.type === "message_created") insertRequest(db, event);
});
```

**Socket broadcaster:**
```typescript
bus.subscribe((event) => {
  for (const client of clients) {
    if (client.wantsEvent(event)) client.send(event);
  }
});
```

**Context learner:**
```typescript
bus.subscribe((event) => {
  if (event.type === "session_end" && shouldLearn(event.agent))
    learnFromSession(event);
});
```

### 3. Command Emitters

Anything that talks to core emits commands onto the bus.

**Console (readline):**
```typescript
readline.on("line", (text) => {
  bus.emit({ type: "input", agent: "may", text });
});
```

**Socket server (receives from web UI):**
```typescript
socket.on("data", (msg) => {
  const cmd = JSON.parse(msg);
  bus.emit(cmd);  // { type: "fork", agent: "tech-lead", task: "..." }
});
```

**Cron scheduler:**
```typescript
onInterval(() => {
  bus.emit({ type: "run", agent: "may", task: "[heartbeat] ..." });
});
```

**Telegram bot:**
```typescript
bot.on("message", (msg) => {
  bus.emit({ type: "input", agent: "may", text: msg.text });
});
```

### 4. Web UI

HTTP server + static dashboard. Connects via socket + DB reads.

- REST API reads from DB (sessions, requests, stats)
- WebSocket proxies to socket server
- Does NOT import core or bus directly

### 5. DB (SQLite)

Just a subscriber that writes. Others read.

- Written by: DB subscriber (on events from bus)
- Read by: Web UI, cron handlers, agent tools

### 6. Cron

Emits `run` commands onto the bus. Reads cron.json for schedules. That's it.

## Event Types

```typescript
type AgentEvent =
  // Observations (from core)
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; outcome?: string }
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
  | { type: "message_created"; from: string; to: string; task: string }
  | { type: "context-learn"; agentName: string; sessionId: string }
  | { type: "eval"; verdict: string; efficiency: number; quality: number }

  // Commands (to core)
  | { type: "input"; agent: string; text: string; sessionId?: string }
  | { type: "run"; agent: string; task: string }
  | { type: "fork"; agent: string; task: string }
  | { type: "steer"; sessionId: string; text: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" };
```

## Dependency Graph

```
┌──────────┐  emit    ┌─────────────────────────────────┐  emit    ┌──────────┐
│ Console  ├─────────▶│           EventBus               │◀─────────┤ Telegram │
│          │◀─────────┤  subscribe() + emit()            ├─────────▶│          │
└──────────┘ subscribe│                                   │subscribe └──────────┘
                      │   Everyone talks. Everyone hears. │
┌──────────┐  emit    │                                   │ subscribe┌──────────┐
│   Cron   ├─────────▶│                                   ├─────────▶│    DB    │
└──────────┘          │                                   │          │  Writer  │
                      │                                   │          └────┬─────┘
┌──────────┐ subscribe│                                   │               │writes
│  Socket  │◀────────▶│                                   │          ┌────┴─────┐
│ Server   │          │                                   │          │  SQLite  │
└────┬─────┘          └──────────────┬────────────────────┘          └──────────┘
     │ WebSocket                     │
┌────┴─────┐               ┌────────┴────────┐
│  Web UI  │               │      Core       │
│ (browser)│               │ (subscribes to  │
└──────────┘               │  commands, emits│
                           │  observations)  │
                           └─────────────────┘
```

## What Core Can Do With Zero Subscribers

- Run agents, execute tools, return results ✅
- Workflow orchestration ✅
- Session persistence (JSONL) ✅
- Emit events into the void (nobody listens) ✅
- Receive commands (if nobody emits, nothing happens) ✅

Fully functional. Just unobserved and untriggered.

## Migration Path

### Phase 1: Unified EventBus
- Replace current EventBus class with the 15-line version
- Core emits through it (already does)
- Core subscribes for commands (extract from may.ts command handler)
- All interfaces emit commands through bus

### Phase 2: Move DB writes to subscriber
- Remove direct DB calls from core
- DB subscriber handles persistence

### Phase 3: Thin may.ts
- Create EventBus → register subscribers → done
- Under 200 lines
