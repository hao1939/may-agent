# Runtime Internals

How the binary processes input, runs sessions concurrently, and structures LLM calls.

## Input Routing

### ChatSession (--chat mode)

User input goes through `ChatSession.handleInput()`:

1. **Built-in commands** (`status`, `cancel`, `reload`, `/new`) — handled directly, no LLM
2. **@agent prefix** (`@coder fix the test`) — rewritten into May's chat session as a delegation request; May forks/monitors the target agent
3. **Normal message** — routed to the persistent chat session:
   - No session yet → `manager.run(agent, message, { kind: "chat", autoClose: "never" })`
   - Session exists → `manager.input(sessionId, message)` (wakes if idle, steers if running)

### Socket Commands

Socket-local commands are intentionally narrow:

| Command | Route |
|---------|-------|
| `subscribe` | Open realtime event stream |
| `status` | Return current active-session status |

Everything else is normalized into a daemon event and routed through the event
bus. Examples: `input`, `steer`, `cancel`, `resume`, `reload`, `shutdown`,
`project.comment.created`, and `trigger.<handler-name>`. Event handlers then
decide whether to call manager mechanics directly or dispatch a workflow.

### Cron (--cron mode)

| Entry type | Execution |
|-----------|-----------|
| JS handler | In-process function, no direct LLM unless the handler/workflow calls one |
| Detached agent job | `spawnDetachedAgent()` in a separate OS process |
| Heartbeat handler | Cron-triggered handler dispatches heartbeat workflow; the workflow builds context, then starts a fresh agent task session via `ctx.runAgent()` |

## Event Channels

Every `RunnerEvent` carries a `channel` tag:
- `"chat"` — direct user conversation (May's text responses)
- `"activity"` — background work (sub-agent calls, cron)

UI layers filter: console dims activity, Telegram only forwards chat, socket passes the tag for client-side filtering.

## Cron Tool (Agent Self-Scheduling)

Agents with `"cron"` tool preset can CRUD their own `cron.json`:
- `list` / `add` / `remove` / `update`
- Writes to `agents/<name>/cron.json`, calls `cron.reload()`
- Works even when `--cron` is off (agents define jobs for later)

---

## LLM Call Structure

When a session runs, the LLM receives three blocks:

### 1. System Prompt (cached per agent)

```
┌─────────────────────────────────────────────┐
│ 1. common-sense.md — behavioral fundamentals │
│ 2. AGENTS.md       — identity and contract   │
│ 3. Runtime env     — paths, workspace, tools │
└─────────────────────────────────────────────┘
```

Stable across sessions for LLM prefix caching. `DOMAIN.md`, `TOOLS.md`,
`LESSONS.md`, `knowledge/INDEX.md`, `skills/*.md`, `heartbeat.md`, and
`last-session.md` are not automatically loaded.

### 2. First User Message (changes per session)

| Section | Source |
|---------|--------|
| Session ID + time | Generated |
| Runtime context | Session-specific facts from the caller/workflow |
| Optional continuity | Generated summaries such as `last-session.md` when a workflow injects them |
| **Task** | The actual work request |

### 3. Conversation History (grows during session)

```
[assistant] Agent response
[tool_call] Agent calls tool
[tool_result] Tool returns result
... repeats ...
```

**Compaction:** When tokens exceed context threshold, the pi-agent runtime
handles compaction (LLM-powered summarization). Preserves: original task, key
facts, and most recent reasoning.

**Overflow recovery:** When context window is hit, extract progress into handoff document for a new session.

### What the LLM Doesn't See

- Other agents' sessions or transcripts (unless read via tools)
- Raw SQLite database, EventBus, socket events
- Other agents' system prompts
- Manager internal state (active sessions, cron schedule)
- Git history (unless read via bash)

## agent.json Effect on LLM Call

| Field | Effect |
|-------|--------|
| `model` | Which LLM to call |
| `memoryLimit` | Legacy limit for caller-managed memory injection |
| `compaction` | Whether to enable context compaction |
| `tools` | Which tools available (mapped to presets) |
| `contextFiles` | Deprecated; volatile context should be session context, not system prompt |

## Implementation

- **Binary entry:** `src/app/may.ts`
- **Long-running runtime assembly:** `src/app/app-runtime.ts`
- **Input routing:** `src/app/chat-session.ts`, `src/app/command-router.ts`
- **Daemon modules:** `src/app/daemon.ts` re-exports lifecycle, event
  subscribers, agent startup, session startup, and loop modules
- **Agent loading:** `src/app/agent-loader.ts`, `src/app/loader/*`
- **Session management:** `src/lib/manager.ts`
- **System prompt assembly:** `src/lib/manager.ts` → `resolveSystemPrompt()`
- **Compaction:** pi-agent runtime `Agent` class + may-agent extensions
- **Socket protocol/server/client:** `packages/control/src/*`
- **Telegram adapter:** `src/app/ui/telegram.ts`,
  `src/app/ui/telegram-client.ts`, `src/app/ui/telegram-reply-router.ts`,
  `src/app/ui/telegram-outbound.ts`
