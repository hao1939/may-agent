# Persistent Chat Session — Design

> **Archive**. This design was **implemented** as `ChatSession` in commit `a20b24a`.
> See [Session Model](../architecture/session-model.md) for the current architecture.
> The implementation closely follows this proposal with minor changes:
> - ChatSession is ~280 lines (not ~150 as estimated)
> - `@agent` prefix creates `kind: "job"` sessions (design used `source: "chat"`)
> - No `/resume` command yet — starting fresh is the default

## Problem

may-agent's ChatLoop creates a new ephemeral session (`autoClose: "immediate"`)
for every human message. Conversation history is an in-memory rolling transcript
(last 10 entries, truncated to 500 chars each), lost on restart.

1. **No conversation tracking** — 10 messages = 10 disconnected JSONL files
2. **Lost context for learning** — can't review decision patterns or failures
3. **Weak continuity** — LLM sees text summary, not actual conversation
4. **No restart recovery** — restart = blank slate

## Discovery: The infrastructure already exists

The `SubagentManager` already supports persistent sessions:

| Feature | Manager method | Status |
|---------|---------------|--------|
| Session stays alive after completion | `autoClose: "never"` → idle | Built |
| Wake idle session with new input | `manager.input(sessionId, text)` | Built |
| JSONL persistence per message | `subscribeForPersistence()` | Built |
| Reload session from JSONL on restart | `resumeSession()` + `resumeStaleSessions()` | Built |
| Compaction when context fills | `buildTransformContext()` + `compaction` option | Built |
| Mid-turn steering | `manager.steer(sessionId, text)` | Built |
| Wait for idle | `manager.waitForIdle(sessionId)` | Built |

**ChatLoop doesn't use any of this.** It creates `autoClose: "immediate"` sessions
and maintains its own in-memory transcript. The fix is to replace ChatLoop with
code that uses the existing persistent session infrastructure.

## Current flow (ChatLoop)

```
Human message
  → chatLoop.handleInput(message)
    → chatLoop.startSession(message)
      → Build text context from transcript[]
      → manager.run(agentName, contextBlock, { source: "chat" })
        → New Agent + new JSONL + autoClose: "immediate"
      → On completion: push 500-char summary to transcript[]
```

## Proposed flow (ChatSession)

```
Human message
  → chatSession.handleInput(message)
    → manager.input(sessionId, message)
      → Session IDLE? → agent.prompt(message) → runs → idle again
      → Session RUNNING? → agent.steer(message)
    → Messages appended to same session.jsonl automatically

On restart:
  → manager.resumeStaleSessions()
    → Reloads JSONL, repairs broken messages, session enters running/idle
  → chatSession reconnects to the resumed session
```

## Design

### ChatSession (replaces ChatLoop)

```typescript
// src/app/chat-session.ts

interface ChatSessionOptions {
  manager: SubagentManager;
  bus: EventBus;
  agentName: string;
  onDone?: () => void;          // prompt display after response
  onReload?: () => void;
  onClose?: () => void;
  onRestart?: () => void;
}

class ChatSession {
  private manager: SubagentManager;
  private bus: EventBus;
  private agentName: string;
  private sessionId: string | null = null;

  constructor(opts: ChatSessionOptions);

  /** Process human input. Built-in commands handled directly.
   *  Everything else goes to manager.input(). */
  handleInput(message: string): void;

  /** Get or create the persistent session.
   *  Checks for existing idle/running session for this agent.
   *  If none, creates one with autoClose: "never". */
  private ensureSession(): string;

  /** Start a fresh session (e.g., /new command). */
  newSession(): void;

  /** Cancel current run. */
  abort(): void;

  /** Get session ID (for event routing). */
  getSessionId(): string | null;
}
```

### Key changes

| Aspect | ChatLoop (current) | ChatSession (proposed) |
|--------|-------------------|----------------------|
| Session per message | `manager.run()` each time | One `manager.run()` with `autoClose: "never"`, then `manager.input()` |
| LLM sees | Text summary of last 10 | Actual message history (compacted when full) |
| Persistence | Separate JSONL per message | Single session JSONL, auto-appended |
| Restart recovery | Lost transcript | `resumeStaleSessions()` reloads JSONL |
| Agent instance | New per message | One, reused across messages |
| System prompt | Rebuilt per message | Built once at session creation |

### Session lifecycle

