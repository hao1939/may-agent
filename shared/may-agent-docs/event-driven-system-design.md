# Event-Driven Agent System — Design

## How It Works Today

The system is event-driven. Two event sources wake agents up:

1. **Human input** — user types a message → May wakes up (steer if running, followUp if idle)
2. **Heartbeat** — periodic timer → agent wakes up, checks state, does work

When an agent wakes, it reads context (SOUL.md, todo.md, workspace), decides what to do, optionally delegates to sub-agents. Sub-agent completions flow back via the notification system (30s drain + fs.watch) as `[task-complete]` messages → parent wakes again.

### Cron Execution Modes

| Mode | Mechanism | Use case |
|---|---|---|
| **heartbeat** | `manager.run()` in-process (attached) | Agent periodic wake-ups. Overlap protection via `heartbeatRunning` set. |
| **job** (JS handler) | Pure JS function in-process | Optimized deterministic work (watchdog, evaluate-sessions, drain-todo) |
| **job** (agent task) | `spawnDetachedAgent()` separate process (detached) | Heavy agent work that shouldn't block the main loop |

**Lifecycle:** New agent work starts as heartbeat exploration → matures into detached job → deterministic parts offload to JS handler. (P33: Explore Then Offload)

### Current Scheduled Jobs

**Heartbeats (attached):**
- May (30min), Bob (30min), Amy (12h), Scout (24h), Optimizer (24h), Coach (48h), Evaluator (24h)

**Detached agent jobs:**
- analyze-failures (Bob, 24h), optimize (Optimizer, 24h), health-check (May, 24h), coaching (Coach, 48h), lesson-consolidation (Bob, 7d)

**JS handlers:**
- watchdog (10min), evaluate-sessions (4h), system-status (4h), drain-todo (4h per agent)

---

## Design Review

Reviewed by Bob (2026-03-07): **APPROVE WITH MODIFICATIONS**. Full review: `agents/bob/workspace/event-driven-design-review.md`

Key modifications incorporated:
1. **Latch pattern** for busy agents — `triggerNow` sets `pendingTrigger` flag, re-fires after completion. Prevents lost events.
2. **Debounce** for reactive triggers — 60s cooldown prevents error → trigger → error loops.

---

## What's Missing

### 1. No reactive triggers — everything waits for timers

When `evaluate-sessions` finds a bad score, nothing happens until Coach's next heartbeat (48h). When someone writes to an agent's todo.md, it waits for drain-todo (4h) or the agent's heartbeat. The system detects problems but can't act on them quickly.

### 2. No one drives "focus tasks" to completion

The system identifies improvements (e.g., "heartbeats are too fat", "need score-reactive coaching") but they sit in todo.md files waiting for a timer to pick them up. There's no mechanism for the system to self-assign and drive work.

### 3. Patterns aren't learned into workflows

Agents repeat multi-step sequences manually (e.g., "review proposal → delegate to coder → QA → merge") but nobody systematically identifies these patterns and codifies them into workflows. We have `implement-and-review` and `test-and-fix` but they were hand-built, not discovered.

### 4. Heartbeat messages try to do everything

Each heartbeat.md is a 5-section mission briefing. Agents scatter across "audit jobs, review inputs, drain todos, reflect, explore" every cycle. But this only makes sense to fix *after* the routing and reactive triggers work — once work gets pushed to agents reactively, heartbeats can become lean wake-up checks.

---

## Design: Reactive Triggers via Immediate Heartbeat

### Core mechanism: `cron.triggerNow(entryName)`

When infrastructure detects something actionable, it **triggers the relevant agent's heartbeat immediately**.

**Busy agent handling (latch pattern):** If the agent is already running, `triggerNow` sets a `pendingTrigger` flag instead of silently dropping the event. When the agent's current run completes, the cron system checks the flag and immediately re-fires. This prevents the race condition where an event arrives after the agent reads todo.md but before it finishes — without the latch, the event would be lost until the next scheduled heartbeat.

**Debounce:** `triggerNow` enforces a minimum cooldown per entry (default 60s) to prevent error loops. If agent fails → handleCompletion triggers → agent wakes → fails again → triggers again, the debounce breaks the cycle. Callers can still write to todo.md (persisted on disk), so no events are lost — they just wait for the next scheduled heartbeat.

```typescript
/** Trigger any cron entry immediately. Latches if busy, debounces rapid fires. */
triggerNow(entryName: string): boolean {
  const entry = this.entries.find(e => e.name === entryName);
  if (!entry) return false;

  // Debounce: skip if triggered too recently (default 60s cooldown)
  const lastTrigger = this.lastTriggerTime.get(entryName) ?? 0;
  if (Date.now() - lastTrigger < this.triggerCooldownMs) return false;
  this.lastTriggerTime.set(entryName, Date.now());

  const mode = this.resolveMode(entry);
  if (mode === "heartbeat") {
    const key = `heartbeat:${entry.agent || "may"}`;
    if (this.heartbeatRunning.has(key)) {
      // Agent busy — latch for re-run after completion
      this.pendingTriggers.add(entryName);
      return true;  // event is latched, not lost
    }
    this.fireHeartbeat(entry);
  }
  else if (mode === "job-handler") this.fireHandler(entry);
  else if (mode === "job-detached") this.fireDetachedJob(entry);
  return true;
}
```

The regular timer continues running — `triggerNow` is an extra fire. The latch ensures busy agents don't miss events. The debounce prevents runaway loops.

