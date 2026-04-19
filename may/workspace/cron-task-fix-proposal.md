# Proposal: Fix Cron Task Jobs — Dedicated Instance vs Sub-Agent

## Status: Draft (2025-03-07)

---

## 1. Understanding the Architecture

### Three Execution Models

**A. Dedicated Instance (what `fireTask` was supposed to do)**
- Spawns a **separate `may.ts` process**: `AGENT=bob INSTANCE=job-analyze-failures npx tsx run/may.ts --task "..."`
- Gets its own PID, socket, identity.json under `.state/instances/job-analyze-failures/`
- Full agent runtime: agent has all its tools, can delegate to sub-agents, has its own event loop
- True process isolation — crash doesn't affect main May
- Survives main May restarts (detached)
- **Broken**: `fireTask()` calls `may.sh task` which doesn't exist in Docker

**B. Sub-Agent (what `run-agent-task.ts` handler does)**
- `manager.run("bob", task)` inside the main May process
- Shares Node.js process, event loop, memory with May + all other sessions
- Dies if main process crashes
- No isolation — OOM in bob kills everything
- BUT: rich lifecycle management (progress, steer, cancel, evaluate, result)

**C. Socket Command (what `cron-task.sh` does)**
- Sends `{"type":"run", "agent":"bob", "message":"..."}` to main May's socket
- Socket handler calls `bus.command()` → `runDirect()` → `manager.run()` in-process
- This is **just System B with extra steps** — ultimately creates an in-process sub-agent
- No isolation benefit over direct `manager.run()`

### The Design Intent Was System A

The cron system was designed with **dedicated instances** in mind:
- `fireTask()` spawns a detached child process
- `INSTANCE=job-<name>` gives each job its own identity
- `.state/instances/job-<name>/identity.json` tracks the process
- The process gets its own socket at `.state/instances/job-<name>/<agent>.sock`
- `may.ts` already supports `--task` mode (ephemeral: run task, exit)
- The watchdog/monitoring can check identity.json for status

### The `bus.command("run")` Flow

```
External → socat → socket.ts
  → bus.command({type:"run", agent, message})
  → may.ts onCommand handler
  → runDirect(agent, message)
  → manager.run(agent, message)  ← in-process sub-agent
  → manager.waitFor(sessionId)   ← non-blocking completion tracking
```

This is the "tell the running instance to do something" pattern. Useful for external integration (Telegram, CLI tools, monitoring dashboards), but for cron jobs it adds indirection without adding isolation.

---

## 2. The Real Question: What Do We Want?

### Option 1: Fix `fireTask` to Spawn Dedicated Instances Properly

**What**: Replace `may.sh task` call with direct `spawn(process.execPath, [..., "run/may.ts", "--task", msg], { env: { AGENT: agent, INSTANCE: "job-"+name } })` — the same pattern `launcher.ts` uses.

**Pros**:
- True process isolation (the original design intent)
- Survives main May restarts
- Each job gets its own memory space
- A runaway bob session can't OOM the main May process
- `may.ts --task` mode already works perfectly

**Cons**:
- No lifecycle management from main May (can't steer, can't get result content)
- Each process loads all agents, models, etc. (memory overhead ~100-200MB each)
- No evaluation integration (evaluator runs in main process)
- Monitoring limited to: check identity.json, connect to socket

**Best for**: Long-running, resource-heavy tasks where isolation matters

### Option 2: Keep Handler Approach (In-Process Sub-Agent)

**What**: The `run-agent-task.ts` handler I already created — calls `manager.run()` in-process.

**Pros**:
- Rich lifecycle (progress, steer, cancel, evaluate, result)
- No extra process overhead
- Evaluation pipeline integration
- Already works (I already built it)

**Cons**:
- Single process, single point of failure
- Memory pressure with many concurrent sessions
- No isolation

**Best for**: Quick tasks where lifecycle management and evaluation matter

### Option 3: Hybrid — Fix `fireTask` for Dedicated Instance + Use `bus.command("run")` for Monitoring

