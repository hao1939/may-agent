# Design: Session Model Simplification (Chat + Task)

## Status
**Implemented** (2026-03-07)
**Version**: 2.0

## Core Philosophy
**The filesystem is the persistence layer, not the process memory.**
We have moved from a complex model (Persistent/Ephemeral/Detached/Idle) to a binary model: **Chat** (User Interface) and **Task** (Worker).

---

## 1. The Two Session Types

| Feature | Chat Session | Task Session |
|---|---|---|
| **Role** | Interface to Human | Unit of Work |
| **Count** | Exactly ONE (The Interface Agent) | Unlimited |
| **Lifecycle** | Long-lived, persists across restarts | Spawn → Work → Finish → Die |
| **Idle State** | Yes (waiting for user/system) | No (finishes when done) |
| **Persistence** | Restored from disk on startup | None (fresh start every time) |
| **Inputs** | User messages, System notifications | Initial Task Prompt only |
| **Interruption** | `followUp` (Notifications) | `cancel` (Abort only) |
| **Memory** | Accumulates (with compaction) | Fresh every run |

### Chat Session (The Interface)
- **Who**: The agent defined by `AGENT=name` (default: May).
- **Purpose**: Maintain the continuous thread of "User Intent".
- **Behavior**: Starts on boot, restores from disk, manages the user relationship. Supports `followUp` for notifications.
- **Mechanism**: `persistent: true` (set by `manager.ts` based on `AGENT` env var).

### Task Session (The Workers)
- **Who**: Everyone else (Sub-agents, Cron jobs, CLI one-offs).
- **Purpose**: Execute a specific unit of work.
- **Behavior**: Spawns, runs to completion/failure, dies. No idle state. No memory persistence in RAM.
- **Mechanism**: `persistent: false`. Valid context comes from `SOUL.md`, `todo.md`, and the task description.

---

## 2. Impact Analysis

### What We Lose (Trade-offs)

1.  **Conversational Context in Sub-Agents**
    *   *Loss*: A sub-agent cannot "remember" a previous interaction unless it wrote it to a file. You can't say "Do that again" to a sub-agent; you must resend the full task.
    *   *Verdict*: **Acceptable.** Sub-agents are workers, not partners. "Do that again" is a UI concern handled by the Chat Session (May), which can re-issue the task.

2.  **In-Memory Caching**
    *   *Loss*: Any expensive computation stored in variables (e.g., a parsed AST of the codebase) is lost when the task ends.
    *   *Verdict*: **Acceptable.** If the data is valuable, it should be on disk (e.g., `knowledge/code-map.json`). In-memory caches are fragile (lost on crash anyway).

3.  **"Steering" a Running Task**
    *   *Loss*: We remove `followUp` for task sessions. You cannot inject a message like "Stop looking at file X" into a running worker.
    *   *Verdict*: **Acceptable.** Steering is complex and rarely used. The cleaner pattern is `cancel` → `refine task` → `restart`.

### Risks & Mitigations

1.  **Token Cost (Re-reading Context)**
    *   *Risk*: Every cron fire spawns a fresh session, reading `SOUL.md`, `system-prompt`, and `tools` again.
    *   *Mitigation*: **Prompt Caching.** Anthropic `beta.prompt_caching` keeps the cost of static context near-zero. The reliability of a "clean slate" outweighs the marginal cost.

2.  **Concurrency & Backpressure**
    *   *Risk*: Without "persistent session busy" checks, multiple cron fires could stack up (e.g., `check_email` runs long, another triggers).
    *   *Mitigation*: **Cron-level Backpressure.** `run/cron.ts` tracks active job types in `heartbeatRunning`. It checks "Is there an active session for this agent?" before firing. This moves complexity from the *Agent* (session logic) to the *Scheduler* (infra logic).

---

## 3. Architecture Implementation

### Manager Logic (`src/manager.ts`)
- **Startup**: Restores *only* the Interface Agent's session.
- **Run**:
  - If target is Interface Agent → Route to persistent session.
  - Else → Spawn fresh Task session (`persistent: false`).
- **Completion**:
  - Task Session → Deliver result to caller, then destroy session.
  - Chat Session → Enter idle state, wait for input.

### Cron & Heartbeat (`run/cron.ts`)
- **Old**: "Wake up persistent session".
- **New**: **Always spawn a fresh Task session.**
  - Cron triggers `manager.run(agent, task)`.
  - Agent starts fresh, reads `SOUL.md` + `todo.md`, does work, writes `journal.md`, dies.
  - No accumulating context in memory. The "Memory" is the `todo.md` and `journal.md` files.

### Backpressure
Implemented in `run/cron.ts`:
1.  **Map**: `heartbeatRunning` Set tracks active agents.
2.  **Check**: If `heartbeatRunning.has(agent)`, skip the fire.
3.  **Log**: "Skipped — previous execution still running".

---

## 4. Migration Plan

### Completed ✅
1.  **Binary Model**: `manager.ts` distinguishes Interface vs Task agents.
2.  **Fresh Heartbeats**: `run/cron.ts` uses `manager.run()` (fresh) instead of waking sessions.
3.  **Cron Backpressure**: `run/cron.ts` implements skip logic.
4.  **No Compaction**: Cron calls no longer pass `compaction: true` (compaction is now Interface-only).

### Remaining Cleanup ⏳
1.  **Enforce Persistence Rule**: Refactor `manager.ts` to use `interfaceAgent` logic in `run()` (currently relies on `opts.persistent`).
2.  **Remove Idle Logic**: Delete `idle` state handling for non-interface agents in `manager.ts`.
3.  **FollowUp Restriction**: Hard-block `followUp()` calls to non-interface sessions.

## 5. Philosophy Alignment
- **P1 Simplest Thing**: Drastically reduces state machine complexity.
- **P11 File System as Memory**: Enforces this strictly. In-memory state is transient.
- **P30 Heartbeat Is Just a Wake-Up** / **P33 Heartbeat vs Cron**: Fresh sessions guarantee no pollution from previous tasks.
- **P45 Agents Do Cognitive Work**: Offloads scheduling/backpressure to infra.
