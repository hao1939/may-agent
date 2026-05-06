# Runtime Internals

How the binary processes input, runs sessions concurrently, and structures LLM calls.

## Input Routing

### ChatSession (--chat mode)

User input goes through `ChatSession.handleInput()`:

1. **Built-in commands** (`status`, `cancel`, `reload`, `/new`) — handled directly, no LLM
2. **@agent prefix** (`@coder fix the test`) — ephemeral `kind: "job"` session on target agent
3. **Normal message** — routed to the persistent chat session:
   - No session yet → `manager.run(agent, message, { kind: "chat", autoClose: "never" })`
   - Session exists → `manager.input(sessionId, message)` (wakes if idle, steers if running)

### Socket Commands

| Command | Route |
|---------|-------|
| `input` | Same as typing in console |
| `steer` | Explicit session targeting (`manager.steer`) |
| `run` | New job session on named agent |
| `cancel` | Cancel specific session |
| `status` | List active sessions |

### Cron (--cron mode)

| Entry type | Execution |
|-----------|-----------|
| JS handler | In-process function, no LLM |
| Agent task | `manager.run(agent, message, { kind: "job" })` |
| Heartbeat | Fire into persistent session via `followUp` |

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
│ 1. SOUL.md         — identity, mission       │
│ 2. DOMAIN.md       — domain expertise        │
│ 3. TOOLS.md        — tool usage guide        │
│ 4. shared/LESSONS  — team-wide learnings     │
│ 5. LESSONS.md      — agent-specific learnings│
│ 6. INDEX.md        — curated references      │
│ 7. shared/INDEX.md — team knowledge index    │
│ 8. common-sense.md — behavioral fundamentals │
│ 9. Runtime env     — paths, workspace        │
│10. Available tools — tool name list          │
└─────────────────────────────────────────────┘
```

**Total: ~10-25 KB** depending on agent. Stable across sessions (LLM prefix caching).

### 2. First User Message (changes per session)

| Section | Source |
|---------|--------|
| Session ID + time | Generated |
| Recent Task History | `.state/memory/<agent>.jsonl` (last N summaries) |
| Active Recall | `workspace/ERROR_LOG.jsonl` (past failure patterns) |
| Last Checkpoint | `.state/checkpoints/` (resume point) |
| context_files | Agent-specific volatile context |
| **Task** | The actual work request |

### 3. Conversation History (grows during session)

```
[assistant] Agent response
[tool_call] Agent calls tool
[tool_result] Tool returns result
... repeats ...
```

**Compaction:** When tokens exceed context threshold, pi-agent-core handles compaction (LLM-powered summarization). Preserves: original task, key facts, most recent reasoning.

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
| `opBudget` | Injected into tool results when >50% consumed; session stopped when exceeded |
| `memoryLimit` | How many past session summaries in first user message |
| `compaction` | Whether to enable context compaction |
| `tools` | Which tools available (mapped to presets) |
| `contextFiles` | Extra files in first user message |

## Implementation

- **Input routing:** `src/app/may.ts`, `src/app/chat-session.ts`
- **Session management:** `src/lib/manager.ts`
- **System prompt assembly:** `src/lib/manager.ts` → `resolveSystemPrompt()`
- **Compaction:** pi-agent-core `Agent` class + may-agent extensions
- **Socket:** `src/app/ui/socket.ts`
