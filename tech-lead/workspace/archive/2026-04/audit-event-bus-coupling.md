# Event Bus Subscriber Ordering & Coupling Audit

**Date**: 2026-04-11  
**Lens**: B — Flow Complexity  
**Status**: Complete

---

## 1. EventBus Architecture

The bus (`src/app/event-bus.ts`) is a simple synchronous fan-out:

```typescript
emit(event: AgentEvent): void {
  for (const fn of this.subscribers) {
    try { fn(event); } catch { /* subscriber errors never break the bus */ }
  }
}
```

**Key properties:**
- **Synchronous iteration**: subscribers fire in registration order, sequentially
- **Error isolation**: each subscriber is wrapped in try/catch — a throw in subscriber N does NOT block subscriber N+1
- **No ordering contract**: registration order is the implicit execution order, but nothing documents or enforces it
- **No return values**: pure side-effect model, no way for subscribers to communicate results to each other
- **No async awareness**: if a subscriber returns a Promise, it's fire-and-forget — the bus doesn't await it

---

## 2. Complete Subscriber Registry (in registration order)

All `bus.subscribe(...)` calls in `may.ts`, in the exact order they execute:

| # | Subscriber | Registered at | Events handled | Side effects |
|---|-----------|---------------|----------------|-------------|
| 1 | **DbWriter.handler** | may.ts:208 | `session_start`, `session_end`, `message_created`, `cron_fired` | SQLite writes (upsert/update sessions, track requests, cron history) |
| 2 | **createContextUpdater** | may.ts:218 | `session_end` | Reads/writes `agents/<name>/context.md` (filesystem I/O) |
| 3 | **createRequestTracker** | may.ts:219 | `session_end` | SQLite: tracks new_items, fuzzy-matches completed_items against pending requests |
| 4 | **createDigestWriter** | may.ts:220 | `session_start`, `session_end` | SQLite: creates start/end digest entries via `session-digest.ts` |
| 5 | **createStuckDetector** | may.ts:221 | `session_start`, `session_end`, `turn_end` | Stateful: tracks error turns per session. May emit `cancel` + `message_created` back onto bus |
| 6 | **createAutoResume** | may.ts:240 | `session_end` (status=interrupted) | Stateful: tracks resume attempts. May call `manager.resumeInterrupted()` after timeout |
| 7 | **Agent-loader bookkeeping** | may.ts:358 | `session_start`, `session_end` | Calls `setAgentSessionId()` / `runAgentCleanup()` |
| 8 | **Session Drop Recovery (P62)** | may.ts:371 | `session_end` (status=error) | Consults digest classifier → may call `manager.run()` (requeue) or `escalateToHuman()` |
| 9 | **Auto-evaluate** | may.ts:437 | `session_end` (with parentSessionId) | Async: calls `evaluateTask()` after 3s delay, then emits `context-learn` |
| 10 | **Escalation (blocked/failure)** | may.ts:472 | `session_end` (status=blocked/failure) | Consults digest classifier → may call `trackRequest()` + `escalateToHuman()` |
| 11 | **Surface errors** | may.ts:520 | `session_end` (status=error) | Emits `info` event back onto bus |
| 12 | **Context Learning** | may.ts:583 | `context-learn` | Async: LLM extraction → writes `context.md` |
| 13 | **Core command router** | may.ts:783 | `input`, `steer`, `cancel`, `fork`, `reload`, `message`, `resume`, `restart`, `shutdown` | Routes commands to manager/ChatSession — the "controller" |
| 14 | **Console UI** | attachConsoleUI | All events | Renders to stdout (read-only) |
| 15 | **Socket UI** | attachSocketUI | All events | Broadcasts JSON to connected clients (read-only) |
| 16 | **Telegram UI** | attachTelegramBot | Session events, notifications | Sends formatted messages to Telegram (read-only) |

