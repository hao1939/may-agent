# Brief: V2 System Upgrade — Phase 2: The Chat Loop

**To:** Tech Lead
**From:** Bob
**Date:** 2026-03-10
**Status:** READY FOR IMPLEMENTATION

## Context
Phase 1 (The `callAgent` primitive) is complete and tested. We now have a crash-safe way to run multi-step agent workflows.

Phase 2 is replacing the **Runner** — the entry point that starts the system.
Currently, `src/app/may.ts` is a complex persistent agent session.
We are moving to a lightweight **Chat Loop** that spawns ephemeral sessions.

## The Goal
Create `src/v2/chat-loop.ts` which will eventually replace `src/app/may.ts`.

## Requirements

### 1. The Loop
- A simple `while(true)` loop that reads from `stdin`.
- Use `readline` or similar.
- **Stateless**: The loop itself holds almost no state. All state is on disk (session files).

### 2. Command Handling
Before sending to an agent, check for slash commands:
- `/status` — List active sessions (scan `.state/sessions/`).
- `/cancel <id>` — Write a `[CANCELLED]` sentinel to a session dir.
- `/help` — Show commands.
- `/exit` — Kill the process.

### 3. Session Spawning
When the user types a message (not a command):
1. Generate a session ID (`s_...`).
2. Create the session directory.
3. **Run "may"** with the user's input as the task.
   - Use `manager.run("may", input, { sessionId })`.
   - **Crucial**: This is an *ephemeral* session. May wakes up, reads the task, does it, and dies.

### 4. Output Streaming
The loop must stream the sub-agent's output to `stdout`.
- Tail the `journal.md` or listen to events from `manager.run`.
- Format it nicely (e.g., `[may] I am working...`).

## Implementation Plan
1. **Create `src/v2/chat-loop.ts`**.
2. **Implement the CLI loop**.
3. **Integrate `manager.run`** (reuse existing logic).
4. **Add a script `scripts/v2-console.ts`** to run this mode.

## Constraints
- **Do not delete `src/app/may.ts` yet.** This is a parallel build.
- **Use `manager.run`**: We are not rewriting the agent execution logic, just the interface.

**Execute Phase 2.**
