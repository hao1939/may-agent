# Delegation Architecture: Deep Dive & Proposal

## Status: Draft (May, 2025-03-06)

---

## 1. Current State: Two Parallel Systems

The system has **two fundamentally different delegation mechanisms** that evolved independently and now overlap awkwardly.

### System A: SubagentManager (In-Process)

**Where**: `src/manager.ts` → `SubagentManager` class

**How it works**:
1. `manager.run(agentName, task, opts)` → creates an `Agent` instance in the same Node process
2. Agent gets its own tools, system prompt, conversation history
3. Runs asynchronously (promise-based), tracked in `activeSessions` Map
4. Parent can `waitFor()`, `progress()`, `result()`, `cancel()`, `steer()`, `followUp()`
5. Sessions persisted to `.state/sessions/<id>/session.jsonl`

**Exposed to agents via**: `subagents` tool with actions: `run`, `delegate`, `status`, `progress`, `result`, `cancel`, `waitFor`, `list`, `health`, `trace`

**Strengths**:
- Rich interaction: parent can monitor progress, steer, read result
- Full lifecycle management
- Structured parent-child relationships (parentSessionId)
- Evaluation pipeline can assess delegated work
- Agent composition: agent A can delegate to agent B who delegates to agent C

**Weaknesses**:
- All agents share one process — a crash kills everything
- All agents share one process's memory — LLM context is in-memory
- Process restart = all running sub-agent sessions lost
- No isolation between agents
- May's persistent session and all sub-agents compete for the same event loop

### System B: Cron Job Spawning (Dedicated Process)

**Where**: `run/cron.ts` → `fireTask()` method

