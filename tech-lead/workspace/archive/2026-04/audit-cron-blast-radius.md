# Cron.ts Blast Radius Audit

**File**: `src/app/cron.ts` (960 lines)
**Date**: 2026-04-11
**Session**: s_1775919250996_1476

## 1. Responsibility Map

| # | Responsibility | Lines | Functions |
|---|---|---|---|
| R1 | **Config loading & validation** | 150–181 | `load()` |
| R2 | **Config hot-reload (watchFile + poll)** | 92–148, 196–268 | `watchConfig()`, `unwatchConfig()`, `reload()` |
| R3 | **Timer lifecycle** (start/stop/stagger) | 183–201, 415–576 | `start()`, `stop()`, `startEntry()`, `computeResumeDelay()` |
| R4 | **Auto-pause state machine** (detect pause, fire probes, detect recovery, escalations, notifications) | 440–507 (in `startEntry.fire()`), 726–789 (in `fireHeartbeat.then/catch`) | Inline in `startEntry()` closure + `fireHeartbeat()` callbacks |
| R5 | **Heartbeat execution** (inject context, pending tasks, interrupted sessions, probe wrapping) | 580–801 | `fireHeartbeat()` — **221 lines**, the largest single function |
| R6 | **JS handler execution** | 805–845 | `fireHandler()` |
| R7 | **Detached process execution** (spawn, PID tracking) | 849–909 | `isProcessAlive()`, `fireDetachedJob()` |
| R8 | **Request tracking / overlap detection** | 325–411 | `isRunning()`, `isAgentHeartbeatRunning()`, `getLastFireTime()`, `getRunningPid()`, `failOrphans()` |
| R9 | **Detached task management** (clear/list running) | 912–958 | `clearDetachedTask()`, `getDetachedRunning()` |
| R10 | **Manual trigger with debounce** | 276–307 | `triggerNow()` |

## 2. Try-Catch Boundary Analysis

### Functions with full try-catch wrapping (isolated failures)

| Function | Lines | Catches | Impact of throw |
|---|---|---|---|
| `hashFileContent()` | 97–103 | Returns `""` | Config change detection fails silently — safe |
| `load()` | 155–181 | Logs error, returns old entries | Stale config — safe |
| `isRunning()` | 325–339 | Returns `false` | Overlap check fails → job fires twice — **minor blast** |
| `isAgentHeartbeatRunning()` | 342–364 | Returns `false` | Same — dual heartbeat fire — **minor blast** |
| `getLastFireTime()` | 367–377 | Returns `null` | Resume delay defaults to jitter — **safe** |
| `getRunningPid()` | 380–396 | Returns `null` | Orphan detection fails — safe-ish |
| `failOrphans()` | 399–411 | Ignored | Stale requests linger — safe |
| `isProcessAlive()` | 849–857 | Returns `false` | Dead process detected early — safe |

### Functions with PARTIAL try-catch (cascade risk)

#### `fireHeartbeat()` (lines 580–801) — **THE BIG ONE**

```
try {                           ← L605: outer try
  // F3: inject context files
  try {                         ← L611: context injection
    // read heartbeat.md
    try { ... } catch {}        ← L625: pending tasks DB query
    try { ... } catch {}        ← L652: interrupted session DB query
  } catch {}                    ← L690: entire injection is non-fatal ✓
  
  // Probe wrapping              ← L700-709: NOT in its own try-catch
  
  const sessionId = manager.run(...)  ← L712: THE critical call
  updateRequest(...)             ← L713: tracking — if THIS throws, no .then/.catch
  
  manager.waitFor(sessionId)     ← L716: returns Promise
    .then(() => {
      updateRequest(...)          ← L719: if throws, unhandled rejection
      // Probe success handling   ← L726-756: auto-pause recovery
      // Auto-complete requests   ← L758-770: injected request cleanup
      // Notify brief             ← L771-778
    })
    .catch((err) => {
      updateRequest(...)          ← L781
      // Probe failure handling   ← L786-797
    })
} catch (err) {                 ← L791: outer catch — only catches SYNC errors
  updateRequest(requestId, FAILED)
}
```

**Cascade risks in `fireHeartbeat()`:**

