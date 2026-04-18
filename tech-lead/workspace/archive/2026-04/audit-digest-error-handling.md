# Audit: Session Digest Error Handling Fragility

**Date**: 2026-04-13  
**Scope**: `src/lib/session-digest.ts`, `src/lib/classify-error.ts`, `src/lib/session-subscribers.ts`, `src/app/event-bus.ts`, `src/app/may.ts`, `src/lib/manager.ts`  
**Objective**: Trace failure modes in digest/classification pipeline — silent failures that cascade to wrong context, wrong escalation, wrong recovery.

---

## Executive Summary

The digest system is **reasonably well-defended** against crashes — every `upsertDigest()` call site has `.catch()`, the event bus catches subscriber exceptions, and core functions wrap DB operations in try-catch. However, there are **6 specific fragility gaps** that can cause silent data loss, corrupted context, or wrong recovery decisions.

**Worst finding**: A single corrupted `details` JSON field in any digest row causes ALL context history to disappear for subsequent sessions (P0).

---

## 1. Event Bus Subscriber Isolation

### How it works
`EventBus.emit()` (event-bus.ts:131-138) iterates subscribers in a `for` loop with individual try-catch:
```typescript
emit(event: AgentEvent): void {
  for (const fn of this.subscribers) {
    try { fn(event); } catch { /* subscriber errors never break the bus */ }
  }
}
```

### Finding 1a: Async errors are invisible (LOW RISK — mitigated)
The `Subscriber` type is `(event: AgentEvent) => void` (event-bus.ts:117). If a subscriber returns a rejected Promise, the bus's try-catch won't catch it — it becomes an unhandled rejection.

**Current mitigation**: All subscriber factories in `session-subscribers.ts` return sync functions that call `upsertDigest(...).then(...).catch(...)` — properly chaining the Promise. All 11 call sites across the codebase have `.catch()`.

**Residual risk**: If someone adds a new subscriber that does `async (event) => { await upsertDigest(...) }` without realizing the bus ignores the Promise, the error vanishes and could crash the process via unhandled rejection.

### Finding 1b: Subscriber execution order matters but is undocumented (INFO)
Subscribers run sequentially. The `createDigestWriter` subscriber (which writes the end digest) must run BEFORE the `may.ts` recovery subscriber (which reads `getLastDigest`). Currently working by registration order, but fragile.

---

## 2. upsertDigest() Failure Modes

### Core function (session-digest.ts:695-783)
The entire function body is wrapped in a single try-catch that returns `null` on failure.

### Finding 2a: UNIQUE constraint race condition (P2 — theoretical)
**Location**: session-digest.ts lines 702-703
```typescript
const last = getLastDigest(persistDir, input.sessionId);
const step = (last?.step ?? 0) + 1;
```
The step counter is computed via read-then-increment without a transaction. If two concurrent `upsertDigest()` calls fire for the same session (e.g., timeout + overflow at nearly the same time), both compute the same `step` value, and the second `insertDigest` fails with a UNIQUE constraint violation on `(sessionId, step)`.

**Impact**: The outer try-catch catches the UNIQUE violation and returns `null`. The second digest (with its classification/action) is silently lost. Recovery decisions downstream that depend on `getLastDigest()` may see stale data.

**Likelihood**: Low — most triggers are mutually exclusive (timeout vs circuit_break). But `overflow` detection (manager.ts:758) runs in `handleCompletion` alongside the bus emit that triggers `createDigestWriter`, creating a narrow race window.

### Finding 2b: insertDigest returns 0 silently on some platforms (P2)
**Location**: session-digest.ts line 383
```typescript
return Number((result as any).lastInsertRowid ?? 0);
```
If the DB driver returns an unexpected shape, `insertDigest` returns `id=0`. The subsequent `updateDigestAction(persistDir, 0, ...)` would update a non-existent row — silently doing nothing. The classification is lost.

