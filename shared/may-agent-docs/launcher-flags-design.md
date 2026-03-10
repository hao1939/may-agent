# Design: Launcher Flags & Chat Session Model

**Status**: Implemented  
**Date**: 2026-03-10  
**Context**: Defines the CLI interface for `may.ts` (the agent runtime) and the explicit distinction between "Chat" and "Task" sessions.

## Core Concept: Explicit Mode Selection

The runtime (`src/app/may.ts`) operates in one of three mutually exclusive modes, controlled by flags. There is no implicit default.

| Mode | Flag | Description |
|------|------|-------------|
| **Chat** | `--chat` | Persistent, interactive session. Supports resume, compaction, and idle loop. |
| **Task** | `--task "..."` | Ephemeral session. Runs one task, then exits. No persistence, no compaction. |
| **Cron** | `--cron` | Headless daemon. Runs scheduled jobs only. No primary session. |

### Why this matters
Previously, the `--keep-session` flag conflated persistence, interactivity, and "being the interface agent." This caused bugs where heartbeat sessions accidentally became persistent. The new design separates **Intent** (Chat vs Task) from **Mechanism** (Persistence).

---

## Flag Reference

### Mode Flags (Choose One)

- **`--chat`**  
  Starts or resumes the singleton "Chat Session" for the interface agent.
  - **Behavior**: If a session exists, it resumes. If not, it creates a new one.
  - **Lifecycle**: Runs until manually stopped. When idle, it waits for input.
  - **Persistence**: ALWAYS on. State is saved to disk and compacted.

- **`--task "instruction"`**  
  Starts a fresh, ephemeral "Task Session".
  - **Behavior**: Starts fresh, runs the instruction, then exits.
  - **Lifecycle**: Dies immediately after task completion.
  - **Persistence**: OFF. State is temporary and discarded (unless explicitly saved by agent).

- **`--task-file <path>`**  
  Same as `--task`, but reads the instruction from a file. Useful for long/complex prompts.

- **`--cron`**  
  Enables the internal scheduler.
  - **Behavior**: Can run *alongside* `--chat` (interactive + background jobs) or *alone* (headless worker).
  - **Lifecycle**: Keeps the process alive to run scheduled tasks.

### I/O Flags (Additive)

- **`--console`**  
  Enables pretty-printed ANSI output to stdout. Without this, output is JSON-line logs or silent.

- **`--telegram`**  
  Connects the Telegram bot bridge. Allows remote control via Telegram.

- **`--socket`**  
  Opens a Unix domain socket (`.state/instances/<name>/may.sock`) for external control (CLI tools, other agents).

### Deprecated / Removed

- **`--keep-session`** (Removed) — Replaced by `--chat`.
- **`--heartbeat`** (Removed) — Heartbeat is now just a cron job, not a special mode.
- **`--openclaw`** (Removed) — OpenClaw integration was deprecated.

---

## Chat Session Model

The "Chat Session" is a specific, privileged session ID managed by `SubagentManager`.

### The Problem it Solves
In a multi-agent system, which session is "The User"?
- Is it the one running now? (Could be a background cron job)
- Is it the one named "may"? (May runs many background tasks too)

**Solution**: The Chat Session is a designated ID (`this.chatSessionId`).
- Only **one** chat session exists per process.
- It receives all user input (stdin, Telegram, Socket `input` command).
- It is the only session that stays `idle` instead of archiving.

### API: Explicit Methods

The Manager exposes specific methods for this lifecycle:

```typescript
// Create the unique chat session (throws if one exists)
manager.createChatSession("may", "Ready.", { compaction: ... });

// Resume the unique chat session (reconnects to the persisted ID)
manager.resumeChatSession("may", { compaction: ... });

// Get the ID of the current interface session
manager.getChatSessionId();
```

### Notification Routing
When a background task (like a sub-agent) finishes, it needs to notify the user. It sends the notification to `manager.getChatSessionId()`, ensuring the message appears in the user's active thread, not a random dead session.

---

## Common Invocation Patterns

**1. The Standard Interface (May)**
Interactive, runs cron jobs, connected to Telegram.
```bash
npx tsx src/app/may.ts --chat --cron --telegram --console
```

**2. A Single-Task Worker**
Runs one job and exits. No background noise.
```bash
npx tsx src/app/may.ts --task "Summarize the last 3 sessions" --console
```

**3. A Headless Cron Worker**
Runs in the background, processing scheduled jobs.
```bash
npx tsx src/app/may.ts --cron
```

**4. A Detached Sub-Agent**
Spawned by another agent to do work.
```bash
npx tsx src/app/may.ts --task-file /tmp/task-123.txt --agent coder
```