```
Create (first message or explicit /new):
  1. manager.run(agentName, message, { autoClose: "never", compaction: true })
  2. Session created, JSONL started, Agent runs
  3. On completion → session goes idle (stays in activeSessions)
  4. chatSession stores sessionId

Next message:
  1. manager.input(sessionId, message)
  2. If idle → wakes session, agent.prompt(message)
  3. If running → steer(message)
  4. Messages auto-appended to same JSONL

Restart:
  1. manager.resumeStaleSessions() finds idle/running session
  2. Reloads JSONL, restores Agent state
  3. chatSession finds the resumed session by scanning active sessions
     for the interface agent name

/new command:
  1. Close current session (archive it)
  2. Next message creates a fresh session
```

### Finding the session on startup

After `resumeStaleSessions()`, look for an active session for the interface agent:

```typescript
// In ChatSession.ensureSession():
const existing = manager.status().find(
  s => s.agent === this.agentName && (s.status === "running" || s.status === "idle")
);
if (existing) {
  this.sessionId = existing.sessionId;
  return this.sessionId;
}
// No existing session — will create on first message
```

### Compaction

The interface session needs compaction enabled (`compaction: true` in `RunOptions`).
This uses `buildTransformContext()` which is already built. When the Agent's context
fills up, pi-agent-core calls the transform function, which summarizes old messages
and keeps recent ones. The compacted state is saved to `session-compact.jsonl` and
used on reload.

### @agent prefix

Still routes through `manager.run()` as ephemeral sessions — no change:

```typescript
if (targetAgent) {
  // Direct agent call — ephemeral session, same as now
  manager.run(targetAgent, task, { source: "chat" });
  return;
}
```

### Built-in commands

Same handling: `status`, `cancel`, `cancel all`, `reload`, `close`, `restart`.
Plus new: `/new` — starts a fresh chat session.

### Event routing

The `onSessionStart` callback in may.ts already handles attaching events to any
new session. For the persistent session, events continue flowing because the
session stays in `activeSessions`. On wake from idle, `manager.input()` calls
`agent.prompt()` which emits events to the existing subscriber.

One thing to verify: does `subscribeForPersistence` survive the idle→running
transition? Looking at the code — yes. `handleCompletion` with `autoClose: "never"`
does NOT call `session.unsubscribe()`. The subscriber stays active.

### What about startup context?

Currently ChatLoop sends interrupted session info as `startupContext`. With
persistent sessions, the interface agent's own session is resumed automatically.
For other interrupted sessions, we inject the context via `manager.input()`:

```typescript
if (interruptedSessions.length > 0) {
  const context = buildInterruptedSessionsMessage(interruptedSessions);
  manager.input(chatSession.getSessionId(), context);
}
```

## Integration with may.ts

```diff
- import { ChatLoop } from "./chat-loop.js";
+ import { ChatSession } from "./chat-session.js";

- let chatLoop: ChatLoop | undefined;
+ let chatSession: ChatSession | undefined;

  // In chat mode setup:
- chatLoop = new ChatLoop({
-   manager, bus, agentName: interfaceAgent,
-   startupContext, onSessionDone: () => emitPrompt(), ...
- });
+ chatSession = new ChatSession({
+   manager, bus, agentName: interfaceAgent,
+   onDone: () => emitPrompt(),
+   onReload: handleReload,
+   onClose: () => gracefulShutdown(),
+   onRestart: () => gracefulRestart(),
+ });
+ // If there were interrupted sessions, notify
+ if (startupContext && chatSession.getSessionId()) {
+   manager.input(chatSession.getSessionId()!, startupContext);
+ }

  // Input handling:
- chatLoop.handleInput(message);
+ chatSession.handleInput(message);

  // Ctrl+C:
- chatLoop.cancelAll();
+ chatSession.abort();
```

## Effort Estimate

| Task | Est. |
|------|------|
| `chat-session.ts` — new class (~150 lines) | 2 hours |
| `may.ts` — swap ChatLoop → ChatSession (~30 lines changed) | 1 hour |
| Verify compaction works with `autoClose: "never"` | 1 hour |
| Verify `resumeStaleSessions` correctly resumes idle sessions | 1 hour |
| Update `chat-loop.test.ts` → `chat-session.test.ts` | 2 hours |
| Manual testing: multi-message conversation, restart, compaction | 1 hour |
| **Total** | **~1 day** |

The estimate is smaller than the original design because we're not building session
persistence — it's already built. We're just wiring ChatSession to use the existing
`autoClose: "never"` + `manager.input()` + `resumeStaleSessions()` infrastructure
that was built for exactly this purpose but never connected to the chat layer.

## Not in scope

- Session browsing/picker UI
- Branching (linear conversation only)
- Export to HTML
- Multiple concurrent chat sessions
