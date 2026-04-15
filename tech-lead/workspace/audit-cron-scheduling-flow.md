# Audit: Cron Scheduling Decision Flow

**Date**: 2026-04-15  
**Lens**: B — Cron scheduling decision flow complexity  
**Files**: `src/app/cron.ts`, `src/lib/manager.ts`, `src/lib/auto-pause.ts`, `agents/may/cron.json`

---

## 1. End-to-End Flow: Timer Tick → Agent Session Created

### Layer Count: **6 decision layers** from timer tick to session creation

```
Timer tick (setInterval fire())
  │
  ├─ L1: Mode resolution (resolveMode)
  │    → heartbeat | job-handler | job-detached | null (skip)
  │
  ├─ L2: Overlap guard (per-mode)
  │    → heartbeat: isAgentHeartbeatRunning() — checks ALL heartbeat entries for that agent
  │    → job-handler: isRunning() — checks artifact name in requests table
  │    → job-detached: getRunningPid() + isProcessAlive() + failOrphans()
  │
  ├─ L3: Auto-pause state machine (heartbeat-only, ~60 lines)
  │    → getAutoPauseState() checks recent error streaks
  │    → States: running | auto-paused | probing
  │    → Sub-decisions: is probe due? escalation created? recovery detected?
  │
  ├─ L4: Auto-pause for non-heartbeat agents (separate block, ~10 lines)
  │    → Same state machine but without probe handling
  │
  ├─ L5: fire*() method (fireHeartbeat / fireHandler / fireDetachedJob)
  │    → fireHeartbeat: trackRequest → context injection → manager.run()
  │    → fireHandler: trackRequest → handler()
  │    → fireDetachedJob: spawnDetachedAgent()
  │
  └─ L6: manager.run() — agent construction + session setup
       → createAgent() → resolveSystemPrompt() → buildSessionContext()
       → runAgentWithRetry() → agent.prompt()
```

## 2. How the System Decides Which Agents Run Each Tick

**Answer: It doesn't decide. There is no centralized scheduler.**

Each cron entry has its own independent `setInterval` timer. The "scheduling" is emergent from:

1. **Static config** (`cron.json`): each entry has `intervalMs`, `enabled`, and optional `offsetMs`
2. **Independent timers**: `startEntry()` creates a `setTimeout` → `setInterval` chain per entry
3. **Overlap guards**: if an agent's previous session is still running, the tick is skipped
4. **Auto-pause**: if an agent has N consecutive errors, it's paused with exponential probe-back

**There is no priority queue, no round-robin, no "which agent goes next" logic.**

All agents with `enabled: true` fire on their own interval. The only coordination is:
- `offsetMs` for staggering (e.g., heartbeat-bob has `offsetMs: 420000` = 7min delay)
- Initial jitter for entries without `offsetMs` (random 0–5min delay on first start)
- `computeResumeDelay()` persists last-fire time in DB so restarts don't trigger all entries at once

## 3. Priority Ordering Between Agents

**There is no priority system.** All cron entries are peers. Observations:

- All 8 heartbeats share the same `intervalMs: 1800000` (30min)
- Staggering via `offsetMs` creates a loose sequence: coach(3min) → tech-lead(10min) → bob(7min) → optimizer(14min) → scout(21min) → qa(28min) → evaluator(none) → may(none)
- But this is purely for load spreading, not priority
- No entry can preempt another
- No entry is aware of what other entries are doing (except via the DB overlap check)

**Implicit priority exists only through `offsetMs` ordering** — whoever fires first in a cycle gets first access to compute. But there's no enforcement if timers drift.

## 4. How Concurrency Limits Are Enforced

**Per-agent overlap guard only. No global concurrency limit.**

The overlap check is in `fire()` inside `startEntry()`:

| Mode | Check | Scope |
|------|-------|-------|
| heartbeat | `isAgentHeartbeatRunning(agentName)` | All heartbeat entries for that agent |
| job-handler | `isRunning(entryName)` | Just this specific entry |
| job-detached | `getRunningPid()` + `isProcessAlive()` | Just this specific entry's PID |

**What's NOT limited:**
- Total concurrent heartbeat sessions across all agents (all 8 can run simultaneously)
- Total concurrent sessions of any kind (heartbeats + delegated work + human-triggered)
- Memory/CPU usage
- API rate limits (no gate at the cron level, though `apiGate` exists in manager)

