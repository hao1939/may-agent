# Lens D: Session Subscriber Error Propagation Audit

**Date**: 2026-04-13  
**Scope**: `src/lib/session-subscribers.ts`, `src/app/event-bus.ts`, `src/lib/manager.ts` (handleCompletion, close)  
**Question**: Does one subscriber failure cascade to block other subscribers? Are there silent catch blocks? What's the blast radius of a single subscriber crash?

---

## 1. Bus-Level Protection: Solid ✅

The `EventBus.emit()` method (event-bus.ts:109-115) iterates all subscribers in a `for` loop with individual `try/catch`:

```typescript
emit(event: AgentEvent): void {
  for (const fn of this.subscribers) {
    try {
      fn(event);
    } catch {
      /* subscriber errors never break the bus */
    }
  }
}
```

**Verdict**: A synchronous throw in any subscriber is caught and silently discarded. Other subscribers always execute. No cascading failure. **However**, the catch block is completely silent — no logging, no error identification. If a subscriber starts throwing, the system has zero observability into it.

**Severity: Low (isolation) / Medium (observability)**

---

## 2. Subscriber-Internal Error Handling: Pervasive Silent Catches ⚠️

Every subscriber in `session-subscribers.ts` wraps its logic in `try/catch { /* best-effort */ }` blocks. This is defense-in-depth on top of the bus catch, but the pattern means errors are swallowed at two levels:

| Subscriber | Catch Blocks | What's Silenced |
|---|---|---|
| `createContextUpdater` (L22-56) | 2 nested catches: outer (L49) + inner file-read (L36) | File I/O failures writing context.md — agent loses context_updates silently |
| `createRequestTracker` (L62-119) | 4 nested catches: outer new_items (L80), inner per-item (L85), outer completed_items (L94), DB query (L94) | Request tracking failures — completed_items never matched, new_items never created. DB corruption invisible |
| `createStuckDetector` (L127-207) | `onCircuitBreak` wrapped in try/catch (L200). Async `.catch()` on digest calls (L193, L232) | Circuit breaker callback failure silenced. Digest classification failure falls through to `fallbackKill()` — this is actually correct degradation |
| `createAutoResume` (L215-335) | Async `.catch()` on digest calls (L285, L330). Falls back to default behavior | Digest failure → fallback resume. Good degradation pattern |
| `createDigestWriter` (L341-384) | Outer try/catch (L348, L370) with `log("warn", ...)` | **Only subscriber that logs its errors** — good. But outer catch still swallows |

**Severity: Medium** — The "best-effort" pattern is intentional and correct for non-critical side effects. But the complete absence of logging in most catch blocks means:
- Context updates can silently fail for weeks
- Request completion matching can break without anyone noticing
- No way to diagnose "why did my completed_items not resolve?"

---

## 3. Async Error Paths: Unhandled Promise Risk ⚠️

Several subscribers fire async operations (`.then()/.catch()`) from within synchronous event handlers:

**StuckDetector** (L186-206): `upsertDigest(...)` returns a Promise. The `.then()` callback calls `logShadowComparison()`. If `logShadowComparison` throws synchronously inside `.then()`, it becomes an unhandled promise rejection (the `.catch()` only catches the `upsertDigest` promise, not errors in `.then()`).

```typescript
// L190-193 — .then() error NOT caught by .catch()
upsertDigest(...).then(digest => {
  logShadowComparison(event.sessionId, "stuck_detected", "nothing", digest);
  // ↑ If this throws, it's an unhandled rejection
}).catch(err => log("warn", `[digest] stuck_detected failed: ${err}`));
```

Same pattern appears at: L216-232 (circuit_break), L282-285 (resume_exhausted), L314-330 (auto_resume).

**Actual risk**: `.catch()` on a `.then().catch()` chain DOES catch errors thrown in the `.then()` callback — this is standard Promise behavior. The `.catch()` catches rejections from anywhere up the chain. **So this is actually safe.** My initial concern was wrong — the chain is `promise.then(fn).catch(handler)`, and if `fn` throws, `catch(handler)` catches it.

**Severity: None** — The async chains are correctly structured.