**How it works**:
1. Cron tick fires → `fireTask(entry)` called
2. Spawns `bash may.sh task --agent <agent> --name <name> "message"` as detached child
3. Process runs independently (unref'd, detached)
4. Tracked via PID in `runningTasks` Map + `job-history.jsonl`
5. Timeout protection (SIGTERM → SIGKILL)

**Exposed to agents via**: Nothing. Agents can't trigger this. Only cron timers fire it.

**Strengths**:
- Process isolation — agent crash doesn't affect May
- Survives May's own restarts (detached)
- Independent resource usage

**Weaknesses**:
- **BROKEN**: `may.sh` doesn't exist in Docker container. All `fireTask` jobs silently fail.
- No interaction: no progress monitoring, no steering, no result retrieval
- Only accessible via cron timers — no on-demand triggering
- No structured parent-child relationship
- No evaluation pipeline integration
- Job result is just "process exited with code 0/1" — no content

### System C: Handler (In-Process JS)

**Where**: `run/cron.ts` → `fireHandler()` + `agents/may/handlers/*.ts`

**How it works**:
1. Cron tick fires → handler function called in-process
2. Handler has access to `HandlerContext` (manager, persistDir, emit, etc.)
3. Handlers can call `manager.run()` or `manager.followUp()` internally
4. Results tracked in job-history.jsonl

**What exists**: `drain-todo`, `evaluate-sessions`, `system-status`, `watchdog`

**This is actually System A + scheduling glue**: Handlers don't bypass SubagentManager. `drain-todo` calls `manager.run()` which creates an in-process sub-agent. So it has all of System A's strengths AND weaknesses.

### System D: Heartbeat Sessions (Persistent In-Process)

**Where**: `run/cron.ts` → `fireHeartbeat()` 

**How it works**:
1. Cron tick fires → creates or reuses a **persistent** session for the agent
2. First fire: `manager.run(agent, message, { persistent: true })` → session stays "idle" after completion
3. Subsequent fires: `manager.followUp(sessionId, message)` → wakes idle session
4. Session accumulates conversation history (with compaction at threshold 0.6)

**Used by**: heartbeat-bob, heartbeat-optimizer, heartbeat-coach, heartbeat-evaluator, heartbeat-amy, heartbeat-scout

**This is a variant of System A** with session reuse. Same process, same memory, same crash risk. But has the nice property of accumulated context across heartbeat cycles.

---

## 2. The Actual Problems

### P1: `fireTask` is dead code in Docker
All jobs without handlers (`analyze-failures`, `optimize`, `health-check`, `coaching`, `lesson-consolidation`) silently fail because `may.sh` doesn't exist in the container. **These 5 jobs produce no work.**

### P2: No on-demand process spawning
When May wants to immediately dispatch work to bob, the only options are:
- `subagents.run("bob", task)` → in-process, dies on restart
- Write to `todo.md` → 4-hour wait for drain-todo cron
- Neither gives "immediate + independent process"

### P3: Everything runs in one process
With 6 heartbeat sessions + drain-todo delegations + direct sub-agent usage, a single Node.js process can have 10+ concurrent LLM conversations. Memory pressure, event loop contention, and single-point-of-failure.

### P4: Heartbeat sessions accumulate without bound
6 persistent heartbeat sessions each maintain in-memory conversation history. Compaction helps but doesn't eliminate the growth. Eventually OOM.

### P5: No visibility into fire-and-forget work
When drain-todo calls `manager.run("bob", task)`, the resulting session is:
- Tracked in manager's activeSessions Map
- Persisted to disk
- Watchdog can cancel it if stale
- BUT May doesn't know it exists unless she actively checks `subagents.status()`

---

## 3. Proposal: Unified Delegation with Handler Instances

### Core Idea

Stop trying to have two process models. **Standardize on in-process SubagentManager as the primary delegation mechanism**, but add the missing pieces:

1. **Fix `fireTask` by converting it to use handlers (like drain-todo)**
2. **Add on-demand triggering to cron system**
3. **Implement session budgets per agent**
4. **Replace heartbeat persistent sessions with ephemeral ones**

### 3.1: Convert all `fireTask` jobs to handlers

Instead of spawning `may.sh` (which doesn't work), make all jobs use handlers:

```
// agents/may/handlers/run-agent-task.ts — generic handler
export const create: HandlerModule["create"] = (ctx, entry) => {
  const agentName = entry.agent || "may";
  const message = entry.message || `[cron:${entry.name}] Execute your task.`;
  
  return async () => {
    const sessionId = ctx.manager.run(agentName, message, { 
      source: "cron",
      maxTurns: entry.handlerConfig?.maxTurns ?? 30,
    });
    ctx.log(`[${entry.name}] Started ${agentName} session: ${sessionId}`);
    
    // Optionally wait for completion (configurable)
    if (entry.handlerConfig?.waitForCompletion !== false) {
      try {
        const result = await ctx.manager.waitFor(sessionId);
        ctx.log(`[${entry.name}] ${agentName} completed: ${result.status}`);
      } catch (err) {
        ctx.log(`[${entry.name}] ${agentName} failed: ${err}`);
      }
    }
  };
};
```

Then change cron.json entries:
```json
{
  "name": "analyze-failures",
  "type": "job",
  "handler": "run-agent-task",
  "agent": "bob",
  "intervalMs": 86400000,
  "message": "[cron:analyze-failures] Analyze the last 10 evaluations...",
  "handlerConfig": { "maxTurns": 30, "waitForCompletion": true }
}
```

**Benefit**: All 5 broken jobs immediately start working. No external process spawning needed. Full SubagentManager integration (progress, cancel, evaluate).

### 3.2: On-demand triggering

Add a `trigger` action to the cron tool (or a separate mechanism):

```typescript
// In cron-tool.ts or as a new action on subagents tool
case "trigger": {
  const agentName = params.agent;
  const task = params.task;
  const sessionId = manager.run(agentName, task, { source: "trigger" });
  return { sessionId, agent: agentName };
}
```

Wait — this is literally what `subagents.run()` already does! The "trigger" concept in my earlier design was about spawning a separate process. But if we standardize on in-process, `subagents.run()` IS the trigger mechanism.

The real gap is: **May can already do `subagents.run("bob", task)` at any time.** The problem is discoverability and convention, not missing functionality.

**Verdict**: No new trigger mechanism needed. Just document that `subagents.run()` is the way to dispatch work immediately.

### 3.3: Session budgets (future, if memory becomes an issue)

Add to agent.json:
```json
{
  "maxConcurrentSessions": 2,
  "maxTotalContextTokens": 500000
}
```

SubagentManager enforces: if bob has 2 running sessions and a 3rd is requested, either queue it or reject it.

**Status**: Not urgent. The watchdog already handles runaway sessions. But good to design now.

### 3.4: Replace persistent heartbeat sessions with ephemeral ones

Current: Each heartbeat creates a persistent session that lives forever, accumulating history.

Proposed: Each heartbeat creates a fresh ephemeral session. Context continuity comes from the agent reading its own files (SOUL.md, heartbeat.md, workspace/*) — which they already do.

**Why**: 
- Persistent sessions are a memory leak mechanism
- Agents already read their files on each heartbeat anyway
- Compaction loses context quality over time
- Fresh sessions are more predictable

**How**: Change `fireHeartbeat` to use `manager.run()` without `persistent: true`. Track via `waitFor()` instead of `followUp()`.

```typescript
private fireHeartbeat(entry: CronEntry): void {
  const agentName = entry.agent || "may";
  const heartbeatKey = `heartbeat:${agentName}`;

  if (this.heartbeatRunning.has(heartbeatKey)) { /* skip */ return; }

  this.heartbeatRunning.add(heartbeatKey);
  const sessionId = this.manager.run(agentName, entry.message, { source: "heartbeat" });
  
  this.manager.waitForIdle(sessionId).then(() => {
    this.heartbeatRunning.delete(heartbeatKey);
    // record success
  }).catch(() => {
    this.heartbeatRunning.delete(heartbeatKey);
    // record failure
  });
}
```

**Trade-off**: Loses conversation continuity across heartbeats. But agents already have file-based memory, so this is fine.

---

## 4. Architecture After Changes

```
┌─────────────────────────────────────────────────────┐
│                    Node.js Process                    │
│                                                       │
│  ┌─────────┐   ┌──────────────────────────────────┐  │
│  │ May      │   │ SubagentManager                  │  │
│  │ (persist │   │                                  │  │
│  │  session)│   │  Active Sessions:                │  │
│  │          ├──▶│  - bob-session-1 (from cron)     │  │
│  │          │   │  - amy-session-2 (from trigger)  │  │
│  │          │   │  - optimizer-hb-3 (heartbeat)    │  │
│  │          │   │  - scout-drain-4 (drain-todo)    │  │
│  └─────────┘   └──────────────────────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │ CronScheduler                                    │  │
│  │  Timers fire → all paths go through Manager:     │  │
│  │  - heartbeat → manager.run() (ephemeral)         │  │
│  │  - handler   → handler() → manager.run/followUp  │  │
│  │  - job       → handler  (run-agent-task generic)  │  │
│  │  [fireTask subprocess path: REMOVED]              │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Watchdog (10min)                                 │  │
│  │  Cancels sessions running > 30min                │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ Socket UI  │  │ Telegram   │  │ Console UI     │  │
│  └────────────┘  └────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Job Type Simplification

**Before**: 4 execution paths
- heartbeat → `fireHeartbeat()` (persistent session + followUp)
- job+handler → `fireHandler()` (in-process JS function)
- job (no handler) → `fireTask()` (subprocess, BROKEN)
- legacy → `fireLegacyFollowUp()` (followUp into May's session)

**After**: 2 execution paths
- heartbeat → `fireHeartbeat()` (ephemeral session, no persistent)
- job → `fireHandler()` (all jobs have handlers; generic `run-agent-task` covers what `fireTask` did)
- [fireTask: removed]
- [legacy: removed or migrated]

---

## 5. Implementation Plan

### Phase 1: Fix broken jobs (HIGH PRIORITY)
1. Create `agents/may/handlers/run-agent-task.ts` — generic handler that calls `manager.run()`
2. Add `"handler": "run-agent-task"` to all 5 broken cron entries
3. Remove or deprecate `fireTask()` path in `cron.ts`
4. **Estimated effort**: Small — 1 new handler file + cron.json edits

### Phase 2: Simplify heartbeats (MEDIUM PRIORITY)
1. Change `fireHeartbeat()` to use ephemeral sessions
2. Remove `heartbeatSessions` Map and persistent session management
3. Verify agents don't depend on cross-heartbeat conversation continuity
4. **Estimated effort**: Small — modify ~40 lines in `cron.ts`

### Phase 3: Clean up (LOW PRIORITY)
1. Remove `fireLegacyFollowUp()` (no entries use it)
2. Remove `fireTask()` entirely
3. Simplify `resolveMode()` to just heartbeat/handler
4. Update docs
5. **Estimated effort**: Small — cleanup only

### Phase 4: Session budgets (FUTURE)
1. Design maxConcurrentSessions in agent.json
2. Implement queueing or rejection in SubagentManager.run()
3. Add metrics/observability

---

## 6. What We're NOT Doing (And Why)

### NOT: Multi-process architecture
Spawning each agent as a separate OS process would give true isolation but adds enormous complexity:
- Process lifecycle management
- IPC for progress/steer/cancel
- Session state synchronization
- Resource management
- Debugging becomes much harder

The in-process model is good enough for now. The watchdog handles runaway sessions. If we hit real memory limits, we can explore this later.

### NOT: Socket-based agent triggering
The `cron-task.sh` approach (send commands via Unix socket) is clever but adds a layer of indirection. The socket is for external tools (humans, CI) to interact with May. Agent-to-agent delegation should stay in-process via SubagentManager.

### NOT: Persistent heartbeat sessions
The memory cost and complexity don't justify the continuity benefit, especially since agents already have file-based memory.

---

## 7. Decision Summary

| Decision | Rationale |
|---|---|
| Keep SubagentManager as single delegation mechanism | Already works, full lifecycle management |
| Convert broken `fireTask` jobs to handlers | Simplest fix, reuses existing infrastructure |
| Make heartbeats ephemeral | Reduce memory pressure, simplify code |
| Don't add new "trigger" tool | `subagents.run()` already does this |
| Don't move to multi-process | Premature complexity; watchdog handles safety |
| Remove `fireTask` code path | Dead code in Docker; handlers are strictly better |
