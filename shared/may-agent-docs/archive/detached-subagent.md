# Detached Sub-Agent Design

## Status: v3 (2025-03-07) — Core implemented, advanced features deferred

### Implementation Status
- **Phase 1 (Core spawn)**: ✅ IMPLEMENTED in `src/lib/detached.ts`
- **Phase 2 (Socket-based steer/cancel)**: 🔮 UNIMPLEMENTED — deferred until use case arises
- **Phase 3 (Cron unification)**: ⚠️ PARTIAL — `run-agent-task` handler uses `spawnDetachedAgent` for heavy jobs

**Important**: Detached spawning is **infra-only** — called by cron handlers and infrastructure code, NOT exposed as an agent tool parameter. The `mode="detached"` parameter is a design proposal that was NOT added to the agents tool schema. Agents cannot request detached mode.

## Core Principle

**A detached sub-agent is identical to an attached one, except it survives the caller's restart.**

No special APIs. No special status paths. Same registry, same session.jsonl. The only difference is the OS process boundary.

## Attached vs Detached

| | Attached (default) | Detached |
|---|---|---|
| Process | Same as parent | Separate OS process |
| Survives parent restart | No | **Yes** |
| Status/progress | Registry + session.jsonl (shared disk) | Registry + session.jsonl (shared disk) |
| Completion notification | In-process callback (`onSessionComplete`) | `identity.json` status field (polled) |
| Cancel | `agent.abort()` (in-memory) | `process.kill(pid, SIGTERM)` |
| Spawned by | `manager.run()` (in-process) | `spawnDetachedAgent()` (cron handlers) |

## How It Works

### Spawn (`src/lib/detached.ts`, ~87 lines)

Cron handlers call `spawnDetachedAgent()`:

```typescript
spawnDetachedAgent({
  projectRoot,
  agentName: "bob",
  task: "Analyze failures",
  sessionId: generateId("s"),
});
```

This spawns a separate `may.ts --task` process with `detached: true`, `unref()`.
The child writes `identity.json` to `.state/instances/<name>/` on startup.

### Completion Notification

**In-process (attached)**: `handleCompletion()` fires → `onSessionComplete` callback → `may.ts` surfaces errors via EventBus.

**Cross-process (detached)**: The detached process writes `identity.json` with `status: "done"` or `status: "error"` when complete. The parent process does NOT actively watch for this — there is no `fs.watch` or polling loop. The result is discoverable on disk if needed (e.g., during next heartbeat or manual inspection).

> **Design note**: The original design proposed `undelivered-notifications.jsonl` + `fs.watch` for cross-process notification with startup reconciliation and heartbeat drain as safety net. This was **never implemented**. Cross-process notification is currently passive — results sit in `identity.json` and session history until someone reads them.

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

### Registry

```typescript
interface PersistedSession {
  // existing fields...
  detached?: boolean;   // true if spawned as separate process
  pid?: number;         // PID of detached process (for cancel)
  instance?: string;    // instance name → .state/instances/<name>/
}
```

## Phase 2: Socket-based control — 🔮 UNIMPLEMENTED (deferred)

Socket-based `steer` and graceful `cancel` for real-time interaction with running detached sub-agents. The socket infrastructure exists (`identity.json`, unix sockets). Only needs a client when the use case arises.

## Phase 3: Cron unification — ⚠️ PARTIAL

`run-agent-task` handler uses `spawnDetachedAgent()` for agent cron jobs (analyze-failures, optimize, lesson-consolidation, focus-task-driver). Regular heartbeats still use in-process `manager.run()`.

## When to Use Detached

| Scenario | Mode | Why |
|---|---|---|
| Quick task (< 5 min) | attached | Low overhead, simpler |
| Long task that must survive restart | **detached** | Own process boundary |
| Background cron job (24h cycle) | **detached** | Should not die with parent |
| Workflow step | attached | Workflow engine needs tight control |
| `agents.call` | attached | Caller blocks on result |
| Default | attached | Simpler, faster, less moving parts |

## Philosophy Alignment

- **P1 Simplest Thing**: Shared disk for observation, SIGTERM for cancel. No socket client for v1.
- **P10 Crash Recovery**: Disk-based observation works even if child crashes.
- **P15 Minimal Viable**: Phase 1 is ~87 lines. Phase 2 deferred until needed.