1. **`manager.run()` throws synchronously** (L712) → caught by outer try-catch ✓
2. **`updateRequest()` after `run()` throws** (L713) → caught by outer try-catch ✓, but `waitFor()` never called → orphaned session that runs to completion with no tracking
3. **Inside `.then()` callback**: `updateRequest()` or auto-pause recovery throws → **unhandled promise rejection**. Node won't crash (v18 default), but the request stays IN_PROGRESS forever, and auto-pause recovery notification is lost.
4. **Inside `.catch()` callback**: `updateRequest()` throws → **unhandled promise rejection**. Request stays IN_PROGRESS.

#### `startEntry()` → `fire()` closure (lines 415–535)

The `fire()` closure has **NO try-catch at all**. It's a raw closure passed to `setInterval()`:

```
const fire = () => {
  // Auto-pause check (heartbeat path) — DB queries, state checks
  //   isAgentHeartbeatRunning()    ← has its own try-catch ✓
  //   getAutoPauseState()          ← from auto-pause.ts — unclear
  //   shouldFireProbe() embedded   ← no try-catch ❌
  //   createPauseEscalation()      ← no try-catch ❌
  //   createRecoveryNotification() ← no try-catch ❌
  
  // Auto-pause check (non-heartbeat path) — also no try-catch
  //   parseAutoPauseConfig()       ← no try-catch ❌
  //   getAutoPauseState()          ← no try-catch ❌
  
  switch(mode) { ... }  // delegates to fire* functions
}
```

**If `getAutoPauseState()` or `createPauseEscalation()` throws:**
- The exception propagates out of the `fire()` closure
- `setInterval` catches it (Node behavior) but the job just... doesn't fire
- **No error is logged** (the `onError` callback is never reached)
- The interval continues — next tick will try again and likely hit the same error
- **Silent repeated failure** until the auto-pause DB state changes

#### `fireDetachedJob()` (lines 859–909)

```
try {
  const { pid } = spawnDetachedAgent(...)     ← can throw
  trackRequest(this.persistDir, {...})         ← can throw
} catch (err) {
  // Track the failed spawn attempt
  const requestId = trackRequest(...)          ← can throw AGAIN ❌
  updateRequest(requestId, FAILED)
}
```

**If `trackRequest()` throws in the catch block** → unhandled exception from within a `setInterval` callback. Same as `fire()` — silent failure.

#### `computeResumeDelay()` (lines 538–576) — **No try-catch at all**

Called from `startEntry()`. If `getLastFireTime()` or `getRunningPid()` throw (they have their own catches), fine. But if `failOrphans()` somehow throws in an unexpected way, `startEntry()` has no catch, and `start()` has no catch → **the entire cron system fails to start**.

Wait — `failOrphans()` has its own catch. Let me re-check... Yes, `failOrphans()` catches everything. And `isRunning()`, `getRunningPid()`, `getLastFireTime()` all catch. So `computeResumeDelay()` is actually safe-by-delegation. ✓

## 3. Failure Cascade Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │             cron.start()                     │
                    │  (no try-catch — trusts everything below)    │
                    └──────────────┬──────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────────────────────┐
                    │           startEntry()                       │
                    │  (no try-catch around fire() closure setup)  │
                    └──────────────┬──────────────────────────────┘
                                   │
               ┌───────────────────▼────────────────────────┐
               │              fire() closure                 │
               │         (runs in setInterval)               │
               │    ┌──── NO try-catch wrapper ────┐         │
               │    │                              │         │
               │    │  Auto-pause checks:          │         │
               │    │  - getAutoPauseState() ←─── CAN THROW │
               │    │  - createPauseEscalation()   │         │
               │    │  - createRecoveryNotif()     │         │
               │    │                              │         │
               │    │  If any throw:               │         │
               │    │  → fire() silently aborts    │         │
               │    │  → job never fires           │         │
               │    │  → no error logged           │         │
               │    │  → repeats every interval    │         │
               │    └──────────────────────────────┘         │
               │                                             │
               │    If auto-pause checks pass:               │
               │    ┌──────────────┬──────────────┐          │
               │    │              │              │          │
               │    ▼              ▼              ▼          │
               │ fireHeartbeat  fireHandler  fireDetached   │
               │ (has try)      (has try)    (has try)      │
               │                                             │
               │ BUT: .then()/.catch() callbacks have        │
               │ no inner try-catch → unhandled rejections   │
               └─────────────────────────────────────────────┘
