# Event System Redesign

## Starting point: what actually happens

Sessions run. Every session produces the same events:

```
session_start → [turn_start → text* → tool_call* → tool_result* → turn_end]* → session_end
```

There's no inherent difference between a session started by a human and one started by cron. The events are the same. The session doesn't know who's watching.

## Current problem

`may.ts` has this in `attachAgentEvents()`:

```typescript
if (label === interfaceAgent) {
  // Full streaming: text, tool_call, tool_result, prompt → channel: "chat"
} else {
  // One-line summary: "[coder] turn done (3s, 1 tool calls)" → info event
}
```

This bakes two bad assumptions into the event layer:
1. Only the interface agent's events are worth streaming
2. The UI cares about agents, not sessions

These are wrong. A human might want to watch a delegation chain (may → tech-lead → coder). An operator might want to stream a specific cron session to debug it. The "interface agent" concept belongs to the UI, not the event system.

## Proposed design

### Every session event carries `sessionId`

```typescript
export type SessionEvent =
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; duration?: string; outcome?: string }
```

Plus system-level events (not session-scoped):

```typescript
export type SystemEvent =
  | { type: "cron_fire"; name: string; kind: string }
  | { type: "notification"; agent: string; text: string }  // heartbeat briefs, escalations
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
```

```typescript
export type RunnerEvent = SessionEvent | SystemEvent;
```

No `channel`. No `audience`. Just: every event says what it is and which session it belongs to (if any).

### UIs subscribe by interest, not by channel

```typescript
// Chat UI (web, telegram): subscribe to a session tree
function isRelevant(event: RunnerEvent, rootSessionId: string, childSessionIds: Set<string>): boolean {
  if ("sessionId" in event) {
    return event.sessionId === rootSessionId || childSessionIds.has(event.sessionId);
  }
  // Notifications are always relevant
  if (event.type === "notification") return true;
  return false;
}

// Console: show everything, dim non-primary sessions
function isDimmed(event: RunnerEvent, primarySessionId: string): boolean {
  if ("sessionId" in event) return event.sessionId !== primarySessionId;
  return event.type === "log";
}

// Socket: no filter, forward everything
```

### attachAgentEvents becomes uniform

```typescript
function attachAgentEvents(agentName: string, sessionId: string): void {
  manager.subscribe(sessionId, (event) => {
    switch (event.type) {
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          bus.emit({ type: "text", sessionId, agent: agentName, text: event.assistantMessageEvent.delta });
        }
        break;
      case "tool_execution_start":
        bus.emit({ type: "tool_call", sessionId, agent: agentName, tool: event.toolName, args: event.args });
        break;
      case "tool_execution_end":
        bus.emit({ type: "tool_result", sessionId, agent: agentName, tool: event.toolName, preview: extractPreview(event), isError: !!event.isError });
        break;
      case "turn_end":
        bus.emit({ type: "turn_end", sessionId, agent: agentName, toolCalls: countToolCalls(event), durationMs: elapsed });
        break;
    }
  });
}
```

Same handler for every session. No `if (isChat)`. The UI decides what to show, not the event emitter.

### How chat UIs work

When the human sends a message:
1. ChatSession creates/wakes a session (e.g. `s_123`)
2. The UI remembers `s_123` as the "active session"
3. Events arrive on the bus with `sessionId: "s_123"` → UI shows them
4. If the agent delegates (creates child `s_456` with `parentSessionId: s_123`), the UI sees `session_start` with `parentSessionId` and adds `s_456` to its watch set
5. Events from `s_456` (agent: tech-lead) also show in the UI, indented/prefixed

The UI builds the watch set dynamically from `session_start` events. No static config.

### How telegram works

Same as above, but rendering is different:
- `text` events → accumulate, flush on `turn_end` or `session_end`
- `tool_call` → show as one-liner: `🔧 read(agents/bob/workspace/...)`
- `notification` → push immediately as a separate message
- Child sessions → show as `📎 tech-lead: <task>` then `✅ tech-lead: done (45s)`

### How console works

Same event stream, different rendering:
- Active session events → bright
- Child session events → normal with indent
- Other sessions → dim one-line turn summary
- System events (cron, log) → dim

### Notifications

Heartbeat briefs, escalations, handler alerts → `{ type: "notification", agent, text }`. Not session-scoped. All UIs show them (telegram pushes, web shows as toast, console prints bright).

### Migration path

1. Add `sessionId` to all session events (keep `channel` as deprecated alias)
2. Unify `attachAgentEvents` — same handler for all sessions
3. Update UIs to filter by sessionId instead of channel
4. Remove `channel` field
5. Split `info` into `notification`, `cron_fire`, `log` over time

Steps 1-3 are the meaningful change. Steps 4-5 are cleanup.
