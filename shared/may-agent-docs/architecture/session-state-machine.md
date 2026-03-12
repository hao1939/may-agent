# Session State Machine

## Overview

Every session has a **status** field. Statuses fall into two categories:

- **Live** (`running`, `idle`) — session is in `activeSessions` in memory
- **Terminal** (`done`, `error`, `interrupted`) — session is archived to disk and removed from memory

Sessions are distinguished by `autoClose`:
- `"immediate"` (default) — archive on completion. Used by `kind: "job"` and `kind: "call"`.
- `"never"` — go idle on completion. Used by `kind: "chat"`.

## Statuses

| Status | Meaning | In memory | On disk (meta.json) |
|---|---|---|---|
| `running` | Agent loop is executing | yes | yes |
| `idle` | Waiting for input | yes | yes |
| `done` | Completed normally | no | yes (history/) |
| `error` | Completed with error | no | yes (history/) |
| `interrupted` | Stopped externally | no | yes (history/) |

## Events

| Event | Source |
|---|---|
| `loop_end` | `prompt()`/`continue()` resolves, `state.error` is falsy |
| `loop_error` | `prompt()`/`continue()` resolves, `state.error` is truthy (not abort) |
| `loop_abort` | `prompt()`/`continue()` resolves, `state.error` contains "aborted" |
| `input()` | External caller sends input to an idle persistent session |
| `cancel()` | External caller cancels the session |
| `close()` | External caller permanently destroys the session |
| `crash` | Process dies (detected on restart by stale status in meta.json) |

## Ephemeral Sessions (autoClose: "immediate")

Used for `kind: "job"` and `kind: "call"`. Linear lifecycle.

```
              ┌─────────┐
              │ running │
              └────┬────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
   loop_end   loop_error  loop_abort
        │          │          │
        ▼          ▼          ▼
    ┌──────┐  ┌───────┐  ┌─────────────┐
    │ done │  │ error │  │ interrupted │
    └──────┘  └───────┘  └─────────────┘
        │          │          │
        └──────────┴──────────┘
                   │
          archive + remove from memory
```

| Current | Event | Next | Actions |
|---|---|---|---|
| `running` | `loop_end` | `done` | archive, remove, notify |
| `running` | `loop_error` | `error` | archive, remove, notify |
| `running` | `loop_abort` | `interrupted` | archive, remove, notify |
| `running` | `cancel()` | — | calls `agent.abort()` → triggers `loop_abort` |
| `running` | `crash` | — | on restart: `resumeStaleSessions` marks interrupted or resumes |

## Persistent Sessions (autoClose: "never")

Used for `kind: "chat"`. Cycles between `running` and `idle`.

```
              ┌─────────┐
       ┌─────►│ running │
       │      └────┬────┘
       │           │
       │    loop_end / loop_error / loop_abort
       │           │
   input()    ┌────▼────┐     close()    ┌─────────────┐
       │      │  idle   │──────────────►│ interrupted │
       └──────┤         │               └──────┬──────┘
              └─────────┘                      │
                                       archive + remove
```

| Current | Event | Next | Actions |
|---|---|---|---|
| `running` | `loop_end` | `idle` | update meta.json |
| `running` | `loop_error` | `idle` | update meta.json |
| `running` | `loop_abort` | `idle` | persist cancellation notice, update meta.json |
| `running` | `cancel()` | — | calls `agent.abort()` → triggers `loop_abort → idle` |
| `running` | `close()` | `interrupted` | cancel children, abort, archive, remove |
| `idle` | `input()` | `running` | queue message, call `continue()` |
| `idle` | `cancel()` | `idle` | no-op |
| `idle` | `close()` | `interrupted` | archive, remove |
| `idle`/`running` | `crash` | — | on restart: left untouched by `resumeStaleSessions({ kinds: ["job"] })` |

## handleCompletion()

Called when the agent's `prompt()`/`continue()` promise settles.

### Determining the outcome

1. **Turn limit**: `turnCount >= maxTurns` → override error to structured message
2. **Abort**: `agent.state.error?.includes("aborted")` → externally stopped
3. **Error**: `agent.state.error` is truthy → LLM/tool/overflow error
4. **Done**: `agent.state.error` is falsy → normal completion

### Ephemeral path (autoClose: "immediate")

```
determine outcome → set terminal status (done/error/interrupted)
  → update meta.json → unsubscribe → archive → remove → notify
```

### Persistent path (autoClose: "never")

```
determine outcome → always set idle → update meta.json
```

No unsubscribe, no archive, no remove, no `onSessionComplete`.

## cancel()

```
if not found or not live: return (no-op)
cascade: cancel all children with parentSessionId == this session
if idle + persistent: return (no-op)
if idle + ephemeral: set interrupted → archive → remove
if running: agent.abort() → handleCompletion fires
```

## close()

Sets `session.closed = true` (prevents late handleCompletion from acting),
then cancels. For persistent sessions, waits for idle, then archives.

## Crash Recovery

On restart, `resumeStaleSessions()` scans meta.json files:

| Found status | kind matches filter | Action |
|---|---|---|
| `running`/`idle` | yes | Resume (reload JSONL, repair tool calls, continue) |
| `running`/`idle` | no | Left untouched |
| `running`/`idle` | detached + alive | Skipped (still running in another process) |
| terminal | any | Already done, skip |

The `kinds` filter is critical: `resumeStaleSessions({ kinds: ["job"] })` only
touches job sessions. Chat sessions are left for the human to decide. Call
sessions are left for their parent to re-dispatch.