```

### Concrete Failure Scenarios

**Scenario A: SQLite DB corruption/lock**
- `getAutoPauseState()` calls `getDb()` which calls `new Database()` → throws
- Impact: ALL heartbeat entries stop firing (they all hit the same DB)
- Duration: Permanent until restart
- Visibility: **None** — no error log
- Blast radius: **All 8 agents go silent**

**Scenario B: auto-pause.ts has a bug**
- `parseAutoPauseConfig()` returns malformed config → `getAutoPauseState()` throws
- Impact: Same as A — all heartbeats fail silently
- Blast radius: **All 8 agents go silent**

**Scenario C: `updateRequest()` throws inside `.then()` callback**
- Request stays IN_PROGRESS forever
- Next cron tick sees it as still running → skips
- Impact: That agent's heartbeat never fires again
- Duration: Permanent (until manual DB fix or restart with orphan cleanup)
- Blast radius: **Single agent permanently stuck**

**Scenario D: `manager.run()` throws synchronously**  
- Caught by outer try-catch ✓
- Request marked FAILED ✓
- Next tick fires normally ✓
- Blast radius: **Single tick, self-healing** ✓

## 4. Test Coverage Gap Analysis

### What's tested (34 tests in cron.test.ts)
- ✅ Config loading, validation, invalid entries
- ✅ Disabled entries skipped
- ✅ Start/stop lifecycle
- ✅ Reload with config changes
- ✅ All three execution modes (heartbeat, handler, detached)
- ✅ Request tracking on success/failure
- ✅ Overlap protection (skip if running)
- ✅ triggerNow with debounce/force
- ✅ Initial jitter cap
- ✅ Mode resolution priority

### What's NOT tested
- ❌ **Auto-pause state machine in `fire()` closure** — zero tests for the 70-line auto-pause block inside `startEntry`
- ❌ **Probe firing** — `fireHeartbeat()` with `probe: true` path untested
- ❌ **Probe success → recovery notification** — the `.then()` probe branch
- ❌ **Probe failure → backoff tracking** — the `.catch()` probe branch
- ❌ **Context injection in fireHeartbeat** — heartbeat.md loading, pending task injection, interrupted session injection (60+ lines)
- ❌ **`computeResumeDelay()`** — resume-after-restart behavior with various last-fire-time states
- ❌ **Config hot-reload via watchFile/poll** — `watchConfig()` never tested
- ❌ **`clearDetachedTask()`** — the external API for detached job completion
- ❌ **`getDetachedRunning()`** — the status query API
- ❌ **Failure in `.then()`/`.catch()` callbacks** — unhandled rejection scenarios
- ❌ **Non-heartbeat auto-pause** (lines 498–507) — agent jobs that aren't heartbeats
- ❌ **`notifyBrief`** — the Telegram brief feature in heartbeat completion

### Coverage by line count
- Tested responsibilities: ~400 lines (R1, R2-partial, R3-partial, R6, R7-partial, R8, R10)
- Untested responsibilities: ~560 lines (R4 entirely, R5 mostly, R7-partial, R9)
- **Estimated line coverage: ~42%**

The auto-pause state machine (R4) is the system's most critical safety mechanism and has **zero direct test coverage** in `cron.test.ts`. The `auto-pause-recovery.test.ts` (443 lines) tests the library functions in `auto-pause.ts` but NOT their integration into the cron fire loop.

## 5. The Auto-Pause Interleaving Problem

The auto-pause logic is **deeply interleaved** with the scheduling logic in the `fire()` closure (lines 421–507). Here's the actual structure:

```typescript
const fire = () => {
  if (mode === "heartbeat") {
    if (isAgentHeartbeatRunning(agentName)) return;     // scheduling concern
    const apConfig = parseAutoPauseConfig(...);          // auto-pause concern
    const apState = getAutoPauseState(...);              // auto-pause concern
    if (apState.state === "auto-paused") {               // auto-pause concern
      if (apState.probeDue) {                            // auto-pause concern
        this.fireHeartbeat(entry, { probe: true });      // scheduling concern
        return;
      }
      // 15 lines of escalation/notification logic       // auto-pause concern
      return;
    }
    if (apState.state === "probing") return;             // auto-pause concern
    if (this.autoPauseActive.has(agentName)) {           // auto-pause concern
      // 10 lines of recovery notification               // auto-pause concern
    }
  } else if (mode === "job-detached") {
    // 10 lines of PID/orphan management                 // scheduling concern
  } else {
    if (this.isRunning(entry.name)) return;              // scheduling concern
  }
  
  if (mode !== "heartbeat" && entry.agent) {             // auto-pause concern
    // 5 more lines of auto-pause for non-heartbeat      // auto-pause concern
  }
  
  switch (mode) { ... }                                  // scheduling concern
}
```

**This is untestable** in its current form because:
1. The auto-pause logic depends on `this.autoPauseEscalated` and `this.autoPauseActive` (class-level state with no getter/reset)
2. `getAutoPauseState()` reads from SQLite — mocked away in tests, so the state machine is effectively stubbed out
3. The probe/recovery notifications require a real DB + real session history to exercise
4. There's no way to test "what happens when `getAutoPauseState` throws" because the entire `fire()` closure is private

## 6. Recommendation: Split, with specific seams

### Verdict: **Split** — but surgically, not a rewrite.

The file has a clear natural seam. Three extractions would eliminate the god-file problem:

### Extraction 1: `CronAutoPause` class → `src/app/cron-auto-pause.ts`

**What moves**: 
- The `fire()` closure's auto-pause blocks (lines 428–507)
- The `autoPauseEscalated` and `autoPauseActive` state (lines 68–70)
- The probe handling in `fireHeartbeat` callbacks (lines 726–797)

**Interface**:
```typescript
class CronAutoPause {
  shouldFire(agentName: string, entry: CronEntry): 
    { action: 'fire' } | { action: 'fire-probe', apState, apConfig } | { action: 'skip', reason: string }
  