**What**: 
1. Fix `fireTask` to spawn dedicated `may.ts` processes directly (no `may.sh`)
2. After spawning, connect to the new instance's socket for monitoring
3. Use `bus.command("run")` pattern only for external triggers, not for cron

This is basically "fix System A properly" without conflating it with System B.

---

## 3. Recommendation: Option 1 — Fix Dedicated Instance Spawning

The original design intent was right. Here's why:

### Why Not In-Process?

The cron jobs in question are:
- `analyze-failures` → bob, every 24h, reviews 10 evaluations
- `optimize` → optimizer, every 12h, runs optimization
- `health-check` → coach, every 8h, comprehensive health review
- `coaching` → coach, every 12h, picks an agent to coach
- `lesson-consolidation` → coach, every 8h, consolidates insights

These are **heavyweight, long-running tasks**. They shouldn't compete with May's interactive session for event loop time and memory. A dedicated process is the right choice.

### Why Not `bus.command`?

`bus.command("run")` sends a command to the main May instance's socket, which ends up calling `manager.run()` in-process. This gives **zero isolation benefit** — it's just the in-process sub-agent with extra network hops. It's designed for external tools talking to a running instance, not for the cron scheduler that lives inside the same process.

### Implementation

The fix is small — replace the `may.sh` spawn in `fireTask` with direct `tsx may.ts` spawn:

```typescript
private fireTask(entry: CronEntry): void {
  // ... (existing skip-if-running logic) ...

  const agentName = entry.agent || "may";
  const taskMsg = entry.message || `[cron:${entry.name}] Run your task.`;
  const instanceName = `job-${entry.name}`;

  // Spawn may.ts directly in task mode
  const proc = spawn(process.execPath, [
    ...process.execArgv.filter(/* same filter as launcher.ts */),
    resolve(this.projectRoot, "run/may.ts"),
    "--task", taskMsg,
  ], {
    cwd: this.projectRoot,
    stdio: "ignore",
    detached: true,
    env: {
      ...process.env,
      AGENT: agentName,
      INSTANCE: instanceName,
    },
  });
  proc.unref();

  // ... (existing timeout + cleanup logic stays the same) ...
}
```

### What This Gives Us

- **Isolation**: Each job runs in its own Node.js process
- **Monitoring**: Job gets identity.json + socket at `.state/instances/job-<name>/`
- **Recovery**: Detached process survives main May restart
- **Existing infrastructure**: `may.ts --task` mode, identity tracking, socket protocol all work
- **Watchdog integration**: Can check identity.json for stale jobs

### Post-Spawn Monitoring (Optional Enhancement)

After spawning, the cron system could:
1. Wait a beat, then read `.state/instances/job-<name>/identity.json` to confirm startup
2. Connect to `.state/instances/job-<name>/<agent>.sock` for progress events
3. Use the socket to send steer/cancel commands if needed

This doesn't need to be built immediately — the existing timeout + exit-code tracking is sufficient.

---

## 4. What About `cron-task.sh` and `bus.command`?

`cron-task.sh` and the socket `"run"` command are useful for **external ad-hoc triggering**:
- Human types `echo '{"type":"run","agent":"bob","message":"do X"}' | socat - .state/instances/default/may.sock`
- CI pipeline triggers a task
- Telegram bot triggers a task
- Another tool triggers a task

They should remain as-is for that purpose. But they're **not the right mechanism for cron job spawning** because they don't provide process isolation.

---

## 5. Summary

| Mechanism | Use Case | Isolation | Status |
|---|---|---|---|
| `fireTask` → spawn `may.ts --task` | Cron jobs needing dedicated process | ✅ Full | ❌ Broken (fix: replace `may.sh` with direct spawn) |
| Handler → `manager.run()` | Quick in-process tasks, lifecycle management | ❌ None | ✅ Working |
| `bus.command("run")` → socket → `runDirect` | External ad-hoc triggers | ❌ None | ✅ Working |

**Action**: Fix `fireTask` to spawn `may.ts` directly instead of via `may.sh`. This is ~15 lines of code change in `cron.ts`.