### Finding 2c: getLastDigest after insert may return wrong row (P2)
**Location**: session-digest.ts lines 717, 780
After `insertDigest`, `upsertDigest` calls `getLastDigest(persistDir, input.sessionId)` to return the result. If another concurrent insert happened between insert and select, it could return a different row. This is a read-after-write ordering issue.

**Impact**: Returns slightly wrong data. Unlikely to cause real harm since the row content is similar.

---

## 3. LLM Synthesis Failure Modes

### Finding 3a: LLM failure produces degraded but valid digest (GOOD — by design)
**Location**: session-digest.ts lines 563-572 (`llmSynthesize`)
```typescript
} catch (err) {
  log("warn", `[digest] LLM synthesis failed for ${opts.agent}: ${err}`);
  return {
    what_happened: `[digest synthesis failed: ${String(err).slice(0, 100)}]`,
    outcome: "in_progress",
    still_open: null,
  };
}
```
This is well-designed. On LLM timeout/bad JSON/empty response, it returns a placeholder. The error text is baked into `what_happened`, making it visible. Outcome defaults to `in_progress`, which is conservative.

### Finding 3b: parseDigestResponse tolerates garbage LLM output (GOOD)
**Location**: session-digest.ts lines 577-596
If the LLM returns nonsense (no WHAT_HAPPENED/OUTCOME markers), it falls back to `text.slice(0, 500)` for what_happened and `"in_progress"` for outcome. No crash path.

### Finding 3c: manager.waitFor() can hang indefinitely (P1)
**Location**: session-digest.ts line 565
```typescript
const result = await manager.waitFor(sessionId);
```
`manager.waitFor()` returns a Promise that resolves when the evaluator session completes. If the evaluator session gets stuck or orphaned, `waitFor` hangs forever. The timeout on the session might fire, but the outer `llmSynthesize` has no timeout of its own.

**Impact**: The `upsertDigest()` call hangs. Since all callers are fire-and-forget (no `await`), the Promise just stays pending — no immediate crash. But it holds a reference to the manager and session state indefinitely, leaking memory slowly.

**Blast radius**: The digest row for this trigger is never written. Any downstream consumer calling `getLastDigest()` (e.g., the recovery subscriber in may.ts:379) will see stale/missing data and may make wrong recovery decisions.

---

## 4. Unprotected JSON.parse — Context Injection Poison (P0)

### Finding 4a: Corrupted `details` field kills all context history
**Location**: session-digest.ts line 237
```typescript
const details: Record<string, unknown> = d.details ? JSON.parse(d.details) : {};
```
This is inside `formatDigestEntry()`, called by `formatDigestContext()`, called by the context injection path in manager.ts:569. 

**The call chain**:
1. `manager.ts:549-574` — wraps entire context assembly in try-catch
2. Inside: `getRecentDigests()` → `formatDigestContext()` → `formatDigestEntry()` for each digest
3. `formatDigestEntry()` calls `JSON.parse(d.details)` **without try-catch**

**Impact**: If ANY single digest row has a corrupted `details` field (malformed JSON, encoding issue, truncated write), the `JSON.parse` throws, which propagates up through `formatDigestContext` and is caught by manager.ts:574's catch block. The **entire** `historyBlock` becomes `null`. ALL context history (same-agent, cross-agent, unresolved items) is lost for that session.

This means:
- Agent starts with no task history
- Cross-agent awareness lost
- Unresolved items invisible
- Agent may redo already-completed work or miss critical context

**Likelihood**: Medium — `details` is a JSON-stringified object created by `insertDigest`. Normal operation produces valid JSON. But a process crash mid-write, disk full, or a bug in a details producer could create malformed JSON.

### Finding 4b: files_modified JSON.parse in formatDigestEntry (PROTECTED)
**Location**: session-digest.ts lines 258-263, 291-296
These are inside try-catch blocks — corrupted `files_modified` is silently skipped. Good.

### Finding 4c: files_modified JSON.parse in getCrossAgentDigests (PROTECTED)
**Location**: session-digest.ts lines 130-134
Inside try-catch — corrupted data returns `false`, skipping the candidate. Good.

