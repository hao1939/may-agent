# Design: Unified Sub-Agent API with Attached/Detached Modes

## Status: Draft v2 (2025-03-07)

---

## Core Idea

Same `subagents` tool API. Two execution backends. The agent doesn't need to think about processes vs threads — it just says whether it wants the task attached (blocking, in-process) or detached (independent process).

```
subagents.run(agent="bob", task="Analyze failures")            // attached (default)
subagents.run(agent="bob", task="Analyze failures", mode="detached")  // dedicated instance
```

Both return `{ sessionId }`. All downstream operations — `status`, `progress`, `result`, `waitFor`, `cancel`, `steer` — work transparently on either kind.

---

## Architecture: Two Communication Paths

### Attached (in-process)
```
Parent Agent ←→ manager.run() / manager.steer() / manager.cancel()
                    ↕
                ActiveSession (shared event loop, shared memory)
```

### Detached (dedicated instance)
```
Parent Agent ←→ subagents tool ←→ socket client
                                      ↕ (JSON over Unix socket)
              .state/instances/job-<sid>/<agent>.sock
                                      ↕
                Dedicated may.ts process (own event loop, own memory)
                    ↕
                identity.json + meta.json + session.jsonl (shared disk)
```

Key insight: detached instances **already have a Unix socket** that accepts `RunnerCommand` JSON and broadcasts `RunnerEvent` JSON. We just need to use it.

---

## What Already Exists

### Detached Instance Infrastructure (all working today)

| Component | Location | What it does |
|---|---|---|
| `may.ts --task` | `run/may.ts` | Ephemeral mode: runs one task, waits for idle, exits |
| `identity.json` | `.state/instances/<name>/` | PID, socket path, status, sessionId, startedBy |
| `<agent>.sock` | `.state/instances/<name>/` | Unix socket accepting RunnerCommands |
| `meta.json` | `.state/sessions/<sid>/` | Session metadata (agent, task, status, timestamps) |
| `session.jsonl` | `.state/sessions/<sid>/` | Full message history |

### Socket Protocol (already implemented in socket-ui.ts + may.ts)

**Commands** (send JSON line to socket):
```json
{"type": "steer", "message": "Change approach to X"}
{"type": "cancel", "sessionId": "s_123"}
{"type": "cancel_all"}
{"type": "status"}
{"type": "run", "agent": "optimizer", "message": "..."}
```

**Events** (streamed back as JSON lines):
```json
{"type": "connected", "maySession": "s_123", "activeAgents": [...]}
{"type": "text", "agent": "bob", "text": "I'll analyze...", "channel": "chat"}
{"type": "tool_call", "agent": "bob", "tool": "read", "args": {...}}
{"type": "tool_result", "agent": "bob", "tool": "read", "preview": "..."}
{"type": "session_end", "agent": "bob", "sessionId": "s_123", "status": "completed"}
{"type": "info", "message": "[task] Completed"}
```

---

## Detached Operations via Socket + Disk

### `run` (detached)
**Mechanism**: Spawn process. No socket needed (process starts its own).

```typescript
const sessionId = generateId(agentDef.sessionIdPrefix);
const instanceName = `job-${sessionId}`;

const proc = spawn(process.execPath, [
  ...filteredExecArgv(),
  resolve(projectRoot, "run/may.ts"),
  "--task", params.task,
], {
  cwd: projectRoot,
  stdio: "ignore",
  detached: true,
  env: {
    ...process.env,
    AGENT: params.agent,
    INSTANCE: instanceName,
    SESSION_ID: sessionId,  // Pre-generated so parent can track
  },
});
proc.unref();
```

Return: `{ sessionId, mode: "detached", pid: proc.pid, instance: instanceName }`

### `steer` (detached) — NEW action
**Mechanism**: Send `{"type":"steer","message":"..."}` to the instance's socket.

```typescript
// Read identity.json to find socket path
const identity = readIdentity(instanceName);
if (identity?.status !== "running") throw new Error("Session not running");

// Send steer command via socket
await sendSocketCommand(identity.socket, {
  type: "steer",
  message: params.message,
});
```

This is the key insight — **steer via socket gives real-time interaction with detached sessions**, not just fire-and-forget.

### `cancel` (detached)
**Mechanism**: Send `{"type":"cancel","sessionId":"..."}` to the instance's socket. Falls back to `process.kill(pid, "SIGTERM")` if socket is dead.

