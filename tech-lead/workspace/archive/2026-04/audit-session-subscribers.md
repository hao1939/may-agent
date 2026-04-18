# Audit: Session-Subscribers Dead Weight

**Date**: 2026-04-11  
**Lens**: C (dead weight identification)  
**Focus**: Map every EventBus subscriber, identify overlapping/redundant work

## 1. Complete Subscriber Inventory

Every `bus.subscribe()` call in the system, categorized by source.

### From `session-subscribers.ts` (registered in may.ts lines 218–260)

| # | Subscriber | Events Handled | Side Effect |
|---|-----------|---------------|-------------|
| 1 | **DbWriter** | `session_start`, `session_end`, `message_created`, `cron_fired` | Writes to SQLite `sessions`, `requests`, `cron_history` tables |
| 2 | **ContextUpdater** | `session_end` | Applies `context_updates` from finish() to `agents/<name>/context.md` |
| 3 | **RequestTracker** | `session_end` | Fuzzy-matches `completed_items` against pending requests in SQLite; creates `new_items` requests |
| 4 | **DigestWriter** | `session_start`, `session_end` | Creates start/end digest entries in SQLite `session_digests` |
| 5 | **StuckDetector** | `session_start`, `session_end`, `turn_end` | Tracks consecutive error-only turns, emits `cancel` event at threshold (6 turns). Uses digest classifier to decide action. |
| 6 | **AutoResume** | `session_end` (status=interrupted only) | Schedules `manager.resumeInterrupted()` with backoff (10s, 20s). Escalates after 2 failed attempts. Uses digest classifier. |

### From `may.ts` (inline anonymous subscribers)

| # | Subscriber | Events Handled | Side Effect | Location |
|---|-----------|---------------|-------------|----------|
| 7 | **AgentLoader bookkeeping** | `session_start`, `session_end` | `setAgentSessionId()` on start, `runAgentCleanup()` on end | L358-364 |
| 8 | **Session Drop Recovery (P62)** | `session_end` (status=error only) | Two-tier recovery: digest classifier → classifyError fallback. Requeues infra errors via `manager.run()`, up to 2 attempts. | L371-433 |
| 9 | **Auto-evaluate** | `session_end` (child of task session) | Runs `evaluateTask()` after 3s delay for completed child sessions. Emits `context-learn` events. | L437-466 |
| 10 | **Escalation: blocked/failure** | `session_end` (finish status=blocked/failure) | Consults digest classifier, escalates to human (Telegram + escalations.jsonl) and creates request for May. | L472-518 |
| 11 | **Error surface** | `session_end` (status=error) | Emits an `info` log message with the error. | L520-525 |
| 12 | **Context Learning** | `context-learn` (custom event) | Extracts durable facts from session transcript via LLM or mechanical extractor, writes to `context.md`. | L583-640 |
| 13 | **Core command handler** | `input`, `steer`, `cancel`, `cancel_all`, `fork`, `reload`, `message`, `resume` | Routes commands from UI/socket/Telegram to manager methods. | L783-884 |

### From `manager.ts` (per-session agent subscriber)

| # | Subscriber | Events Handled | Side Effect | Location |
|---|-----------|---------------|-------------|----------|
| 14 | **subscribeForPersistence** | `message_end` | Appends message to `session.jsonl`, increments `turnCount` | L276-289 |

### From UI modules (not session-lifecycle — informational only)

| # | Subscriber | Source | Purpose |
|---|-----------|--------|---------|
| 15 | Console UI | `src/app/ui/console.ts` L14 | Pretty-prints events to terminal |
| 16 | Telegram UI | `src/app/ui/telegram.ts` L214 | Forwards events to Telegram chat |
| 17 | WebSocket broadcast | `src/app/ui/socket.ts` L163 | Broadcasts events to connected WebSocket clients |

### Pre-bus side effects (manager.ts handleCompletion, before session_end is emitted)

| # | Operation | Target | Location |
|---|-----------|--------|----------|
| A | `RegistryStore.updateSessionStatus()` | meta.json (filesystem) | L792 |
| B | `removeSentinel()` | Deletes `[STARTED]` file | L795 |
| C | `escalateBlockedSession()` | Creates request for parent agent + escalation digest | L809 |
| D | `upsertDigest()` for shallow_heartbeat | SQLite digests | L784 |

