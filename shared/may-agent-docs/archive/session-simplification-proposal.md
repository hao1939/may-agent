# Proposal: Session Model Simplification (Implementation View)

## Status
**IMPLEMENTED** (2026-03-07) — All 7 tasks complete, 21/21 tests passing — *See `agents/bob/workspace/session-proposal-review.md`*

## Summary

Refactor the `ActiveSession` class to use a unified lifecycle for all agents, eliminating the rigid `persistent` boolean in favor of a flexible `autoClose` policy. This is the **implementation mechanism** to support the architectural "Chat + Task" binary model.

## Motivation

The current session model has two parallel state machines — one for persistent sessions (idle ↔ running, never terminal unless `close()`), one for non-persistent sessions (running → terminal). This causes:

- **~100 lines of branching** in `handleCompletion`, `cancel`, `close`, `followUp`, and `resumeAgent`.
- **Test surface duplication**: Separate tests for persistent vs non-persistent behavior.
- **Architecture drift**: The `persistent` flag is now a proxy for "Is this the Interface Agent?".

## Design

### Core idea

Every session is a conversation thread. The Agent instance in memory is a cache — the session JSONL is the source of truth. Sessions naturally alternate between idle and running as messages arrive.

### State machine (unified)

```
         ┌──────────┐
  send() │          │ loop settles
  ┌──────►  running ├──────────┐
  │      │          │          │
  │      └────┬─────┘          │
  │           │                │
  │      cancel()/close()      │
  │           │                ▼
  │      ┌────▼─────┐    ┌─────────┐
  │      │interrupted│    │  idle   │
  │      └──────────┘    └────┬────┘
  │                           │
  └───────────────────────────┘
                              │
                        auto-close
                       (immediate)
                              │
                        ┌─────▼──────┐
                        │  archived  │
                        └────────────┘
```

Five states with unified transitions. Key changes:
- **Non-persistent sessions** go `running` → `idle` → `archived` (instantly via auto-close).
- **`done`/`error`** are no longer live states. They are metadata on the archived session.
- **`close()`** works the same for everyone.

### Auto-close policy

```typescript
interface RunOptions {
  // ...existing fields...
  /** Auto-close behavior when session goes idle.
   *  - "immediate": close after first idle (current non-persistent behavior)
   *  - "never": stay idle indefinitely (current persistent behavior)
   *  Note: Number/TTL option rejected for now (YAGNI).
   *  Default: "immediate" */
  autoClose?: "immediate" | "never";
}
```

### Usage (The Binary Model)

1.  **Interface Agent** (Chat Session):
    - Config: `autoClose: "never"`
    - Behavior: Runs, goes idle, waits for user input.

2.  **Task Agents** (Sub-agents, Cron):
    - Config: `autoClose: "immediate"`
    - Behavior: Runs, goes idle, immediately archives.
    - Effectively "Run to Completion".

### Crash recovery

1.  **Interface Agent** (`autoClose: "never"`): Restore from JSONL, resume idle/running state.
2.  **Task Agents** (`autoClose: "immediate"`): Do NOT restore. Mark as `failed`/`interrupted` in archive. The parent workflow/scheduler is responsible for retrying (spawning a new session).

### followUp / steer

- `followUp()` on `autoClose: "immediate"`:
    - If running: Queued for next turn (Steering).
    - If archived: Failed (or routed to dead-letter queue).
- `followUp()` on `autoClose: "never"`:
    - If running: Queued.
    - If idle: Wakes session.

## What gets removed

- `persistent` field on `ActiveSession`, `RunOptions`, `SubagentDefinition`
- Persistent/non-persistent branching in `handleCompletion` (~30 lines)
- Persistent check in `cancel()` (~15 lines)
- Persistent check in `followUp()` / `send()` (~10 lines)
- `done`/`error` as live session states
- `persistent-session.test.ts`

## What gets added

- `autoClose` field on `RunOptions`
- Simple check in `handleCompletion`: `if (autoClose === "immediate") close()`

## Migration

1.  Update `ActiveSession` class to accept `autoClose` instead of `persistent`.
2.  Update `Manager.run()`:
    ```typescript
    const isInterface = name === this.interfaceAgentName;
    const autoClose = isInterface ? "never" : "immediate";
    ```
3.  Simplify `handleCompletion`: Remove branching, add auto-close check.

## Risks

- **`done`/`error` checks**: External code checking `session.status === "done"` must now check `session.status === "archived" && session.result.status === "done"`.

## Philosophy Alignment
- **P1 Simplest Thing**: One code path, configured two ways.
- **P12 Context Isolation**: Enforces fresh sessions for tasks (via `immediate` close).