### Wiring reactive triggers

JS handlers and infrastructure call `triggerNow()` when they detect actionable events:

| Trigger source | Event | Action |
|---|---|---|
| `evaluate-sessions` | Agent scores below threshold | `triggerNow("heartbeat-coach")` |
| `evaluate-sessions` | Systemic failure pattern | Write to bob's todo.md + `triggerNow("heartbeat-bob")` |
| `drain-todo` | After writing task to agent | `triggerNow("heartbeat-{agent}")` |
| `handleCompletion` | Task completes with error | `triggerNow("heartbeat")` (wake May) |
| `system-status` | Anomaly detected | Write to may's todo.md + `triggerNow("heartbeat")` |

**Pattern:** detect → write to todo.md → trigger heartbeat. The agent wakes up, sees the todo item, works on it. If busy, it'll see the item when it finishes current work.

---

## Design: Focus Task Routing

### What is a focus task?

A system improvement identified by agents or infrastructure that needs to be driven to completion. Examples:
- "Rewrite heartbeat.md files to be leaner" (design/docs)
- "Wire score-reactive coaching trigger" (code/infra)
- "Build workflow for pattern X" (code + design)

### Routing by task type

| Task type | Owner | How it gets there |
|---|---|---|
| **Design/documentation** (SOUL.md, conventions, heartbeat.md) | **Bob** | Written to Bob's todo.md |
| **Code/infrastructure** (triggers, handlers, workflow code) | **Optimizer** | Written to Optimizer's todo.md |
| **Coordination** (wiring, delegation, agent config) | **May** | Written to May's todo.md |

### Who writes focus tasks?

Today: only humans. The system should also self-assign:

1. **evaluate-sessions** detects pattern → writes to relevant agent's todo.md
2. **Bob's analyze-failures** finds systemic issue → writes to optimizer's todo.md
3. **May** processes recurring task failures → writes to bob's todo.md
4. **system-status** detects anomaly → writes to may's todo.md

Combined with `triggerNow()`, writing to todo.md immediately wakes the target agent.

---

## Design: Pattern Recognition → Workflow Creation

### The lifecycle (P33)

```
1. Agent does something manually during heartbeat (exploration)
2. It works → agent repeats the same multi-step sequence
3. Pattern recognized → proposal written
4. Workflow built and tested
5. Agents use workflow instead of manual steps
6. Workflow matures → deterministic parts offload to JS handlers
```

### Who drives this?

**Bob identifies patterns. Optimizer builds them.**

Bob's `analyze-failures` job already reviews session transcripts. Expand its scope:
- Look for **repeated multi-step sequences** across sessions
- When found, write a workflow proposal to `agents/shared/workflow-proposals/`
- Write to Optimizer's todo.md: "Build workflow from proposal X"
- Optimizer implements via `implement-and-review` workflow

### Current workflows (for reference)
- `implement-and-review`: coder → QA → retry/escalate
- `test-and-fix`: run tests → coder fix → re-test → escalate
- `design-review`: (optimizer) design → review → implement

### Candidate patterns to watch for
- Proposal review cycle: write proposal → Bob reviews → revise → implement
- Research synthesis: Scout/Amy find signal → Bob synthesizes → action items
- Agent onboarding: create agent.json → SOUL.md → coaching sessions → graduation

---

## Design: Lean Heartbeats (Phase 3 — after routing works)

Once reactive triggers and todo routing are working, heartbeat messages can shrink:

**Current** (example — May's heartbeat.md): 5 sections, reads like a job description
**Target**: Short decision tree

```markdown
# Heartbeat — May
Check what needs attention, in priority order. Skip what's empty. Be quick.
1. Pending notifications or task-complete messages? → Process them.
2. workspace/todo.md has actionable items? → Delegate or do top item.
3. workspace/human-inputs.md has unprocessed entries? → Handle them.
4. All quiet? → Done. Don't invent work.
```

The agent's SOUL.md already contains its mission and philosophy. The heartbeat doesn't need to repeat it. This is P30 (Heartbeat Is Just a Wake-Up).

**Dependency:** This only works when focus tasks are routed to todo.md and reactive triggers wake agents. Otherwise agents need the heartbeat to tell them what to check.

---

## Implementation Plan

### Phase 1: `triggerNow()` — the keystone
- Add `triggerNow(entryName)` to Cron class with latch + debounce (~30 lines)
- Latch: `pendingTriggers` set — if agent busy, flag for re-run on completion
- Debounce: `lastTriggerTime` map — minimum 60s cooldown per entry
- Expose cron instances to JS handlers via HandlerContext
- Tests: trigger-while-idle, trigger-while-busy-then-latch, debounce-rapid-fire, trigger-unknown-entry

### Phase 2: Wire reactive triggers
- `evaluate-sessions`: bad score → write to coach todo → `triggerNow("heartbeat-coach")`
- `system-status`: anomaly → write to may todo → `triggerNow("heartbeat")`
- `handleCompletion`: error → `triggerNow("heartbeat")`
- Each is ~10-20 lines in existing handlers

### Phase 3: Lean heartbeats
- Rewrite heartbeat.md files to short decision trees
- Depends on Phase 1-2 working — agents need todo items pushed to them
- Bob drives this as a focus task (design/docs ownership)

### Phase 4: Pattern → workflow pipeline
- Add pattern recognition to Bob's `analyze-failures` scope (SOUL.md update)
- Bob writes workflow proposals → Optimizer implements
- This is ongoing — not a one-time task
