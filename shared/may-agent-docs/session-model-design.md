# Design: Session Model (Chat + Task)

## Status
**Implemented** (2026-03-07)
**Version**: 2.0

## Core Philosophy
**The filesystem is the persistence layer, not the process memory.**
We use a binary model: **Chat** (User Interface) and **Task** (Worker).

---

## 1. The Binary Model

| Feature | Chat Session | Task Session |
|---|---|---|
| **Role** | Interface to Human | Unit of Work |
| **Count** | Exactly ONE (The Interface Agent) | Unlimited |
| **Lifecycle** | Long-lived, persists across restarts | Spawn → Work → Finish → Die |
| **Idle State** | Yes (waiting for user) | No (finishes when done) |
| **Persistence** | Restored from disk on startup | None (fresh start every time) |
| **Config** | `autoClose: "never"` | `autoClose: "immediate"` |
| **Inputs** | User messages, System notifications | Initial Task Prompt only |
| **Memory** | Accumulates (with compaction) | Fresh every run |

### Chat Session (The Interface)
- **Who**: The agent defined by `AGENT=name` (default: May).
- **Purpose**: Maintain the continuous thread of "User Intent".
- **Behavior**: Starts on boot, restores from disk. Supports `followUp` for notifications.
- **Mechanism**: Uses `autoClose: "never"` to stay alive waiting for input.

### Task Session (The Workers)
- **Who**: Everyone else (Sub-agents, Cron jobs, CLI one-offs).
- **Purpose**: Execute a specific unit of work.
- **Behavior**: Spawns, runs to completion/failure, dies. No idle state.
- **Mechanism**: Uses `autoClose: "immediate"`. Valid context comes from `SOUL.md`, `todo.md`, and the task description.

---

## 2. Implementation: Unified State Machine

We eliminated the separate "Persistent" vs "Ephemeral" classes in favor of a single `ActiveSession` state machine configured by an `autoClose` policy.

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

### Auto-Close Policy
- **"immediate"** (Task): When the run loop settles (agent stops calling tools), the session automatically transitions `idle` → `archived`.
- **"never"** (Chat): When the run loop settles, the session stays `idle`, waiting for `followUp()` or user input.

### Manager Logic (`src/manager.ts`)
- **Startup**: Restores *only* the Interface Agent's session.
- **Routing**:
  - Target == Interface Agent → Route to persistent session.
  - Target != Interface Agent → Spawn fresh Task session (`autoClose: "immediate"`).
- **Cron Backpressure**: `run/cron.ts` tracks active job types. If `heartbeatRunning.has(agent)`, the cron fire is skipped.

---

## 3. Trade-offs & Mitigations

### No Conversational Context in Sub-Agents
- **Constraint**: You cannot say "Do that again" to a sub-agent. Sub-agents are workers, not partners.
- **Solution**: "Do that again" is a UI concern handled by the Chat Session, which re-issues the task command.

### No In-Memory Caching
- **Constraint**: Parsed ASTs or expensive computations in RAM are lost when the task ends.
- **Solution**: Persist valuable data to disk (e.g., `knowledge/code-map.json`).

### Token Cost (Re-reading Context)
- **Risk**: Every cron fire re-reads `SOUL.md` and system prompts.
- **Mitigation**: **Prompt Caching** (Anthropic `beta.prompt_caching`) keeps the cost of static context near-zero.

---

## 4. Philosophy Alignment
- **P1 Simplest Thing**: Drastically reduces state machine complexity (~100 lines of branching removed).
- **P11 File System as Memory**: Enforces strict state isolation. In-memory state is transient.
- **P30 Heartbeat Is Just a Wake-Up**: Fresh sessions guarantee no pollution from previous tasks.
- **P45 Agents Do Cognitive Work**: Offloads scheduling/backpressure to infra logic, not agent prompts.
