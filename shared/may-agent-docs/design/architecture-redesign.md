# May-Agent Architecture Redesign

## Current State

Everything lives in one monolith (`may.ts` — 1089 lines) that glues together:
- Agent management (SubagentManager)
- Chat session (ChatSession)
- Console UI
- Socket server
- Telegram bot
- Cron system
- Event bus
- Model configuration
- Session recovery
- Context learning
- Error recovery

## Proposed Components

### 1. Core (`src/core/` or `packages/core/`)

The multi-agent runtime. No I/O, no UI, no cron. Pure agent management.

**Contains:**
- SubagentManager (session lifecycle, agent registry)
- Agent tools (coding, agents, workflow, finish, cli-agents)
- Workflow engine
- Compaction
- Handoff / context summarization
- Session persistence (read/write JSONL, archive)
- Manager receipts (tool wrapping, signatures)

**Interface:**
```typescript
const manager = new SubagentManager({ persistDir, projectRoot });
manager.register(agentDef);
const sessionId = manager.run("coder", task);
const result = await manager.waitFor(sessionId);
manager.input(sessionId, "follow-up");
manager.cancel(sessionId);
```

**Does NOT depend on:** EventBus, DB, cron, socket, UI, models config.

**Events:** Emits typed events (text, tool_call, session_start, etc.) via a callback or simple emitter. Consumers wire it to whatever they want.

### 2. Interface (`src/interface/`)

Connections between humans and the core. Each is independent.

**Socket server** (`socket.ts`):
- Unix domain socket, JSON-line protocol
- Receives commands (input, steer, cancel, status, subscribe)
- Forwards events to subscribed clients
- The bridge for everything external

**Console** (`console.ts`):
- Readline + event rendering
- Talks to core via ChatSession helper
- Could also talk via socket (simpler, but latency)

**Telegram** (`telegram.ts`):
- Bot polling, message routing
- Talks to core via socket or direct API

**ChatSession** (`chat-session.ts`):
- Stateful chat helper — manages the persistent human session
- Wraps core's manager.run/input/steer
- Handles /new, cancel, resume

### 3. Cron System (`src/cron/`)

Time-triggered job execution. Completely separate process.

**How it works today:** Embedded in may.ts, fires heartbeats and handlers in-process.

**How it should work:** Standalone process that reads cron.json, triggers jobs by spawning the binary in oneshot mode:
```bash
may-agent --oneshot --agent coder --task "heartbeat..."
```

Or calls via socket:
```json
{"type": "run", "agent": "may", "message": "[heartbeat]..."}
```

**Contains:**
- Cron scheduler (interval management, overlap prevention)
- Handler loading (JS handlers like evaluate-sessions, watchdog)
- Agent-loader (for resolving agent configs + cron entries)

**Does NOT depend on:** UI, ChatSession, event rendering.

### 4. Web UI (`src/web/`)

Already mostly separate (`src/app/ui/web.ts` + `web-static/`).

**Contains:**
- HTTP server (Bun.serve)
- REST API (requests, sessions, stats, digest, benchmarks)
- WebSocket proxy (browser WS → unix socket)
- Static files (dashboard HTML/CSS/JS)

**Talks to core via:** Socket (for events) + DB (for queries).

**Does NOT depend on:** Core directly, cron, console, telegram.

### 5. Shared DB (`src/db/`)

SQLite for tracking and querying. Optional for core, required by others.

**Tables:**
- `requests` — task tracking (from/to/status/summary)
- `sessions` — session metadata mirror (agent/task/status/timing)
- `evaluations` — quality/efficiency scores
- `gym_runs` / `gym_checks` — benchmark results
- `convention_checks` / `convention_maturity` — compliance tracking

**Used by:**
- Core: optional — writes session metadata, reads for resume
- Cron handlers: queries for evaluate-sessions, audit-requests
- Web UI: reads for dashboard, request list, stats
- Agents: via system_status and requests tools
- Context learning: reads evaluations for post-session analysis

**Interface:**
```typescript
const db = getDb(persistDir);  // lazy init, cached
db.query("SELECT ...").all();
```

## Dependency Graph

```
              ┌──────────┐
              │  Web UI   │──── reads ────┐
              └────┬──────┘               │
                   │ socket               │
              ┌────┴──────┐         ┌─────┴─────┐
              │ Interface │         │ Shared DB  │
              │ (socket,  │         │ (SQLite)   │
              │  console, │         └─────┬──────┘
              │  telegram)│               │
              └────┬──────┘               │ writes
                   │ API calls            │
              ┌────┴──────┐         ┌─────┴──────┐
              │   Core    │────────▶│  Cron      │
              │ (manager, │ events  │ (scheduler,│
              │  tools,   │         │  handlers) │
              │  workflow) │         └────────────┘
              └───────────┘
```

Core is the center. Everything else connects to it. DB is a shared service — core writes, everyone reads.

## What Changes vs Today

| Aspect | Today | Proposed |
|--------|-------|----------|
| Entry point | `may.ts` (1089 lines, does everything) | Separate entry per mode |
| Cron | In-process, coupled to may.ts | Separate process or module |
| DB | Required by core (getDb in manager) | Optional for core, service for others |
| Event bus | Global singleton in may.ts | Core emits, consumers subscribe |
| Models | Defined in may.ts | Config file or separate module |
| Agent loading | In may.ts startup | Shared utility, used by core + cron |

## Migration Path

### Phase 1: Extract core
- Move SubagentManager + tools + workflow to `src/core/`
- Core exports a clean API, no may.ts dependencies
- may.ts imports from core instead of lib

### Phase 2: Separate web UI
- Already mostly separate. Make it fully standalone.
- Communicates only via socket + DB reads.

### Phase 3: Extract cron
- Move cron scheduler to standalone module
- Can run in-process (current) or as separate process
- Handlers are already agent-owned (agents/*/handlers/)

### Phase 4: Clean may.ts
- may.ts becomes thin glue: parse args → init core → attach interfaces → start cron
- Each mode (--chat, --cron, --oneshot, --status) is a separate code path

## Questions

1. Should core depend on the DB at all? Today it writes session metadata to SQLite. Could be a callback/hook instead.
2. Should cron be a separate binary? Or just a separate module loaded by may.ts?
3. Should models config live in a JSON file instead of hardcoded in may.ts?
4. How do we handle the transition? Big refactor or incremental extraction?
