# Runtime Internals

How the binary processes input, runs sessions concurrently, and structures LLM calls.

**Design status:** Accepted runtime reference.
**Implementation status:** Partial; compatibility frames remain while human
control paths converge on the event contract below.

## Input Routing

### ChatSession (`--chat` mode)

Free-form user input first emits `human.input.received`. The input router emits
exactly one semantic child intent:

1. **Read-only transport commands** such as status/subscription may stay local.
2. **State-changing commands** emit canonical intents such as
   `session.cancel.requested` or `runtime.reload.requested`.
3. **Normal message with no bound chat** emits `chat.start.requested`.
4. **Normal message with an existing target** emits
   `session.steer.requested`.

The manager then runs or resumes the persistent chat. Each queued turn carries
its own trace context through manager send/resume, session terminal evidence,
and outbound delivery. The chat session is a conversation container, not the
trace identity.

### Socket Commands

Socket-local commands are intentionally narrow:

| Command | Route |
|---------|-------|
| `subscribe` | Open realtime event stream |
| `status` | Return current active-session status |

Everything else is normalized into a daemon event and routed through the event
bus. `input`, `steer`, `cancel_all`, `reload`, and `shutdown` are compatibility
frames, not canonical event names. New control surfaces emit the intent events
defined in `human-control-surfaces.md`; `trigger.<handler-name>` remains a
manual operator shortcut.
Event handlers then decide whether to call manager mechanics directly or
dispatch a workflow.

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
`LESSONS.md`, `knowledge/INDEX.md`, `heartbeat.md`, and
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
| `context_files` | Files resolved relative to agent dir, passed as `contextFiles` to `SubagentDefinition`; injected into fork/call task text, not the system prompt |

## Agent Discovery

The runtime discovers standalone agents from the global root and app-local
agents through project-app loading:

- global agents at `AGENTS_ROOT/<agent>/agent.json`
- V3 app-local agents at `projects/<id>.app/agents/<agent>/agent.json`
- legacy project-local agents at
  `PROJECTS_ROOT/<project>/agents/<agent>/agent.json` for compatibility

Directories without `agent.json` are not agents. They may be leftover runtime
workspace folders or legacy artifacts, but discovery must ignore them for
registration, heartbeat generation, routing, and UI/runtime agent lists.

App-local and legacy project-local agents are not a separate runtime mode. They
are registered in the same manager and must use globally unique names. Their
coding tools are scoped to the owning app/domain workspace according to the app
loader or legacy project loader.

When a project-app workflow runs for an app-local agent, `WorkflowContext`
paths must describe that app-local agent root. In particular,
`ctx.agentsRoot` is `projects/<id>.app/agents`, not global `agents/`.
Workflow code can then write `join(ctx.agentsRoot, ctx.agent, "workspace", ...)`
without recreating legacy global agent directories. Global agents keep
`ctx.agentsRoot = AGENTS_ROOT`.

## Implementation

Source lives in `projects/may-agent/` (not bare `src/`).

- **Binary entry:** `projects/may-agent/src/app/may.ts`
- **Long-running runtime assembly:** `projects/may-agent/src/app/app-runtime.ts`
- **Input routing:** `projects/may-agent/src/app/chat-session.ts`, `projects/may-agent/src/app/command-router.ts`
- **Daemon modules:** `projects/may-agent/src/app/daemon.ts` re-exports lifecycle, event
  subscribers, agent startup, session startup, and loop modules
- **Agent loading:** `projects/may-agent/src/app/agent-loader.ts`, `projects/may-agent/src/app/loader/*`
- **Session management:** `projects/may-agent/src/lib/manager.ts`
- **System prompt assembly:** `projects/may-agent/src/lib/manager.ts` → `resolveSystemPrompt()`
- **Compaction:** pi-agent runtime `Agent` class + may-agent extensions
- **Socket protocol/server/client:** `projects/may-agent/packages/control/src/*`
- **Telegram adapter:** `projects/may-agent/src/app/transport/telegram.ts`,
  `projects/may-agent/src/app/transport/telegram-client.ts`,
  `projects/may-agent/src/app/transport/telegram-reply-router.ts`,
  `projects/may-agent/src/app/transport/telegram-outbound.ts`