## 5. Implicit Scheduling Decisions Hidden in Conditional Logic

### 5a. Auto-pause as implicit scheduling (~100 lines in `fire()`)

The auto-pause state machine is the largest implicit scheduling decision. Buried in the heartbeat branch of `fire()`:

```
if agent has N consecutive errors:
  → don't fire normal heartbeat
  → instead fire a "probe" session on exponential backoff
  → if probe succeeds → resume normal scheduling
  → if probe fails → extend backoff
```

This means a malfunctioning agent doesn't just stop — it enters a complex retry state machine with:
- Escalation creation (one-time per pause)
- Recovery detection (compares in-memory `autoPauseActive` map vs current state)
- Probe counting with backoff multiplier

**Concern**: This state machine is inline in `fire()` rather than extracted. The `fire()` closure is ~80 lines and handles 3 modes + auto-pause + overlap + notifications.

### 5b. `computeResumeDelay()` as startup scheduling

On server restart, `computeResumeDelay()` determines when each entry first fires:
- If never ran → `offsetMs` or random jitter (0–5min)
- If ran recently → remaining time until next interval
- If overdue → fire immediately (delay = 0)
- If detached process still alive → normal schedule from last fire

This is correct but implicit — there's no central "startup schedule" view.

### 5c. `triggerNow()` bypasses all scheduling

Manual triggers (`triggerNow()`) skip the overlap check entirely. The only guard is a debounce (75% of interval, min 60s). This means manual triggers can create concurrent sessions for the same agent that the normal scheduling would prevent.

### 5d. Turn budget is a hidden throttle

`TURN_BUDGET_TIERS.heartbeat = 8` (soft limit) + `TURN_BUDGET_GRACE = 2` (hard kill at 10).
This isn't a scheduling decision per se, but it limits how long each heartbeat can run, which indirectly affects when the next heartbeat can fire (via the overlap guard).

### 5e. `notifyBrief` changes completion behavior

Entries with `notifyBrief: true` have their completion handler send the agent's output to the human. This doesn't affect scheduling but adds branching to the completion path.

## 6. Complexity Assessment

### The Good
- **Simple mental model**: each entry is independent, fires on its interval
- **Robust overlap protection**: DB-backed, survives restarts
- **Smart reload**: only restarts changed entries (avoids timer-reset bugs)
- **Request tracking**: every fire creates a DB record for observability

### The Concerning
- **`fire()` is a 80-line closure** with 3 mode branches × auto-pause × overlap × notifications. This is the critical path and it's hard to test in isolation.
- **Auto-pause state is split**: DB state (`getAutoPauseState()`) + in-memory state (`autoPauseActive` Map + `autoPauseEscalated` Set). Server restart loses the in-memory part, so escalation/recovery notifications can re-fire.
- **No global concurrency awareness**: 8 heartbeats + N job entries can all fire simultaneously. The system relies on the LLM API and OS to handle the load.
- **Three overlap implementations**: heartbeat uses `isAgentHeartbeatRunning()`, handler uses `isRunning()`, detached uses `getRunningPid()` — same concept, three implementations.

### Recommendation
The scheduling flow is **functional but not easily auditable**. The `fire()` function should be decomposed:

1. Extract `checkOverlap(entry, mode): boolean` — unify the 3 overlap checks
2. Extract `checkAutoPause(entry, agentName): "fire" | "probe" | "skip"` — separate auto-pause decisions from fire logic
3. The `fire()` body should be: `if overlapping → skip; autoPause check → maybe skip/probe; dispatch(mode)`

Total lines of scheduling decision logic: **~200 lines** in `startEntry()` + `fire()` + `computeResumeDelay()`. Reasonable for the feature set, but the nesting depth (mode switch → overlap check → auto-pause state → probe decision) makes the critical path hard to follow.

---

## Summary Table

| Question | Answer |
|----------|--------|
| Who decides which agents run? | Nobody — all enabled entries run independently on their own timer |
| Priority between agents? | None. `offsetMs` staggers but doesn't prioritize |
| Concurrency limits? | Per-entry overlap only. No global limit |
| Implicit decisions? | Auto-pause state machine (~100 lines inline), resume delay on restart, triggerNow bypass |
| Layer count (tick → session)? | 6 layers |
| Total decision code? | ~200 lines in cron.ts |
