<ai_context>
The architecture.md design doc claimed `tool.executed` events were emitted to the event bus and persisted to SQLite for audit. In reality, the runtime emits `tool_call` and `tool_result` (underscore, not dot) as ephemeral bus events for UI/console only — they are NOT persisted to the events table. The db-writer only persists events with dots in the type name, so underscore-named events are ephemeral by design. Fixed 2026-06-10 in architecture.md.
Triggers: tool.executed, tool_call, tool_result, event persistence, architecture.md, design doc drift, ephemeral events
</ai_context>

# KE-1782: `tool.executed` Event Never Existed — Architecture Doc vs Reality

**Status**: resolved
**Discovered**: 2026-06-10
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1780 (handler lifecycle doc gap), events.md

## Claim

The `architecture.md` design doc described a `tool.executed` event type that:
1. Was emitted when agents executed tools (line 95 diagram)
2. Was routed to a "SQLite audit" consumer (line 95)
3. Was bridged from `tool_execution_end` pi-agent events (line 318 code example)

**None of this exists.** Zero `tool.executed` events in the events table ever.
Zero references in the source code.

## Evidence

### What the doc claimed (lines 95, 318)

```
│  Agent tools    ──────────▶ tool.executed     ──▶ SQLite audit       │
```
```typescript
bus.emit({ type: "tool.executed", agent: agentName, sessionId, tool: event.toolName, args: event.args });
```

### What the runtime actually does (manager.ts lines ~1437-1448)

```typescript
case "tool_execution_start":
  bus.emit({ type: "tool_call", sessionId, agent: agentName, tool: event.toolName, args: event.args });
  break;
case "tool_execution_end":
  bus.emit({ type: "tool_result", sessionId, agent: agentName, tool: event.toolName, preview: text.slice(0, 200), isError: event.isError });
  break;
```

### Key differences

| Aspect | Doc claimed | Reality |
|--------|------------|---------|
| Event name | `tool.executed` (dot) | `tool_call` / `tool_result` (underscore) |
| Persistence | Persisted to SQLite ("SQLite audit") | Ephemeral — NOT persisted |
| Consumer | "SQLite audit" | UI/console subscribers only |
| Count in DB | 0 events ever | 0 (correct — by design) |

### Why underscore events aren't persisted

The `db-writer.ts` persistence logic (line ~161):
```typescript
if (event.type.includes('.')) {
  // persist to events table
}
```

Events with dots in the type name get persisted. `tool_call` and `tool_result`
use underscores, so they pass through the bus for real-time UI subscribers but
are never written to SQLite. This is intentional — tool execution data lives in
the session JSONL transcript, not in the events table.

## Fix Applied

Updated `shared/may-agent-docs/2a-design/architecture.md`:
1. Diagram: replaced `tool.executed ──▶ SQLite audit` with `tool_call` and
   `tool_result` marked as ephemeral UI/console events
2. Code example: replaced the `tool.executed` emit with the actual
   `tool_call`/`tool_result` pattern from manager.ts
3. Added comment explaining the dot-vs-underscore persistence rule

## Lesson

Design docs that describe event flows can become stale when the implementation
changes event naming conventions. The dot-vs-underscore naming has real
persistence consequences — it's the difference between "queryable in SQL" and
"ephemeral for UI only." Architecture diagrams should distinguish durable
(persisted) events from ephemeral (bus-only) events.
