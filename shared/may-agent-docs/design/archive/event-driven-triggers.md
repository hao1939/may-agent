# Event-Driven Agent System — Design

## How It Works Today

The system is event-driven. Two event sources wake agents:

1. **Human input** — user types a message → ChatSession routes to persistent session (steer if running, wake via `manager.input()` if idle)
2. **Heartbeat** — periodic timer → `heartbeat-precheck` checks if agent is busy → if not, `manager.run()` creates a fresh `kind: "job"` session → agent reads SOUL.md, heartbeat.md, workspace, decides what to do

When an agent delegates via `agents.call`, it blocks until the child completes and returns a `TaskResult`. When it uses `agents.send`, it writes to the target's `workspace/todo.md` and triggers their heartbeat.

### Cron Execution Modes

| Mode | Mechanism | Use case |
|---|---|---|
| **heartbeat** | `manager.run()` in-process, gated by `heartbeat-precheck` | Agent periodic wake-ups |
| **job** (JS handler) | Pure JS function in-process | Optimized deterministic work (watchdog, evaluate-sessions) |
| **job** (agent task) | `spawnDetachedAgent()` separate process via `run-agent-task` | Heavy agent work that shouldn't block main loop |

**Lifecycle:** New agent work starts as heartbeat exploration → matures into cron job → deterministic parts offload to JS handler. (P33: Explore Then Offload)

### Current Scheduled Jobs

**Heartbeats (all gated by `heartbeat-precheck`):**
- May (20min), Bob (20min), Optimizer (20min), Coach (20min), Evaluator (20min), Tech-Lead (20min), Amy (30min), Scout (30min)

**Detached agent jobs (via `run-agent-task`):**
- analyze-failures (Bob, 24h), optimize (Optimizer, 24h), lesson-consolidation (Bob, 7d), focus-task-driver (Bob, 1h)

**JS handlers:**
- watchdog (10min), evaluate-sessions (30min), system-status (4h), daily-brief (24h), coaching-report (24h)

*Source: `agents/may/cron.json` (last verified 2026-03-12)*

---

## Design: Reactive Triggers via Immediate Heartbeat

### Core mechanism: `cron.triggerNow(entryName)` — ✅ IMPLEMENTED

When infrastructure detects something actionable, it triggers the relevant agent's heartbeat immediately.

**Busy agent handling (latch pattern):** If the agent is already running, `triggerNow` sets a `pendingTrigger` flag. When the agent's current run completes, the cron system re-fires. Prevents lost events.

**Debounce:** `triggerNow` enforces a minimum cooldown per entry (default 60s) to prevent error loops. Events are persisted to disk (todo.md), so no data is lost — items wait for the next scheduled heartbeat.

Implementation: `src/app/cron.ts` — `triggerNow()` with `heartbeatRunning` set, `pendingTriggers` set, and `lastTriggerTime` map.

### Wiring reactive triggers — ⚠️ PARTIALLY IMPLEMENTED

| Trigger source | Event | Action | Status |
|---|---|---|---|
| `agents.send` | Task written to todo.md | `triggerHeartbeat(agent)` | ✅ Implemented (via agent-loader callback) |
| `evaluate-sessions` | Agent scores below threshold | `triggerNow("heartbeat-coach")` | 🔮 Not wired |
| `evaluate-sessions` | Systemic failure pattern | Write to bob's todo + `triggerNow("heartbeat-bob")` | 🔮 Not wired |
| `handleCompletion` | Task completes with error | `triggerNow("heartbeat")` (wake May) | 🔮 Not wired |
| `system-status` | Anomaly detected | Write to may's todo + `triggerNow("heartbeat")` | 🔮 Not wired |

**Pattern:** detect → write to todo.md → trigger heartbeat. The agent wakes, sees the todo item, works on it. If busy, the latch ensures it fires after current work completes.

The `agents.send` → `triggerHeartbeat` path works end-to-end. The infrastructure-to-agent reactive paths are still missing.

---

## Design: Focus Task Routing

### What is a focus task?

A system improvement identified by agents or infrastructure that needs to be driven to completion. Currently tracked in `agents/shared/focus-tasks.md`.

### Routing by task type

| Task type | Owner | How it gets there |
|---|---|---|
| **Design/documentation** | **Bob** | Written to Bob's todo.md or via `agents.send` |
| **Code/infrastructure** | **Optimizer** | Written to Optimizer's todo.md or via `agents.send` |
| **Coordination** | **May** | Written to May's todo.md or via `agents.send` |

### Who writes focus tasks?

Currently: humans and Bob's analyze-failures job. The system should also self-assign:
1. `evaluate-sessions` detects pattern → writes to relevant agent's todo.md
2. Bob's `analyze-failures` finds systemic issue → writes to optimizer's todo.md
3. `system-status` detects anomaly → writes to may's todo.md

Combined with `triggerNow()`, writing to todo.md immediately wakes the target agent.

**Current implementation**: `focus-task-driver` cron job (Bob, 1h) reads `agents/shared/focus-tasks.md` and works on the most important item. This is a simpler alternative to the per-agent routing described above.

---

## Design: Pattern Recognition → Workflow Creation — 🔮 NOT IMPLEMENTED

### The lifecycle (P33)

```
1. Agent does something manually during heartbeat
2. It works → agent repeats the same multi-step sequence
3. Pattern recognized → proposal written
4. Workflow built and tested
5. Agents use workflow instead of manual steps
6. Workflow matures → deterministic parts offload to JS handlers
```

This is the long-term vision. Currently, workflows are hand-built (implement-and-review, test-and-fix, design-review, safe-edit, enhance-cron). No automated pattern recognition exists.

### Current workflows (for reference)
- `implement-and-review`: coder → QA → retry/escalate
- `test-and-fix`: run tests → coder fix → re-test → escalate
- `design-review`: design → review → implement
- `safe-edit`: read → backup → edit → verify
- `enhance-cron`: propose → review → implement cron change

---

## Design: Lean Heartbeats — 🔮 NOT IMPLEMENTED (depends on reactive triggers)

Once reactive triggers and todo routing are working, heartbeat messages can shrink:

**Current**: Multi-section mission briefing (audit, reflect, explore, decide)
**Target**: Short decision tree

```markdown
# Heartbeat — May
Check what needs attention, in priority order. Skip what's empty. Be quick.
1. Pending notifications? → Process them.
2. workspace/todo.md has actionable items? → Delegate or do top item.
3. All quiet? → Done. Don't invent work.
```

**Dependency:** This only works when focus tasks are pushed to todo.md reactively and `triggerNow` wakes agents. Otherwise agents need the heartbeat to tell them what to check.

---

## Implementation Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | `triggerNow()` with latch + debounce | ✅ Implemented |
| Phase 2 | Wire reactive triggers (evaluate→coach, status→may, etc.) | ⚠️ Only `agents.send` → `triggerHeartbeat` |
| Phase 3 | Lean heartbeats (short decision trees) | 🔮 Not implemented |
| Phase 4 | Pattern recognition → workflow creation | 🔮 Not implemented |