```typescript
const identity = readIdentity(instanceName);
try {
  // Graceful: ask via socket (allows cleanup)
  await sendSocketCommand(identity.socket, {
    type: "cancel",
    sessionId: params.sessionId,
  });
} catch {
  // Socket dead — hard kill
  if (identity?.pid) process.kill(identity.pid, "SIGTERM");
}
```

### `status` (detached)
**Mechanism**: Already works — `registry.getSession()` reads `meta.json` from shared disk. For live status, read `identity.json`:

```typescript
// Persisted session metadata (always available)
const meta = registry.getSession(params.sessionId);

// Live process status (if still running)
const identity = readIdentity(instanceForSession(params.sessionId));
if (identity) {
  meta.processStatus = identity.status;  // "running" | "done" | "error"
  meta.pid = identity.pid;
}
```

### `progress` (detached)
**Mechanism**: Two options:

**Option A — Disk (simple, batch)**: Read `session.jsonl` from disk.
```typescript
const messages = readSessionMessages(persistDir, params.sessionId);
const limited = params.limit ? messages.slice(-params.limit) : messages;
```

**Option B — Socket (streaming, real-time)**: Connect to socket, collect events for N seconds.
```typescript
const identity = readIdentity(instanceName);
const events = await collectSocketEvents(identity.socket, { timeoutMs: 5000 });
// Filter for text/tool_call/tool_result events
```

**Recommendation**: Option A for `progress` (agent wants a batch of messages). Option B is useful if we add a `stream` or `watch` action later.

### `waitFor` (detached)
**Mechanism**: Connect to socket, listen for `session_end` event. Falls back to polling `meta.json` if socket unavailable.

```typescript
const identity = readIdentity(instanceName);
try {
  // Preferred: listen on socket for completion event
  await waitForSocketEvent(identity.socket, "session_end", {
    sessionId: params.sessionId,
    timeoutMs: 600_000,
  });
} catch {
  // Fallback: poll meta.json
  await pollMetaForCompletion(persistDir, params.sessionId, {
    pollIntervalMs: 3000,
    timeoutMs: 600_000,
  });
}
// Read final result from disk
const result = buildResultFromMeta(persistDir, params.sessionId);
```

### `result` (detached)
**Mechanism**: Read from disk (session is already done).
```typescript
const meta = registry.getSession(params.sessionId);
const messages = readSessionMessages(persistDir, params.sessionId);
const lastAssistant = messages.filter(m => m.role === "assistant").pop();
return {
  status: meta.status,
  agent: meta.agent,
  output: lastAssistant?.content,
  startedAt: meta.startedAt,
  endedAt: meta.endedAt,
};
```

---

## Schema Changes

### SubagentToolParams

```typescript
const SubagentToolParams = Type.Object({
  action: StringEnum(
    ["list", "run", "status", "progress", "result", "cancel", "waitFor",
     "delegate", "trace", "health", "steer"] as const,  // Added "steer"
    { description: "..." }
  ),
  agent: Type.Optional(Type.String({ ... })),
  task: Type.Optional(Type.String({ ... })),
  sessionId: Type.Optional(Type.String({ ... })),
  limit: Type.Optional(Type.Number({ ... })),
  // NEW:
  mode: Type.Optional(StringEnum(
    ["attached", "detached"] as const,
    { description: "Execution mode for 'run'/'delegate'. 'attached' (default): in-process. 'detached': dedicated OS process." }
  )),
  message: Type.Optional(Type.String({
    description: "Message content for 'steer' action"
  })),
});
```

### PersistedSession (meta.json)

```typescript
interface PersistedSession {
  // existing...
  detached?: boolean;     // true if spawned as dedicated instance
  pid?: number;           // PID of detached process
  instance?: string;      // instance name → .state/instances/<instance>/
}
```

### InstanceIdentity (identity.json) — add sessionId reliably

Already has `sessionId` but optional. For detached mode, pass `SESSION_ID` env var so it's written at startup:
```typescript
// In may.ts, at session creation:
const SESSION_ID_OVERRIDE = process.env.SESSION_ID;
// Use it when generating the session ID
```

---

## Socket Client Utility

New file: `src/socket-client.ts`

