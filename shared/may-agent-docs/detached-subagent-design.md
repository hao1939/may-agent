# Detached Sub-Agent Design

## Status: v3 (2025-03-07) — Simplified after notification system implementation

## Core Principle

**A detached sub-agent is identical to an attached one, except it survives the caller's restart.**

No special APIs. No special status paths. No special notification channels. Same `subagents` tool, same registry, same session.jsonl, same notification system. The only difference is the OS process boundary.

## Attached vs Detached

| | Attached (default) | Detached |
|---|---|---|
| Process | Same as parent | Separate OS process |
| Survives parent restart | No | **Yes** |
| Status | Registry (shared disk) | Registry (shared disk) |
| Progress | session.jsonl (shared disk) | session.jsonl (shared disk) |
| Result | session.jsonl (shared disk) | session.jsonl (shared disk) |
| Completion notification | `handleCompletion` → followUp | `handleCompletion` → fallback file → parent's `fs.watch` |
| Cancel | `agent.abort()` (in-memory) | `process.kill(pid, SIGTERM)` |
| API | `subagents.run(agent, task)` | `subagents.run(agent, task, mode="detached")` |

Everything in the "same" column is already implemented. The detached column only differs in 3 places: spawn, notification path, and cancel.

## How It Works

### Spawn

```typescript
subagents.run(agent="bob", task="Analyze failures", mode="detached")
```

Manager spawns a separate process:

```typescript
const sessionId = generateId("s");
const instanceName = `job-${sessionId}`;

const proc = spawn(process.execPath, [
  ...filteredExecArgv(),
  resolve(projectRoot, "run/may.ts"),
  "--task", task,
], {
  cwd: projectRoot,
  stdio: "ignore",
  detached: true,
  env: {
    ...process.env,
    AGENT: agentName,
    INSTANCE: instanceName,
    SESSION_ID: sessionId,
    PARENT_SESSION_ID: parentSessionId,
    PARENT_AGENT: parentAgentName,
  },
});
proc.unref();
```

Returns `{ sessionId }` — same as attached. The agent doesn't know or care.

### Notification (cross-process)

When the detached sub-agent finishes:

```
Detached process: handleCompletion fires
  → tries followUp to parentSessionId → parent not in this process's activeSessions
  → tries followUp to parent agent's persistent session → not in this process
  → writes to .state/undelivered-notifications.jsonl

Parent process: fs.watch picks up the file change
  → drainUndeliveredNotifications()
  → routes followUp to the right session
  → agent receives [task-complete] ✅ bob finished (5m12s): "Analyze failures"
```

This is the standard notification system — no special detached logic needed. The fallback file is the cross-process bridge. Already implemented.

### Status / Progress / Result

All read from shared disk. No mode check needed:

```typescript
// These already work for both attached and detached:
subagents.status(sessionId)    // → reads registry (meta.json)
subagents.progress(sessionId)  // → reads session.jsonl
subagents.result(sessionId)    // → reads registry + session.jsonl
```

### Cancel

```typescript
// Attached: in-memory abort
if (activeSessions.has(sessionId)) {
  activeSessions.get(sessionId).agent.abort();
}
// Detached: signal the process
else {
  const meta = registry.getSession(sessionId);
  if (meta?.pid) process.kill(meta.pid, "SIGTERM");
}
```

### WaitFor

```typescript
// Attached: wait on in-memory promise (existing)
// Detached: poll registry until status is done/error
function waitForDetached(sessionId, timeoutMs = 600_000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const meta = registry.getSession(sessionId);
      if (meta && (meta.status === "done" || meta.status === "error" || meta.status === "interrupted")) {
        clearInterval(interval);
        resolve(buildResult(meta));
      }
    }, 3000);
    setTimeout(() => { clearInterval(interval); reject(new Error("Timeout")); }, timeoutMs);
  });
}
```

Or: just don't waitFor detached tasks. The notification system delivers the result when it's done. The whole point of detached is fire-and-forget.

## Registry Changes

```typescript
interface PersistedSession {
  // existing fields...
  detached?: boolean;   // true if spawned as separate process
  pid?: number;         // PID of detached process (for cancel)
  instance?: string;    // instance name → .state/instances/<name>/
}
```

## Schema Changes

```typescript
// Add mode parameter to SubagentToolParams:
mode: Type.Optional(StringEnum(
  ["attached", "detached"] as const,
  { description: "Execution mode for 'run'. Default: attached (in-process). Detached: separate OS process, survives caller restart." }
)),
```

## Implementation Plan

### Phase 1: Core (minimal — ~50 lines)

| # | What | Where | Lines |
|---|---|---|---|
| 1 | `spawnDetachedAgent()` helper | `src/detached.ts` (new) | ~25 |
| 2 | `mode` parameter in tool schema | `src/manager.ts` | ~3 |
| 3 | Branch in `run` action | `src/manager.ts` createTool | ~10 |
| 4 | Branch in `cancel` action | `src/manager.ts` createTool | ~5 |
| 5 | `SESSION_ID` env var support | `run/may.ts` | ~3 |
| 6 | `PARENT_SESSION_ID` / `PARENT_AGENT` env vars | `run/may.ts` | ~5 |

That's it. Status/progress/result already work. Notification already works.

### Phase 2: Advanced control via socket (deferred)

Socket-based `steer` and graceful `cancel` for agents that need real-time interaction with running detached sub-agents. This is a **diagnostic/debugging skill**, not part of the core lifecycle.

| # | What | Where |
|---|---|---|
| 7 | `sendSocketCommand()` utility | `src/socket-client.ts` (new) |
| 8 | `steer` action in subagents tool | `src/manager.ts` createTool |
| 9 | Graceful cancel via socket (before SIGTERM) | `src/manager.ts` createTool |

**Not needed for v1.** The socket infrastructure already exists (identity.json, unix sockets). We just need a client when the use case arises.

### Phase 3: Cron unification (deferred)

Replace cron's `fireTask` with `spawnDetachedAgent()` from Phase 1.

## Architectural Insight

### Control vs Observation vs Notification

| Concern | Mechanism | Why |
|---|---|---|
| **Observation** (status, progress, result) | Shared disk (registry, session.jsonl) | Already works, crash-proof, no mode switch |
| **Notification** (task complete) | `undelivered-notifications.jsonl` + `fs.watch` | Already implemented, cross-process bridge |
| **Control** (steer, cancel) | Socket (Phase 2) / SIGTERM (Phase 1) | Only way to inject into a running process |

Observation and notification are **already solved** by existing infrastructure. Only control needs new code, and Phase 1's SIGTERM is good enough to start.

## When to Use Detached

| Scenario | Mode | Why |
|---|---|---|
| Quick task (< 5 min) | attached | Low overhead, simpler |
| Long task that must survive restart | **detached** | Own process boundary |
| Background cron job | **detached** | Should not die with parent |
| Workflow step | attached | Workflow engine needs tight control |
| Default | attached | Simpler, faster, less moving parts |

## Philosophy Alignment

- **P1 Simplest Thing**: Shared disk for observation, SIGTERM for cancel. No socket client for v1.
- **P10 Crash Recovery**: Disk-based observation works even if child crashes. Notification fallback file survives restarts.
- **P15 Minimal Viable**: Phase 1 is ~50 lines. Phase 2 deferred until needed.
- **P40 Infra Owns Plumbing**: Agent says `mode="detached"`. Manager handles everything else.