---

## 5. classify-error.ts Analysis

### Finding 5a: classify-error is bulletproof (GOOD)
`classify-error.ts` is a pure function — no IO, no DB, no async, no JSON.parse. It handles `null`/`undefined` input gracefully (returns `"logic"`). No failure modes.

### Finding 5b: classifyDigest is also safe (GOOD)
**Location**: session-digest.ts lines 443-489
`classifyDigest()` is a pure switch-case function. No IO, no throws. Always returns a valid `{action, reason}` pair. The worst case is a wrong classification — but that's a logic bug, not an error handling gap.

---

## 6. Subscriber-Level Error Handling

### Finding 6a: createDigestWriter swallows all errors (GOOD but opaque)
**Location**: session-subscribers.ts lines 347-391
Both session_start and session_end branches are wrapped in try-catch that logs warnings. No error propagation. Good for isolation, but the logged warning is the only signal — no metric, no alert.

### Finding 6b: createStuckDetector has fire-and-forget async gap (P1)
**Location**: session-subscribers.ts lines 211-234 (circuit_break path)

After calling `upsertDigest(...).then(digest => { ... })`, line 238 does `state.delete(event.sessionId)` **synchronously**, before the Promise resolves. This means:
1. The stuck state is cleaned up immediately
2. If `upsertDigest` takes time (LLM synthesis), the stuck counter is already gone
3. If the session resumes quickly before the Promise resolves, a new stuck counter starts from 0

This isn't a crash bug — it's a timing gap where the session could accumulate more error turns while waiting for the classifier to decide.

### Finding 6c: createAutoResume attempts map vs async decision (P1)
**Location**: session-subscribers.ts lines 289-290, 308-330

The `attempts` counter is set synchronously (`attempts.set(event.sessionId, prev + 1)` at line 289), but the decision to actually resume happens asynchronously in the `.then()` callback. If the classifier says "kill" or "nothing" (lines 328-330), the code does `attempts.delete(event.sessionId)` — but the counter was already incremented.

**Impact**: If the session gets interrupted again later, the attempt counter reflects a "used" attempt that never actually produced a resume. The session might exhaust `MAX_RESUME_ATTEMPTS` earlier than intended.

---

## 7. Blast Radius: Downstream Consumers of Digest Data

### Who reads digests and what happens if data is missing/wrong?

| Consumer | Location | Reads | Null handling | Impact of bad data |
|----------|----------|-------|---------------|--------------------|
| Context injection | manager.ts:549-575 | `getRecentDigests`, `getCrossAgentDigests`, `getUnresolvedDigests`, `formatDigestContext` | Try-catch → skip all history | **HIGH**: Agent loses all memory |
| Recovery P62 | may.ts:379-383 | `getLastDigest` | Falls through to `classifyError` | **MEDIUM**: Uses string-matching fallback (less intelligent but functional) |
| Escalation | may.ts:485-489 | `getLastDigest`, `classifyDigest` | Falls through to "always escalate" | **LOW**: Over-escalates rather than under-escalates (safe direction) |
| Shadow comparison | various | `logShadowComparison` | Handles null digest | **NONE**: Logging only |
| Auto-resume | session-subscribers.ts:314 | Reads digest from upsertDigest result | Falls back to "resume" | **MEDIUM**: May resume when it shouldn't |

**Key observation**: The fallback direction is mostly safe — recovery falls back to `classifyError` (string matching), escalation falls back to "always escalate", auto-resume falls back to "always resume". The exception is context injection, which falls back to **no history at all**.

---

## 8. Try-Catch vs Async Operation Count

| File | Async ops | Try-catch blocks | Protected? |
|------|-----------|-------------------|------------|
| session-digest.ts | 4 (2 await, 2 implied in async fn) | 9 | Yes — outer catch covers all |
| session-subscribers.ts | 8 (.then/.catch chains) | 12 | Yes — all chains have .catch() |
| classify-error.ts | 0 | 0 | N/A — pure function |
| event-bus.ts | 0 | 1 (per subscriber) | Yes — but sync only |