---

## 4. Subscriber Registration Order: Implicit Priority

In `src/app/may.ts` (L206-238), subscribers are registered in this order:
1. `dbWriter.handler` (L206)
2. `createContextUpdater` (L216)
3. `createRequestTracker` (L217)
4. `createDigestWriter` (L218)
5. `createStuckDetector` (L219)
6. `createAutoResume` (L238)
7. Agent-loader bookkeeping (L356)
8. Session Drop Recovery / P62 (L369)
9. Auto-evaluate (L435)
10. Escalation (L470)
11. Surface errors (L518)
12. Context-learn (L565)

Since `emit()` iterates sequentially and catches per-subscriber, order doesn't affect isolation. But it does affect timing: if the DB writer (subscriber 1) takes a long time synchronously, all other subscribers are delayed for that event. Since all subscribers are synchronous in their immediate execution (async work is fire-and-forget), this is not a real concern.

**Severity: None**

---

## 5. The Real Risk: `handleCompletionInner` Throws Before `emit(session_end)`

The most significant propagation fragility is NOT in the subscribers — it's in the **emission site**. In `manager.ts`:

```typescript
// L737-769: handleCompletion wraps handleCompletionInner in try/catch
private handleCompletion(session: ActiveSession): void {
  this.clearTimeout(session);
  if (session.closed) return;
  try {
    this.handleCompletionInner(session);
  } catch (err) {
    // Bug 3 fix: cleanup session even if pipeline throws
    // BUT: session_end is NEVER emitted in this catch path
    session.error = ...;
    session.archiveStatus = "error";
    this.registry.updateSessionStatus(session.sessionId, "error", ...);
    this.activeSessions.delete(session.sessionId);
    // ❌ No this.emit({ type: "session_end", ... }) here!
  }
}
```

If `handleCompletionInner` throws (e.g., `determineOutcome` fails, `buildSessionInfo` fails, `registry.updateSessionStatus` throws on first call), the session_end event is **never emitted**. This means:
- **Context updates are lost** — no `session_end` → contextUpdater never fires
- **Request tracking is lost** — completed_items/new_items never processed
- **Digest end entry is never written** — session has a start digest but no end
- **Auto-resume never triggers** — if the error was transient, no recovery
- **Session Drop Recovery (P62) never fires** — the ambulance doesn't know
- **Auto-evaluate never runs** — quality tracking has a gap

The `close()` method (L1936-2005) correctly emits `session_end` in all paths, so this gap is specific to the `handleCompletion` error catch.

**Severity: HIGH** — This is the most impactful finding. A single throw in the completion pipeline silently kills all downstream subscriber processing for that session. The session is cleaned up (no ghost), but all side effects are lost.

---

## 6. Summary of Findings

| # | Finding | Severity | Location |
|---|---------|----------|----------|
| 1 | Bus-level catch is silent (no logging) | Low | event-bus.ts:112 |
| 2 | 10+ `/* best-effort */` catches with no logging | Medium | session-subscribers.ts throughout |
| 3 | `handleCompletion` catch path skips `session_end` emit | **HIGH** | manager.ts:745-769 |
| 4 | Subscriber execution order is implicit but harmless | None | may.ts:206-565 |
| 5 | Async promise chains are correctly structured | None | session-subscribers.ts |

---

## 7. Recommendations

### P0: Emit `session_end` in `handleCompletion` catch block (HIGH)
Add a `this.emit({ type: "session_end", ... })` in the catch block of `handleCompletion` (manager.ts:745-769). Without this, any throw in the completion pipeline silently drops all subscriber side effects.

### P1: Add logging to bus-level catch (LOW effort, MEDIUM value)
Change `event-bus.ts:112` from `catch { }` to `catch (err) { console.error('[bus] subscriber error:', err); }`. This is the single highest-leverage observability improvement.

### P2: Add logging to subscriber catch blocks (MEDIUM effort)
Replace `/* best-effort */` catches in `createContextUpdater` and `createRequestTracker` with `log("warn", ...)` like `createDigestWriter` already does. At minimum, log the agent name so failures can be correlated.