**Total: 17 subscribers + 4 pre-bus operations = 21 separate side effects per session lifecycle.**

## 2. Overlap Analysis

### 🔴 OVERLAP 1: Double Escalation for blocked/failure sessions

**Both fire on the same event for the same condition:**

| Path | Trigger | Action |
|------|---------|--------|
| `manager.ts:escalateBlockedSession()` (L809) | Before `session_end` emit, checks `finishParams.status === blocked/failure` | Creates `trackRequest()` to parent agent, writes escalation digest |
| `may.ts` subscriber #10 (L472-518) | After `session_end` emit, checks `finishParams.status === blocked/failure` | Consults digest classifier → `trackRequest()` to May + `escalateToHuman()` (Telegram + escalations.jsonl) |

**Result**: A blocked/failure session triggers **two** separate escalation paths:
1. Manager creates a request to the *parent agent* (if any)
2. may.ts subscriber creates a request to *May* AND sends a Telegram alert

**Is this intentional?** Partially — the manager escalates to the parent (hierarchical), while may.ts escalates to human (operational monitoring). But:
- Both write an escalation digest (`upsertDigest` trigger "escalation")
- If the parent IS May, the request is created twice (once by manager, once by subscriber)
- The may.ts subscriber re-consults the digest classifier, but the manager has already written an escalation digest — so the classifier is reading a digest that was just created 1ms ago
- **Verdict**: Overlapping but not fully redundant. The manager's escalation to parent is correct (hierarchical delegation). The may.ts subscriber should check `parentSessionId` to avoid double-escalating to May.

### 🔴 OVERLAP 2: Double Recovery for interrupted+error sessions  

