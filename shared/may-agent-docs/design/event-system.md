# Event System Redesign

## Current state

### Events

9 event types, one broadcast bus, one channel tag (`chat` | `activity`).

| Type | What | Produced by | Volume |
|---|---|---|---|
| `text` | Streaming text delta | Agent LLM response | High (every token) |
| `tool_call` | Agent invokes a tool | Agent turn | ~10/session |
| `tool_result` | Tool output | Agent turn | ~10/session |
| `prompt` | Agent is idle | Agent turn end | 1/turn |
| `info` | Everything else | 30+ call sites | Very high |
| `session_start` | New session | Manager | ~300/day |
| `session_end` | Session done | Manager | ~300/day |
| `workflow` | Workflow lifecycle | Workflow engine | Low |
| `eval` | Evaluation result | Evaluator | Low |

### The `info` dumping ground

`info` is a catch-all. These are all `{ type: "info", message: string }`:

- `[coder] turn done (3s, 1 tool calls)` — background agent progress
- `[cron] heartbeat-scout fired (JS handler)` — cron activity
- `Loaded 13 agent(s): ...` — startup
- `[fatal] Uncaught exception: ...` — crash
- `[status] 3 active session(s): ...` — command response
- `[eval] Evaluated 5 session(s)...` — evaluator
- `[recovery] Requeued session...` — infra recovery
- `[agents-auto-commit] pushed to origin` — handler output
- `Generated system context: 70 sessions...` — heartbeat-context handler

They're indistinguishable without string parsing. A UI can't filter "show me errors but not turn summaries" because they're the same type.

### The `channel` overload

`channel: "chat"` means "show this to the human." It's used for:
1. Interface agent's LLM response to the human's message
2. Heartbeat briefs from ANY agent (`📋 *tech-lead* heartbeat brief:...`)
3. Handler alerts via `ctx.notify()`

A chat UI that filters `channel === "chat"` gets all three. (1) is the conversation. (2) and (3) are notifications — useful but not part of the conversation.

## What consumers actually need

| Consumer | Needs | Doesn't need |
|---|---|---|
| **Chat UI** (web, telegram) | Conversation: text/tool_call/tool_result/prompt from MY request. Notifications: briefs, alerts. | Background turns, cron fires, startup, all other info. |
| **Console** (terminal) | Everything, but conversation bright and background dim. | Nothing — operator sees all. |
| **Socket** (debug) | Everything, raw. | Nothing. |
| **Dashboard** (web) | Nothing from the event stream. Reads SQLite. | All events. |

## Proposed: scope events, don't channel-tag them

The problem isn't the event types — it's that there's no way to know **which events belong to the human's request** vs background activity. The `channel` tag tried to solve this, but it's too coarse (chat vs activity) and too manually assigned (each emit site decides).

### Option A: Add `sessionId` to every event

Every event already has `agent`. If we add `sessionId`, a UI can filter:
- Show events where `sessionId === mySession` (conversation)
- Show events where `sessionId` is a child of my session (delegation progress)
- Ignore everything else

The interface agent's session is known (`chatSession.getSessionId()`). A UI subscribes to that session's events + its descendants.

**Pros**: Clean, composable, no manual channel tagging. Works for any session, not just the interface agent.
**Cons**: `info` events don't belong to a session (cron fires, startup, signals). Need a "system" category for those.

### Option B: Replace `channel` with `audience`

Instead of two channels, use explicit audience tags:

```typescript
type EventAudience = "conversation" | "notification" | "system";
```

- `conversation`: Events from the session that's handling the human's current message. Text, tool calls, results, prompt.
- `notification`: Pushed alerts — heartbeat briefs, handler alerts, escalations. Interesting to the human but not part of the conversation.
- `system`: Everything else. Turn summaries, cron fires, startup, errors, status responses.

**Pros**: Simple, maps to what UIs actually need. Three categories instead of two.
**Cons**: Still manually tagged at each emit site. But fewer emit sites to get wrong.

### Recommendation: Option B

Option A is more principled but requires threading sessionId through every event emission point, including `info` events that aren't session-scoped. Option B is pragmatic — rename `channel` to `audience`, add one value, update the emit sites.

| Audience | Events | Who sees |
|---|---|---|
| `conversation` | text, tool_call, tool_result, prompt from interface agent session | Chat UIs (web, telegram), console (bright) |
| `notification` | Heartbeat briefs, handler alerts, escalations | Chat UIs (separate section), console (bright), telegram (push) |
| `system` | Turn summaries, cron fires, startup, errors, status, eval | Console (dim), socket (raw), chat UIs (hidden or collapsible) |

### Migration

1. Add `audience` field to RunnerEvent (optional, defaults to `"system"` for backward compat)
2. Update emit sites:
   - Interface agent text/tool_call/tool_result/prompt → `audience: "conversation"`
   - Cron notify (heartbeat briefs) → `audience: "notification"`
   - Handler ctx.notify → `audience: "notification"`
   - Escalation alerts → `audience: "notification"`
   - Everything else → no audience (defaults to `"system"`)
3. Keep `channel` as a deprecated alias during migration
4. Update UIs:
   - Telegram: show `conversation` (accumulate text) + `notification` (push immediately)
   - Web chat: show `conversation` (streaming) + `notification` (toast/badge)
   - Console: `conversation` bright, `notification` bright with prefix, `system` dim
   - Socket: all events, no change

### Break up `info`

Long term, the `info` type should be split into structured types:

```typescript
| { type: "agent_turn"; agent: string; sessionId: string; toolCalls: number; durationMs: number }
| { type: "cron_fire"; name: string; handler: string }
| { type: "system_log"; level: "info" | "warn" | "error"; message: string }
```

But this is a larger refactor. For now, `info` + `audience: "system"` is good enough. The structured types can come later when we need programmatic consumers (monitoring, metrics).

## Summary

| Today | Proposed |
|---|---|
| `channel: "chat" \| "activity"` | `audience: "conversation" \| "notification" \| "system"` |
| Channel manually assigned, often wrong | Audience semantically clear |
| `info` is 30+ different things | `info` stays but with `audience` scoping |
| UIs each filter differently | UIs filter by audience (shared logic) |
| Heartbeat briefs in conversation | Heartbeat briefs in notification |