### Additional emitters (not subscribers but relevant):
- **manager.ts**: Emits `session_start`, `session_end`, `turn_end`, `text`, `tool_call`, `tool_result` via `bridgeAgentEvents()` and `handleCompletion()`
- **Cron.ts**: Emits `cron_fired`, `log`, `info`, `notification` — but does NOT subscribe to bus events
- **ChatSession**: Emits `info`, `input` — does NOT subscribe to bus events
- **agent-loader.ts**: Emits `info`, `log`, `notification`, `workflow` — does NOT subscribe

---

## 3. Implicit Ordering Dependencies

### 3.1 CRITICAL: DbWriter (#1) must run before RequestTracker (#3)

**The dependency**: `createRequestTracker` calls `getDb(persistDir)` which opens the same SQLite database. When it queries `SELECT ... FROM requests WHERE toAgent = ?`, it expects the session to already exist in the DB. But more critically, it calls `updateRequest()` which UPDATEs rows — if DbWriter hasn't written the session yet, the request row referenced by `requestId` might not exist.

**Current state**: This works by accident — DbWriter is registered first (#1) so it writes before RequestTracker reads (#3). **If registration order changed, completed_items fuzzy-matching would query stale data.**

**Risk**: LOW (order is stable in may.ts and unlikely to change accidentally). But it IS implicit.

### 3.2 MODERATE: StuckDetector (#5) vs AutoResume (#6) — race on session_end

Both react to `session_end`. StuckDetector deletes its internal state; AutoResume checks if `status === "interrupted"`. No direct data dependency, but:

**The concern**: If an agent is stuck AND interrupted simultaneously (e.g., stuck agent gets timeout-killed, which triggers `session_end` with status="interrupted"), both subscribers fire:
- StuckDetector: cleans up internal state (harmless)
- AutoResume: might attempt to resume a session that was killed for being stuck

**Current mitigation**: StuckDetector emits `cancel` on the bus (which goes to the command router subscriber #13). This cancellation happens synchronously during bus.emit, so it fires the cancel command before AutoResume sees the `session_end`. However, AutoResume's resume happens on a `setTimeout(delay)`, so by the time it fires, the session is already dead. The resume attempt would fail gracefully.

**Risk**: LOW — the timeout-based resume will just fail if the session was already cancelled.

### 3.3 MODERATE: Recovery (#8) vs AutoResume (#6) vs Escalation (#10) — triple reaction to session_end

For a `session_end` with `status=error`:
1. **AutoResume** (#6): skipped — only handles `status=interrupted`
2. **Recovery** (#8): fires — may requeue the task as a new session
3. **Escalation** (#10): skipped — only handles `finishParams.status === 'blocked' | 'failure'`

For a `session_end` with `status=interrupted`:
1. **AutoResume** (#6): fires — may resume the session
2. **Recovery** (#8): skipped — only handles `status=error`
3. **Escalation** (#10): skipped

For a `session_end` with `finishParams.status=failure`:
1. **AutoResume** (#6): skipped — status is not "interrupted"
2. **Recovery** (#8): may or may not fire (depends on `info.error && info.status === 'error'`)
3. **Escalation** (#10): fires — may track request + escalate to human

**Assessment**: The status-based routing is mostly correct, but there's no documentation of which subscriber "owns" which status. A new developer could easily add a subscriber that overlaps.

### 3.4 HIGH: DigestWriter (#4) vs Recovery (#8) — digest must exist before recovery reads it

**The dependency**: Recovery subscriber (#8) calls `getLastDigest(PERSIST_DIR, info.sessionId)` to read the digest classification. DigestWriter (#4) calls `createEndDigest()` which writes the digest. Recovery needs the digest to exist.

**Current state**: DigestWriter is #4, Recovery is #8. DigestWriter's `createEndDigest()` is synchronous (SQLite write). Recovery's `getLastDigest()` reads from the same DB. **This ordering dependency is IMPLICIT and CRITICAL** — if DigestWriter ran after Recovery, the digest classifier would have no data to classify.

**Complication**: The `upsertDigest()` calls in StuckDetector (#5) and AutoResume (#6) are ASYNC (return Promises). The bus doesn't await them. So when Recovery (#8) calls `getLastDigest()`, the stuck/resume digest may not have been written yet. The code handles this with a fallback (`classifyError()` for Recovery, `action ?? "resume"` for AutoResume).

**Risk**: HIGH conceptually — this is the most fragile ordering dependency. If anyone moves DigestWriter after Recovery in the registration order, the entire digest-classifier-driven recovery system silently degrades to fallback behavior without any error.

### 3.5 LOW: Context Learning (#12) depends on events emitted by Auto-evaluate (#9)

Auto-evaluate (#9) emits `context-learn` events, which Context Learning (#12) handles. This works because:
- Auto-evaluate fires on `session_end` → runs async with `setTimeout(3000)` → emits `context-learn`
- Context Learning listens for `context-learn`

**No ordering dependency**: The `context-learn` event is emitted as a new bus.emit() call, not during the original session_end fan-out. So registration order doesn't matter.

---

## 4. Bus Re-entrancy Analysis

Several subscribers **emit events back onto the bus** during their handler execution:

| Subscriber | Re-emits | Event type emitted |
|-----------|----------|-------------------|
| StuckDetector (#5) | Yes | `cancel`, `message_created` |
| AutoResume (#6) | Yes (via callbacks) | `log` |
| Recovery (#8) | Yes | `info`, `message_created` (via trackRequest → bus) |
| Escalation (#10) | Yes (indirectly) | via `trackRequest()` |
| Surface errors (#11) | Yes | `info` |
| Context Learning (#12) | Yes | `info` |
| Command router (#13) | Yes | `log`, `info`, `message_created` |

**Re-entrancy safety**: When subscriber #5 calls `bus.emit({ type: "cancel", ... })`, the bus enters a nested `emit()` → iterates ALL subscribers again. This means:
- The `cancel` event reaches ALL 16 subscribers synchronously, BEFORE subscriber #6 gets the original `session_end` event
- Wait, no — JavaScript is single-threaded. The `bus.emit()` in StuckDetector creates a NEW iteration loop. The original loop continues after the nested emit returns.

Actually, looking at the code more carefully: StuckDetector fires on `turn_end`, not `session_end`. So re-entrancy during session_end is limited to:
- Recovery (#8) emits `info` events (harmless — only read by UI subscribers)
- Escalation (#10) emits via `trackRequest()` which may emit `message_created`

**Risk**: LOW — re-emitted events are informational or commands, and the bus handles nested emit() correctly (iterates subscriber array, catches errors).

---

## 5. Redundant Work Analysis

### 5.1 Triple-write on session_end status

When a session ends, the status is written in THREE places:
1. **manager.ts**: `this.registry.updateSessionStatus()` → writes `meta.json` (filesystem)
2. **DbWriter** (#1): `updateSessionDb()` → writes to `sessions` table (SQLite)
3. **DigestWriter** (#4): `createEndDigest()` → writes to `session_digests` table (SQLite)

These are not redundant in the harmful sense — they write to different stores. But they represent the same logical fact (session ended with status X) persisted in 3 places. If they disagree, there's no reconciliation.

### 5.2 Double request tracking on session_end

Both **DbWriter** (#1) and **RequestTracker** (#3) interact with the `requests` table:
- DbWriter: handles `message_created` → `trackRequest()`
- RequestTracker: handles `session_end` → fuzzy-matches `completed_items` and creates `new_items`

These handle different aspects (creation vs completion) so they're complementary, not redundant.

### 5.3 Context updates — potential double-write

**ContextUpdater** (#2) writes `context.md` on `session_end` (from `finishParams.context_updates`).
**Context Learning** (#12) writes `context.md` on `context-learn` events (LLM extraction from session).

Both can modify the same file for the same session. ContextUpdater runs immediately on session_end. Context Learning runs 3+ seconds later (after auto-evaluate's setTimeout + LLM call). They may step on each other's writes (last-writer-wins on filesystem).

**Risk**: LOW — they serve different purposes (explicit vs extracted context), but a race is theoretically possible.

---

## 6. Failure Impact Analysis

### What happens if a subscriber throws?

The bus catches all subscriber errors: `try { fn(event); } catch { /* subscriber errors never break the bus */ }`. This means:
- A throw in DbWriter (#1) does NOT prevent DigestWriter (#4) from running
- A throw in any subscriber is **silently swallowed** — no logging, no error tracking
- The catch block is empty: `catch { }` — the error message is lost

**Issue**: Silent failure swallowing. If DbWriter throws on every session_end (e.g., disk full, DB locked), there's no visibility. The system continues but stops persisting to SQLite. All downstream subscribers that read from the DB (Recovery, Escalation) would read stale data.

### What happens if a subscriber hangs (long sync operation)?

The bus iterates synchronously. A subscriber that does a slow sync I/O (e.g., `readFileSync` on a large file, or a synchronous DB query on a locked database) blocks ALL subsequent subscribers.

**Current risk**: 
- `createContextUpdater` does `readFileSync` + `writeFileSync` — fast on typical context.md files (< 10KB)
- `DbWriter` does SQLite writes — typically fast but can be slow under contention
- All digest-related subscribers do SQLite writes

---

## 7. Proposed Fixes

### P0: Add error logging to bus.emit

**Problem**: Errors are silently swallowed  
**Fix**: Log subscriber errors instead of eating them silently

```typescript
emit(event: AgentEvent): void {
  for (const fn of this.subscribers) {
    try {
      fn(event);
    } catch (err) {
      console.error(`[bus] Subscriber error on ${event.type}:`, err);
    }
  }
}
```

**Effort**: 1 line change  
**Impact**: Makes silent failures visible

### P1: Document ordering dependencies

**Problem**: DigestWriter MUST run before Recovery/AutoResume/Escalation — this is implicit  
**Fix**: Add comments in may.ts at subscriber registration:

```typescript
// ── ORDERING CONTRACT: subscribers 1-4 are "writers", 5+ are "readers" ──
// DbWriter and DigestWriter MUST be registered before Recovery/Escalation
// because those subscribers read digest data written by DigestWriter.
bus.subscribe(dbWriter.handler);           // #1: DB persistence (must be first)
bus.subscribe(createContextUpdater(...));   // #2: context.md updates
bus.subscribe(createRequestTracker(...));   // #3: request tracking
bus.subscribe(createDigestWriter(...));     // #4: digest creation (must precede #8, #10)
```

**Effort**: Comments only  
**Impact**: Prevents accidental reordering

### P2: Consider splitting session_end into phases

**Problem**: 6+ subscribers all react to the same `session_end` event with implicit ordering  
**Fix**: Emit two events: `session_end_persist` (for writers) then `session_end_react` (for reactors)

This would make the dependency explicit: persistence subscribers run first, then reactive subscribers can safely read persisted data. However, this is a bigger refactor and the current system works — only worth doing if ordering bugs actually manifest.

---

## 8. Summary

| Finding | Severity | Action |
|---------|----------|--------|
| Silent error swallowing in bus.emit | P0 | Add console.error logging |
| DigestWriter → Recovery ordering dependency | P1 | Document with comments |
| 16 subscribers on a single bus, 6 on session_end alone | Observation | Monitor complexity growth |
| Re-entrant emit() (subscribers emitting back) | Low risk | Acceptable — JS single-threaded |
| Triple status persistence (meta.json + sessions DB + digests DB) | Observation | Intentional — different stores |
| Context.md potential race (ContextUpdater vs Context Learning) | Low risk | Different timing (0ms vs 3s+) |
| Async digests in StuckDetector/AutoResume not awaited | By design | Fallback behavior is correct |

**Overall assessment**: The event bus is architecturally sound — the fan-out pattern with error isolation is correct. The main risk is **implicit ordering dependencies** between writer subscribers (1-4) and reader subscribers (5+). This is currently stable because may.ts registration order is fixed, but it's a fragility source as the system grows.