**AutoResume (#6) and Session Drop Recovery (#8) both handle session failures:**

| Subscriber | Condition | Action |
|-----------|-----------|--------|
| AutoResume (#6) | `session_end` + `status=interrupted` + `opCount > 0` + `error !== "Closed"` | Resume existing session (preserves state) |
| Session Drop Recovery (#8) | `session_end` + `status=error` | Start NEW session with same task (loses state) |

**These handle different statuses** (interrupted vs error), so they don't literally overlap. But the boundary is blurry:
- An API timeout might produce `status=error` (goes to P62 recovery) or `status=interrupted` (goes to AutoResume)
- Both have their own retry counting (AutoResume: MAX_RESUME_ATTEMPTS=2, P62: MAX_RECOVERY_ATTEMPTS=2)
- Both use digest classifiers independently
- Both escalate to human when exhausted

**Verdict**: Not dead weight, but conceptually the same recovery problem split across two subscribers with duplicate retry/escalation logic. Could be merged into a single "session failure handler."

### 🟡 OVERLAP 3: Triple status persistence (from prior audit)

| Writer | Store | Trigger |
|--------|-------|---------|
| `RegistryStore.updateSessionStatus()` (pre-bus, L792) | `meta.json` (filesystem) | Direct call in handleCompletion |
| DbWriter (#1) | SQLite `sessions` table | `session_end` event |
| DigestWriter (#4) | SQLite `session_digests` table | `session_end` event |

Same finding as the persistence write path audit. Three stores, same data.

### 🟡 OVERLAP 4: ContextUpdater vs Context Learning

Both modify `agents/<name>/context.md`:

| Subscriber | Trigger | Mechanism |
|-----------|---------|-----------|
| ContextUpdater (#2) | `session_end` → `context_updates` from finish() | Mechanical: add/remove lines based on exact match |
| Context Learning (#12) | `context-learn` event (fired by Auto-evaluate #9) | LLM extraction from full transcript, or mechanical fallback |

**These are not redundant** — they serve different purposes:
- ContextUpdater: Agent explicitly requests context changes (e.g., "add: use bun not npx")
- Context Learning: System automatically discovers durable facts from transcripts

But they can conflict: Context Learning might add something that ContextUpdater later removes (or vice versa). No coordination between them.

**Verdict**: Low risk but architecturally messy. Two independent writers to the same file.

### 🟢 OVERLAP 5: Error surfacing (minor)

| Path | What it does |
|------|-------------|
| `manager.ts` L750-754 (pre-bus) | Emits `info` event: `[agentName] error message` |
| Error surface subscriber #11 (L520-525) | Emits `info` event: `[agentName] Session error: error message` |

**Both emit log messages for the same error.** The manager does it before emitting `session_end`, and subscriber #11 does it after. This produces duplicate error messages in console/Telegram.

**Verdict**: Subscriber #11 is dead weight. The manager already surfaces the error.

## 3. Dead Weight Findings

### Finding 1: Error Surface Subscriber (#11) is redundant
**Location**: `may.ts` L520-525
```typescript
bus.subscribe((event) => {
  if (event.type !== "session_end") return;
  const info = event as any;
  if (info.error && info.status === "error") {
    bus.emit({ type: "info", message: `[${info.agent}] Session ${info.status}: ${info.error}` });
  }
});
```

**Why dead**: `manager.ts` already emits `[agentName] <error>` at L750-754 before the `session_end` event. This subscriber fires 1ms later and emits a near-duplicate message. The only difference is the format: `"[agent] error"` vs `"[agent] Session error: error"`.

**Impact of removal**: One fewer duplicate log line per error session. Zero functional impact.

### Finding 2: `escalateBlockedSession()` duplicates may.ts escalation subscriber
**Location**: `manager.ts` L809, L845-880

The manager's `escalateBlockedSession` runs before `session_end` is emitted, then the may.ts subscriber (#10) runs on the same event. Both:
- Call `trackRequest()` (manager → parent agent, may.ts → May)
- Write an escalation digest
- For sessions where parent IS May, this creates duplicate requests

**Impact**: Double escalation for blocked/failure sessions when parent is May. Extra noise in request tracker.

### Finding 3: ActivityWriter is referenced but doesn't exist
**Location**: `manager.ts` L1009 comment says "Activity tracking handled by ActivityWriter subscriber"

No `ActivityWriter` class or `createActivityWriter` function exists anywhere in the codebase. The comment references dead code that was apparently removed but the comment survived.

**Impact**: Misleading comment. Zero functional impact.

### Finding 4: Digest system writes from 4+ separate locations
Digest entries (SQLite `session_digests`) are written by:

| Writer | Location | Trigger |
|--------|----------|---------|
| DigestWriter (#4) | `session-subscribers.ts` | `session_start`, `session_end` |
| StuckDetector (#5) | `session-subscribers.ts` | `stuck_detected`, `circuit_break` |
| AutoResume (#6) | `session-subscribers.ts` | `auto_resume`, `resume_exhausted` |
| manager.ts handleCompletion | `manager.ts` L784 | `shallow_heartbeat` |
| manager.ts escalateBlockedSession | `manager.ts` L855 | `escalation` |
| Session Drop Recovery (#8) | `may.ts` L415 | `recovery_requeue` |

**6 different code locations** write digests. Each calls `upsertDigest()` independently. The "digest writer subscriber" (#4) only handles start/end — all the other lifecycle digests are scattered across the codebase.

**This is not dead weight per se, but it means the DigestWriter subscriber is misleadingly named.** It handles only 2 of 8+ digest triggers. The rest are ad-hoc `upsertDigest()` calls sprinkled throughout the system.

### Finding 5: StuckDetector state leak potential
`createStuckDetector` maintains an in-memory `Map<sessionId, StuckState>`. It cleans up on `session_end`, but if a session crashes without emitting `session_end` (process dies), the map entry leaks. The map is bounded by process lifetime (restart clears it), so this is a minor issue.

## 4. Subscriber Firing Order for `session_end`

When a session completes, the following happens in order:

```
handleCompletion() in manager.ts:
  1. detectErrors() + clearPostFinishErrors() + detectShallowHeartbeat()  
  2. determineOutcome()
  3. RegistryStore.updateSessionStatus() → writes meta.json     ← PRE-BUS
  4. removeSentinel() → deletes [STARTED] file                  ← PRE-BUS
  5. escalateBlockedSession() → trackRequest + digest            ← PRE-BUS (conditional)
  6. cleanupSession() + remove from activeSessions               ← PRE-BUS

  7. bus.emit("session_end") →
     ├── DbWriter (#1)          → UPDATE SQLite sessions
     ├── ContextUpdater (#2)    → write context.md
     ├── RequestTracker (#3)    → UPDATE SQLite requests  
     ├── DigestWriter (#4)      → INSERT SQLite session_digests
     ├── StuckDetector (#5)     → cleanup state map
     ├── AutoResume (#6)        → schedule resume (if interrupted)
     ├── AgentLoader (#7)       → runAgentCleanup()
     ├── Session Drop Recovery (#8) → requeue (if error)
     ├── Auto-evaluate (#9)     → evaluateTask() after 3s
     ├── Escalation (#10)       → escalateToHuman (if blocked/failure)
     ├── Error surface (#11)    → emit info log (DUPLICATE)
     ├── Context Learning (#12) → learn facts (triggered by #9)
     └── Core command handler (#13) → no-op for session_end
     + UI subscribers (console, telegram, socket)
```

**That's 12 subscribers firing for every session_end**, plus 4-6 pre-bus operations. Total: **~16-18 I/O operations per session completion.**

## 5. Recommendations

### P0: Remove Error Surface Subscriber (#11)
Pure dead weight — duplicates manager.ts error logging. 5 lines to delete.

### P1: Deduplicate blocked/failure escalation
Either:
- Remove `escalateBlockedSession()` from manager.ts (let the bus subscriber handle it), OR
- Remove the may.ts escalation subscriber (#10) and enhance manager's version to include Telegram alerts

The bus subscriber is more sophisticated (uses digest classifier), so the recommendation is to remove `escalateBlockedSession()` from manager.ts and let the bus subscriber be the single escalation path.

### P2: Consolidate recovery logic
AutoResume (#6) and Session Drop Recovery (#8) solve the same problem (session failed, should we retry?) with different conditions. Merge into a single "session failure handler" with unified retry counting and escalation.

### P3: Centralize digest writes
The DigestWriter subscriber (#4) should be the single entry point for all digest writes. Other components should emit typed events (e.g., `digest_write`) rather than calling `upsertDigest()` directly. This would reduce the 6 scattered call sites to 1.

### Low Priority: Remove ActivityWriter comment
Dead reference in manager.ts L1009. Misleading but harmless.

## 6. Summary Table

| Subscriber | Status | Notes |
|-----------|--------|-------|
| DbWriter (#1) | ✅ Needed | Single SQLite writer. No overlap. |
| ContextUpdater (#2) | ✅ Needed | Unique function (agent-requested context changes) |
| RequestTracker (#3) | ✅ Needed | Unique function (request lifecycle) |
| DigestWriter (#4) | ⚠️ Misleading | Only handles 2/8+ digest triggers. Name implies it's THE digest writer. |
| StuckDetector (#5) | ✅ Needed | Unique function. Minor state leak risk. |
| AutoResume (#6) | ⚠️ Overlap | Overlaps conceptually with P62 recovery (#8) |
| AgentLoader (#7) | ✅ Needed | Unique function (cleanup hooks) |
| P62 Recovery (#8) | ⚠️ Overlap | Overlaps conceptually with AutoResume (#6) |
| Auto-evaluate (#9) | ✅ Needed | Unique function |
| Escalation (#10) | ⚠️ Overlap | Overlaps with manager.ts `escalateBlockedSession()` |
| Error Surface (#11) | 🔴 Dead weight | Duplicate of manager.ts error logging |
| Context Learning (#12) | ✅ Needed | Unique function (different from ContextUpdater) |
| Core Commands (#13) | ✅ Needed | Event routing |
| subscribeForPersistence (#14) | ✅ Needed | Message JSONL (only message-level writer) |

**Dead weight**: 1 subscriber (#11)  
**Overlapping**: 3 pairs (#6/#8, #10/manager.escalate, #2/#12)  
**Clean**: 10 subscribers


[SIG: 1775931866:b8c2f1e5]