  onProbeSuccess(agentName: string): void
  onProbeFailure(agentName: string): void
  onNormalSuccess(agentName: string): void  // check recovery
}
```

**Why**: This is the highest-blast-radius code with zero test coverage. Extracting it makes it directly testable without mocking the entire Cron class. The `shouldFire()` method can have a simple try-catch wrapper in `fire()` that defaults to `{ action: 'fire' }` on error — eliminating Scenario A.

**Estimated effort**: ~2 hours. 150 lines move out, Cron drops to ~810 lines.

### Extraction 2: Heartbeat context injection → `src/app/cron-heartbeat-context.ts`

**What moves**: Lines 609–698 of `fireHeartbeat()` — the heartbeat.md reading, pending task injection, interrupted session injection.

**Interface**:
```typescript
function buildHeartbeatContext(
  projectRoot: string, persistDir: string, 
  agentName: string, entry: CronEntry
): { taskMessage: string; injectedRequestIds: string[] }
```

**Why**: This is 90 lines of pure data assembly with no scheduling logic. Already has its own try-catches internally. Easy extraction.

**Estimated effort**: ~1 hour. 90 lines move out, Cron drops to ~720 lines.

### Extraction 3 (optional): Request state queries → keep as-is

The `isRunning()`, `isAgentHeartbeatRunning()`, `getLastFireTime()`, etc. functions (lines 325–411) are simple, well-isolated, and already have proper try-catch boundaries. They could move to a `CronState` helper but the benefit is marginal. Leave them.

### Post-split state
- `cron.ts`: ~720 lines — timer lifecycle, mode resolution, fire dispatch
- `cron-auto-pause.ts`: ~150 lines — testable state machine
- `cron-heartbeat-context.ts`: ~90 lines — pure data assembly

### Priority
**Extraction 1 is urgent.** The auto-pause code is the system's circuit breaker for runaway agents. It has zero tests and can silently disable all agents if it throws. The blast radius is maximum and the fix is surgical.

Extraction 2 is nice-to-have — it reduces `fireHeartbeat()` from 221 lines to ~130, but the code already has proper error boundaries.

### Quick Win (before any split)
Wrap the `fire()` closure body in a try-catch:

```typescript
const fire = () => {
  try {
    // ... existing body ...
  } catch (err) {
    this.onError?.(`Cron "${entry.name}" fire() failed: ${err}`);
  }
};
```

This single change eliminates **Scenario A** (silent total failure) with zero risk. 5-minute change.
