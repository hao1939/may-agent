# Session Model

Status: **Implemented**

## The Binary Model

Two session types: **Chat** (user interface) and **Task** (worker).

| Feature | Chat Session | Task Session |
|---|---|---|
| **Role** | Interface to human | Unit of work |
| **Count** | One per process (interface agent) | Unlimited |
| **Lifecycle** | Long-lived, stays idle between messages | Spawn → work → finish |
| **Config** | `autoClose: "never"` | `autoClose: "immediate"` |
| **Kind** | `"chat"` | `"job"` or `"call"` |

### Chat Session (The Interface)
- **Who**: The agent set by `AGENT=name` (default: May).
- **Managed by**: `ChatSession` class (`src/app/chat-session.ts`, ~280 lines).
- **Lifecycle**: Created on first user message via `manager.run(agent, message, { kind: "chat", autoClose: "never" })`. Subsequent messages via `manager.input(sessionId, message)`. Stays idle between messages.
- **Built-in commands**: `status`, `cancel`, `cancel all`, `reload`, `/new`, `close`, `restart`.
- **`@agent` prefix**: Creates ephemeral `kind: "job"` session on target agent, bypassing the interface agent.

### Task Sessions (The Workers)
- **Who**: Sub-agents, cron jobs, CLI one-offs, `@agent` prefix.
- **Lifecycle**: Spawns, runs to completion/failure. No idle state. Session dir stays on disk.
- **Context**: Convention files (SOUL.md, DOMAIN.md, etc.) + task description. Fresh every run.

## Session Kinds

Every session has a `kind` field persisted in `meta.json`:

| Kind | Created by | Owner | Auto-resume on restart |
|------|-----------|-------|----------------------|
| `chat` | ChatSession (human conversation) | Human | No — left as interrupted |
| `job` | Cron, heartbeat, `send`, task mode, `@agent` | Job system | Yes — auto-resumed |
| `call` | `callAgent` (sync sub-agent) | Parent session | No — parent re-dispatches on its own resume |

### Job Session Call Sites

| Call site | Description |
|-----------|-------------|
| Heartbeat fire | `manager.run(agent, message, { kind: "job" })` |
| Task mode (`--task`) | `manager.run(agent, task, { kind: "job" })` |
| Handler dispatch (`run-agent-task`) | `manager.run(cmd.agent, cmd.message, { kind: "job" })` |
| `@agent` prefix | `manager.run(target, message, { kind: "job" })` |

### `send` Doesn't Create Sessions

`send` writes to `workspace/todo.md` and triggers heartbeat. The heartbeat creates the session as `kind: "job"`.

### Call Sessions

`callAgent` sets `kind: "call"` automatically. The parent blocks until the child returns a `TaskResult`. On resume after crash, in-flight `callAgent` tool calls get error tool results injected ("process restarted") — the parent sees the error and re-dispatches.

## Resume Logic

Three resume mechanisms, layered:

### 1. Startup Resume (infrastructure)

`resumeStaleSessions()` runs at process startup. Picks up sessions left
in `status: "running"` from a crashed process. Reloads JSONL, repairs
broken tool calls, injects restart notice, continues the agent loop.

```typescript
resumeStaleSessions(opts?: {
  abort?: boolean;
  kinds?: SessionKind[];
}): { resumed: SessionInfo[]; interrupted: SessionInfo[] }
```

### 2. AutoResume (bus subscriber)

Reacts to `session_end` events with `status: "interrupted"`. If the session
did real work (`opCount > 0`), schedules a resume after 10-20s backoff.
Escalates to human after 2 failed attempts.

Key: uses `opCount` (persisted to meta.json), not `turnCount` (unreliable).
Skips sessions closed deliberately (`error === "Closed"` from `/new` command).

### 3. Manual Resume (socket command)

```json
{"type": "resume", "sessionId": "s_xxx"}
```

Calls `manager.resumeInterrupted(sessionId)` which works for any session
regardless of status. Reloads JSONL, repairs messages, continues. Use for
sessions that AutoResume skipped or that errored and need a retry after
the underlying issue (API config, model name) is fixed.

### Startup Sequence

```
1. if --cron: resumeStaleSessions({ kinds: ["job"] })
   → Find all stale job sessions (status: "running") → resume each
   → Chat and call sessions left untouched

2. resumeStaleSessions({ abort: true, kinds: ["call"] })
   → Clean up orphaned call sessions (parent is gone)

3. if --chat:
   → resumeStaleSessions({ kinds: ["chat"] }) to restore idle chat sessions
   → ChatSession.resumeAfterLoad() attaches to the newest
```

### Why Not Resume `call` Sessions?

Parent re-dispatches on its own resume. Resuming call sessions independently
would complete them with no parent waiting.

### Why Not Auto-Resume `chat` Sessions?

Human-owned. User decides to continue or `/new`.

## Cron Backpressure

`heartbeat-precheck` JS handler checks `manager.getActiveSessions()` before firing a heartbeat. If the agent is already busy, the heartbeat is skipped.

## Migration

Old sessions without `kind` field default to `"job"`.

## Philosophy Alignment
- **P1 Simplest Thing**: Single `ActiveSession` state machine with `autoClose` policy.
- **P11 File System as Memory**: Strict state isolation. In-memory state is transient.
- **P30 Heartbeat Is Just a Wake-Up**: Fresh task sessions guarantee no pollution.
- **P45 Agents Do Cognitive Work**: Scheduling/backpressure offloaded to infra.