**Gaps identified**: 0 unprotected async operations. All Promise chains have `.catch()`.

---

## Fix Recommendations

### P0: Corrupted details JSON kills context injection
**File**: session-digest.ts line 237  
**Fix**: Wrap `JSON.parse(d.details)` in try-catch, default to `{}`
```typescript
let details: Record<string, unknown> = {};
try { details = d.details ? JSON.parse(d.details) : {}; } catch { /* skip */ }
```
**Effort**: 2 lines  
**Impact**: Prevents single corrupted row from nuking all context history

### P1: llmSynthesize has no timeout
**File**: session-digest.ts line 565  
**Fix**: Add a `Promise.race` with a 30s timeout around `manager.waitFor(sessionId)`
```typescript
const result = await Promise.race([
  manager.waitFor(sessionId),
  new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
]);
```
**Effort**: 3 lines  
**Impact**: Prevents indefinite memory leak from hung evaluator sessions

### P1: Stuck detector state cleanup races with async decision
**File**: session-subscribers.ts line 238  
**Fix**: Move `state.delete(event.sessionId)` inside the `.then()` callback, after the decision is made
**Effort**: 2 lines moved  
**Impact**: Ensures stuck counter is only cleared after classifier acts

### P1: Auto-resume attempt counter premature increment  
**File**: session-subscribers.ts line 289  
**Fix**: Move `attempts.set()` into the `.then()` callback, only on actual resume  
**Effort**: 5 lines moved  
**Impact**: Accurate attempt tracking, prevents premature retry exhaustion

### P2: UNIQUE constraint race on step counter
**File**: session-digest.ts lines 702-703  
**Fix**: Use `INSERT OR REPLACE` or wrap in a transaction with `SELECT ... FOR UPDATE` semantics. Simpler: catch the UNIQUE violation specifically and retry with step+1.  
**Effort**: 10 lines  
**Impact**: Prevents lost digest rows in concurrent-trigger scenarios

### P2: insertDigest returning id=0
**File**: session-digest.ts line 383  
**Fix**: After insert, verify `id > 0`. If not, log a warning and skip `updateDigestAction`.  
**Effort**: 3 lines  
**Impact**: Prevents silently updating row 0 (which doesn't exist)

---

## What's Working Well

1. **classify-error.ts** is a pure function — zero failure modes, defensive defaults
2. **classifyDigest** is equally clean — pure switch-case, no IO
3. **All upsertDigest call sites** have `.catch()` — no unhandled rejections
4. **Event bus** isolates subscribers — one crash doesn't block others
5. **LLM synthesis** gracefully degrades with informative placeholders
6. **Fallback chains** generally fail safe (toward more conservative actions)
7. **Convenience functions** (createStartDigest, createEndDigest, createCheckpointDigest) all have individual try-catch

---

## Appendix: Call Sites Summary

| Location | Trigger | Has .catch() | Fire-and-forget? | LLM involved? |
|----------|---------|--------------|-------------------|---------------|
| manager.ts:678 | timeout | ✅ | ✅ | Yes (via manager) |
| manager.ts:758 | overflow | ✅ | ✅ | Yes (via manager) |
| manager.ts:801 | shallow_heartbeat | ✅ | ✅ | No |
| manager.ts:881 | escalation | ✅ | ✅ | No |
| manager.ts:1267 | zombie_cleanup | ✅ | ✅ | Yes (via manager) |
| manager-retry.ts:296 | infra_retry | ✅ | ✅ | No |
| subscribers.ts:185 | stuck_detected | ✅ | ✅ | Yes (via manager) |
| subscribers.ts:211 | circuit_break | ✅ | ✅ | Yes (via manager) |
| subscribers.ts:277 | resume_exhausted | ✅ | ✅ | Yes (via manager) |
| subscribers.ts:308 | auto_resume | ✅ | ✅ | Yes (via manager) |
| may.ts:406 | recovery_requeue | ✅ | ✅ | No |