```typescript
import { connect } from "node:net";
import type { RunnerCommand, RunnerEvent } from "../run/event-bus.js";

/** Send a command to a running instance's socket. */
export function sendSocketCommand(
  socketPath: string,
  command: RunnerCommand,
  opts?: { timeoutMs?: number }
): Promise<{ ok: boolean; response?: RunnerEvent }> {
  return new Promise((resolve, reject) => {
    const client = connect(socketPath);
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error("Socket timeout"));
    }, opts?.timeoutMs ?? 5000);

    let buffer = "";
    client.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        const event = JSON.parse(line);
        if (event.type === "ok") {
          clearTimeout(timeout);
          client.destroy();
          resolve({ ok: true, response: event });
        }
      }
    });

    client.on("connect", () => {
      // Skip the welcome "connected" message, then send command
      client.write(JSON.stringify(command) + "\n");
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/** Connect to socket and wait for a specific event type. */
export function waitForSocketEvent(
  socketPath: string,
  eventType: string,
  opts: { sessionId?: string; timeoutMs?: number }
): Promise<RunnerEvent> {
  return new Promise((resolve, reject) => {
    const client = connect(socketPath);
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Timeout waiting for ${eventType}`));
    }, opts.timeoutMs ?? 600_000);

    let buffer = "";
    client.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.type === eventType) {
            if (!opts.sessionId || event.sessionId === opts.sessionId) {
              clearTimeout(timeout);
              client.destroy();
              resolve(event);
            }
          }
        } catch {}
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
```

---

## Dispatch Logic in the Tool Handler

The core pattern: every action checks if the session is attached or detached, and dispatches accordingly.

```typescript
function isDetachedSession(sessionId: string): boolean {
  // If it's an active in-process session, it's attached
  if (manager.hasActiveSession(sessionId)) return false;
  // Check registry for detached flag
  const meta = registry.getSession(sessionId);
  return meta?.detached === true;
}

function getSocketPath(sessionId: string): string | null {
  const meta = registry.getSession(sessionId);
  if (!meta?.instance) return null;
  const identityPath = resolve(INSTANCES_DIR, meta.instance, "identity.json");
  try {
    const identity = JSON.parse(readFileSync(identityPath, "utf-8"));
    return identity.socket;
  } catch { return null; }
}
```

---

## For Cron System

`fireTask` in cron.ts uses the same `spawnDetachedAgent()` utility:

```typescript
import { spawnDetachedAgent } from "../src/detached.js";

private fireTask(entry: CronEntry): void {
  const { sessionId, pid } = spawnDetachedAgent({
    projectRoot: this.projectRoot,
    agent: entry.agent ?? this.defaultAgent,
    task: entry.message,
    instancePrefix: "job",
    parentSessionId: this.parentSessionId,
  });
  this.runningTasks.set(entry.name, { sessionId, pid, startedAt: Date.now() });
}
```

---

## Implementation Plan

### Phase 1: Core (minimum viable)
1. **`src/detached.ts`** — `spawnDetachedAgent()` + `readIdentity()` helpers
2. **`src/socket-client.ts`** — `sendSocketCommand()` + `waitForSocketEvent()`
3. **`SESSION_ID` env var** in may.ts — accept pre-generated session ID
4. **`mode` parameter** in SubagentToolParams
5. **Branch in `run` action** — attached vs detached dispatch
6. **Branch in `cancel`/`waitFor`** — socket-based for detached

### Phase 2: Rich interaction
7. **`steer` action** — works for both attached (manager.steer) and detached (socket)
8. **`progress` for detached** — read session.jsonl from disk
9. **`result` for detached** — read from disk after completion

### Phase 3: Cron unification
10. **Refactor `fireTask`** — use `spawnDetachedAgent()` from Phase 1
11. **Remove `may.sh` dependency** — cron no longer shells out

### Phase 4: Polish
12. **Tests** — detached lifecycle (spawn → status → steer → result)
13. **Cleanup** — remove `run-agent-task.ts` handler (replaced by detached mode)
14. **Docs** — update agent CONVENTIONS with mode guidance

---

## When to Use Which Mode

| Scenario | Mode | Why |
|---|---|---|
| Quick task (< 2 min) | `attached` | Low overhead, rich in-process lifecycle |
| Long-running analysis | `detached` | Won't block parent's event loop |
| Task that survives parent restart | `detached` | Own process, own persistence |
| Interactive back-and-forth | `attached` | Real-time steer/progress via memory |
| Background cron job | `detached` | Should not compete with interactive session |
| Workflow step | `attached` | Workflow engine needs tight control |

---

## Summary

The design gives agents one familiar API with a `mode` toggle. The heavy lifting is in two small new files (`detached.ts`, `socket-client.ts`) plus branching logic in the existing tool handler. Everything else — identity.json, socket protocol, session persistence, meta.json — already exists and works.
