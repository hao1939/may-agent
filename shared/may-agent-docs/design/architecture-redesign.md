# May-Agent Architecture Redesign

## Current State

Everything lives in one monolith (`may.ts` — 1089 lines). Models, cron, UI, recovery, context learning, event routing — all tangled together.

## Proposed Components

### 1. Core

The multi-agent runtime. Manages agents, sessions, tools, workflows.

**Contains:**
- SubagentManager (session lifecycle, agent registry)
- Agent tools (coding, agents, workflow, finish, cli-agents)
- Workflow engine
- Compaction
- Handoff / context summarization
- Session persistence (JSONL read/write/archive)
- Manager receipts (tool wrapping, signatures)

**Interface:**
```typescript
// Core depends on ONE interface: EventBus
interface EventBus {
  emit(event: AgentEvent): void;
}

// Core API
const manager = new SubagentManager({
  persistDir,
  projectRoot,
  eventBus,       // optional — if not provided, events are silent
});

manager.register(agentDef);
const sessionId = manager.run("coder", task);
const result = await manager.waitFor(sessionId);
manager.input(sessionId, "follow-up");
manager.cancel(sessionId);
```

**Core does NOT import:** DB, socket, console, telegram, cron, models config.

Core emits events through the EventBus interface. That's its only outward dependency. Everything else — persistence to DB, streaming to UIs, context learning — is done by the EventBus implementation.

### 2. EventBus Implementation

The glue. Receives events from core, fans out to all consumers.

```typescript
const eventBus: EventBus = {
  emit(event) {
    // Real-time: stream to connected clients
    socketServer.broadcast(event);
    consoleRenderer.render(event);
    telegramBot.forward(event);

    // Persistence: track in SQLite
    dbWriter.track(event);

    // Learning: post-session context extraction
    if (event.type === "session_end") contextLearn(event);
  }
};
```

Each consumer is optional. Gym runner provides an empty EventBus. Oneshot provides one with just DB. Full system provides all of them.

The EventBus implementation is where you decide:
- What gets stored (DB)
- What gets shown (socket → web UI, console, telegram)
- What triggers follow-up (context learning, evaluation, recovery)

### 3. Interfaces

Connections between humans and core. Each attaches to the EventBus.

**Socket server:**
- Unix domain socket, JSON-line protocol
- Commands in (input, steer, cancel, status, subscribe)
- Events out (filtered by subscription)
- The bridge for web UI and external tools

**Console:**
- Readline + event rendering
- ChatSession helper manages persistent human session
- Attaches to EventBus for rendering

**Telegram:**
- Bot polling, message routing
- Attaches to EventBus for forwarding

### 4. Cron System

Time-triggered job execution.

**Today:** Embedded in may.ts, fires heartbeats and handlers in-process.

**Proposed:** Separate module that reads cron.json, manages intervals, and triggers jobs by:
- Running JS handlers in-process (evaluate-sessions, watchdog)
- Spawning oneshot sessions via core's manager.run()
- Calling via socket for cross-process triggers

Does NOT depend on UI or ChatSession.

### 5. Web UI

Already mostly separate (`src/app/ui/web.ts` + `web-static/`).

**Contains:**
- HTTP server (REST API for requests, sessions, stats)
- WebSocket proxy (browser WS → unix socket)
- Static files (dashboard HTML/CSS/JS)

**Connects via:** Socket (for real-time events) + DB (for queries).
Does NOT import core directly.

### 6. Shared DB (SQLite)

Persistence layer. One file (may.db), multiple readers.

**Tables:**
- `requests` — task tracking
- `sessions` — session metadata
- `evaluations` — quality scores
- `gym_runs` / `gym_checks` — benchmarks
- `convention_checks` — compliance

**Written by:** EventBus implementation (on session/request events from core).
**Read by:** Web UI (dashboard), cron handlers (evaluate-sessions), agent tools (system_status, requests).

Core does NOT write to DB directly. The EventBus implementation handles DB writes when it receives events from core.

## Dependency Graph

```
                    ┌──────────┐
                    │  Web UI  │
                    │ (HTTP +  │
                    │  static) │
                    └────┬─────┘
                         │ socket + DB reads
                         │
┌──────────┐        ┌────┴─────┐        ┌──────────┐
│ Console  ├────────┤ EventBus ├────────┤ Telegram │
└──────────┘        │  (impl)  │        └──────────┘
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────┴───┐ ┌───┴────┐ ┌──┴───┐
         │  Core  │ │   DB   │ │ Cron │
         │(manager│ │(SQLite)│ │      │
         │ tools, │ │        │ │      │
         │workflow)│ │        │ │      │
         └────────┘ └────────┘ └──────┘
```

Core emits → EventBus fans out → DB writes, UI streams, cron triggers.

## What Changes

| Aspect | Today | Proposed |
|--------|-------|----------|
| Event routing | EventBus class in may.ts | Interface on core, impl in glue |
| DB writes | Deep inside core (persistence.ts) | EventBus impl handles writes |
| may.ts | 1089 lines, does everything | Thin glue: parse args → init core → wire EventBus → attach interfaces |
| Cron | Embedded in may.ts | Separate module |
| Models | Hardcoded in may.ts | Config file |
| Testing | Need full may.ts to test core | Core testable standalone |

## Migration Path

### Phase 1: Define EventBus interface
- Create the interface in core
- Core calls `this.eventBus?.emit(...)` instead of direct DB/bus calls
- may.ts provides the implementation that does what it does today
- No behavior change — just indirection

### Phase 2: Extract core
- Move SubagentManager + tools + workflow to clean module
- Core depends only on EventBus interface + filesystem (JSONL)
- DB writes move to EventBus implementation

### Phase 3: Thin may.ts
- may.ts becomes: parse args → create EventBus impl → init core → attach interfaces → start cron
- Each mode (--chat, --cron, --oneshot) is a separate code path
- Under 200 lines

### Phase 4: Separate cron
- Extract cron to standalone module
- Can run in-process or as separate binary
