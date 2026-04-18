# Completion Pipeline Architecture Audit

**Date**: 2026-04-11  
**Scope**: completion.ts → manager.ts handleCompletionInner → EventBus → subscribers  
**Verdict**: The pipeline's internal stages are clean, but the subscriber layer has grown organically into a **fan-out mess** with redundant writes, mixed concerns, and no ordering guarantees.

---

## Architecture Diagram

```
  Agent loop resolves (prompt()/continue() settles)
              │
              ▼
  ┌─ handleCompletion() ─────────────────────────────────────────────┐
  │                                                                   │
  │  1. detectErrors(session)          ← silent stream / empty resp   │
  │  2. clearPostFinishErrors(session) ← post-finish artifacts        │
  │  3. Copy agent error to session    ← overflow error promotion     │
  │  ┌── INLINE DIGEST WRITES ──────────────────────────────────────┐ │
  │  │ upsertDigest("overflow")         ← if overflow detected      │ │
  │  │ upsertDigest("shallow_heartbeat")← if shallow detected       │ │
  │  │ upsertDigest("escalation")       ← if blocked/failure        │ │
  │  └──────────────────────────────────────────────────────────────┘ │
  │  4. Chat sessions: early return → go idle (no bus event)          │
  │  5. detectShallowHeartbeat(session)                               │
  │  6. determineOutcome(session)      ← archiveStatus, finishResult  │
  │  7. registry.updateSessionStatus() ← WRITE #1: meta.json         │
  │  8. cleanupSession / activeSessions.delete                        │
  │  9. escalateBlockedSession()       ← inline digest + request DB   │
  │ 10. buildSessionInfo() → emit("session_end")                      │
  │                                                                   │
  └───────────────────────────────────────────────────────────────────┘
              │
              ▼  EventBus.emit("session_end")
              │
     ┌────────┼────────────────────────────────────────────┐
     │        │  12 subscribers receive event (no ordering) │
     └────────┼────────────────────────────────────────────┘
              │
     ┌────────┴──────────────────────────────────────────────────────┐
     │  NAMED SUBSCRIBERS (session-subscribers.ts)                    │
     │  ┌─────────────────────────┬──────────────────────────────────┐│
     │  │ DbWriter.handler        │ WRITE #2: SQLite sessions table  ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ createContextUpdater    │ Writes agents/<name>/context.md  ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ createRequestTracker    │ Writes SQLite requests table     ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ createDigestWriter      │ WRITE #3: SQLite digests table   ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ createStuckDetector     │ Cleans up internal state only    ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ createAutoResume        │ May schedule resume (timer)      ││
     │  └─────────────────────────┴──────────────────────────────────┘│
     │                                                                │
     │  ANONYMOUS SUBSCRIBERS (may.ts)                                │
     │  ┌─────────────────────────┬──────────────────────────────────┐│
     │  │ Session map updater     │ In-memory agentSessionId map     ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ P62 Session Drop Recov. │ May requeue (new run())          ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ Auto-evaluate           │ May write eval to DB             ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ Escalation handler      │ May trackRequest to DB + human   ││
     │  ├─────────────────────────┼──────────────────────────────────┤│
     │  │ Error surface           │ Emits info event (logging only)  ││
     │  └─────────────────────────┴──────────────────────────────────┘│
     └───────────────────────────────────────────────────────────────┘
```

---

## Assessment: completion.ts Pipeline Stages

### Stage 1: detectErrors() — ✅ EARNING ITS KEEP
- **Purpose**: Catches silent stream failures and empty responses that agent-core doesn't flag.
- **Quality**: Clean, focused. Two precise checks with clear comments.
- **Concern**: Mutates `session.error` and `session.agent.state.errorMessage` via `(session.agent.state as any)` — type-unsafe cast. Minor.

### Stage 2: clearPostFinishErrors() — ✅ EARNING ITS KEEP  
- **Purpose**: Prevents post-finish artifacts (abort, empty trailing response) from being misclassified as failures.
- **Quality**: Correctly scoped to last turn only. Pattern list is well-documented.
- **Concern**: None significant.

### Stage 3: detectShallowHeartbeat() — ✅ EARNING ITS KEEP  
- **Purpose**: Catches heartbeats that respond from compacted context without checking anything.
- **Quality**: Simple, focused check. `turnCount === 0` is the right heuristic.
- **Concern**: Only applies to heartbeats. Very narrow, but the failure mode it prevents is real.

### Stage 4: determineOutcome() — ⚠️ MIXED  
- **Purpose**: Computes archiveStatus, extracts outcome text, builds finishResult.
- **Quality**: Clean return type (SessionOutcome). But it re-merges agent error into session error, duplicating logic already done in handleCompletionInner step 3.
- **Concern**: The caller (handleCompletionInner) pre-copies `session.agent.state.errorMessage` → `session.error` at line 726, then determineOutcome does the same check again at line 117. This is **defensive duplication** — not harmful but confusing.

### Stage 5: buildSessionInfo() — ✅ EARNING ITS KEEP  
- **Purpose**: Maps internal ActiveSession + SessionOutcome → clean SessionInfo for the bus event.
- **Quality**: Pure function, good boundary. This IS the contract between completion and consumers.
- **Concern**: The `getWorkspacePath` callback parameter is slightly awkward (why not just pass the path?), but it's a minor style issue.

### Overall Pipeline Verdict: **Clean decomposition. Each stage has a clear purpose.**  
The stages could theoretically be merged (detectErrors + clearPostFinishErrors are sequential error classification), but they're small enough that merging wouldn't gain much. The real problems are elsewhere.

---

## Assessment: Bus Subscribers

### Total session_end subscribers: **11** (6 named + 5 anonymous)

| # | Subscriber | Essential? | Notes |
|---|-----------|------------|-------|
| 1 | **DbWriter** | ✅ Yes | SQLite is the queryable index for dashboards, API |
| 2 | **ContextUpdater** | ✅ Yes | Applies agent learning from context_updates |
| 3 | **RequestTracker** | ✅ Yes | Resolves completed_items, creates new_items |
| 4 | **DigestWriter** | ⚠️ Overlap | Creates END digest — but 3+ inline upsertDigest calls in handleCompletionInner already write digests for the same session |
| 5 | **StuckDetector** | ✅ Yes (cleanup) | Just deletes internal map entry on session_end |
| 6 | **AutoResume** | ✅ Yes | Handles interrupted sessions with backoff |
| 7 | **Session map** (anon) | ✅ Yes | In-memory bookkeeping |
| 8 | **P62 Recovery** (anon) | ⚠️ Overlap with AutoResume | Both handle session failures — P62 for errors, AutoResume for interrupts. Could be one subscriber. |
| 9 | **Auto-evaluate** (anon) | ✅ Yes | But only for task children of the main session |
| 10 | **Escalation** (anon) | ⚠️ Overlap with manager | `escalateBlockedSession()` in handleCompletionInner (line 807) ALSO handles blocked/failure. Then this anon subscriber ALSO handles it. **Double escalation.** |
| 11 | **Error surface** (anon) | Marginal | Just emits an info event for error sessions. Could be folded into P62 Recovery. |

---

## Critical Finding: Triple-Redundant Status Persistence

Session completion status is persisted to **3 independent stores** with no transactional guarantee:

| Store | Writer | When | Data |
|-------|--------|------|------|
| **meta.json** | `registry.updateSessionStatus()` | Inline in handleCompletionInner (step 7) | status, error, endedAt |
| **SQLite sessions** | `DbWriter.handler` → `updateSessionDb()` | Bus subscriber (async-ish, no ordering) | status, error, outcome, endedAt, opCount |
| **SQLite digests** | `createDigestWriter` → `createEndDigest()` | Bus subscriber | outcome, what_happened, still_open, files_modified |

**Problems with this:**
1. **No consistency guarantee**: If the process crashes between meta.json write and bus emission, meta.json says "done" but SQLite says "running". On restart, which is truth?
2. **meta.json is canonical** — `loadAllSessionMetas()` reads only meta.json. SQLite is the queryable index but can drift.
3. **Race condition**: DbWriter uses `CASE WHEN ? > opCount THEN ? ELSE opCount END` to prevent a race where manager sets opCount and DbWriter overwrites with 0. This is a symptom of split writes — if one writer owned all persistence, the race wouldn't exist.

---

## Critical Finding: Double Escalation Path

When a session finishes with `status=blocked` or `status=failure`:

1. **handleCompletionInner** line 807 calls `escalateBlockedSession()` → writes digest + trackRequest to parent or May
2. **Anonymous escalation subscriber** in may.ts line 472 ALSO reacts to the same session_end → consults digest classifier → may trackRequest again

Both fire for the same event. The anonymous subscriber has a classifier that may decide "nothing" (suppressing the escalation), but the inline path has already fired. This means **the inline escalation always happens, and the subscriber may double it.**

---

## Critical Finding: Inline Digest Writes vs. DigestWriter Subscriber

Digests are written in **two separate paths** for the same session:

**Path A — Inline in handleCompletionInner:**
- `upsertDigest("overflow")` — line 735
- `upsertDigest("shallow_heartbeat")` — line 778
- `upsertDigest("escalation")` — line 853 (via escalateBlockedSession)

**Path B — DigestWriter subscriber (session_end event):**
- `createEndDigest()` — always fires for every session_end

This means a session that hits overflow gets: START digest → overflow digest → END digest = 3 rows. A normal session gets: START digest → END digest = 2 rows. This is probably intentional (multi-step digests), but the two paths have **no coordination** — they're written by different code at different times, and the step numbering relies on `getLastDigest()` which is eventually consistent at best.

---

## Critical Finding: Chat Sessions Skip the Bus Entirely

In handleCompletionInner, chat sessions (`autoClose === "never"`) hit an early return at line 761:
```typescript
if (session.autoClose === "never" && !effectivelyAborted && !overflowDetected) {
    // ... go idle, return
    return;
}
```

This means **no session_end event is emitted for chat sessions going idle**. None of the 11 subscribers fire. No DbWriter update, no digest, no request tracking. This is intentional (chat sessions persist across turns), but it means the "idle" status is invisible to the SQLite-based query layer.

---

## Simplification Proposals

### Proposal 1: Unify Status Persistence — Single Writer Pattern
**Effort**: Medium (2-3 days)  
**Impact**: High

Instead of 3 independent status writers:
- Make `DbWriter` the **single authority** for session state persistence on session_end
- meta.json write moves INTO DbWriter (or is called by DbWriter after SQLite write)
- Remove `registry.updateSessionStatus()` call from handleCompletionInner — let the bus event trigger ALL writes
- Benefit: One writer, one transaction, no drift

**Risk**: meta.json write is currently synchronous and happens before the bus event. Moving it to a subscriber means it happens after. If anything reads meta.json between completion and subscriber execution, it'd see stale data. In practice this window is <1ms, so low risk.

### Proposal 2: Merge Recovery Subscribers — P62 + AutoResume + Error Surface
**Effort**: Small (1 day)  
**Impact**: Medium

P62 Recovery handles error sessions. AutoResume handles interrupted sessions. Error Surface just logs. These are three subscribers checking `session_end` with different status filters. Merge into one `createRecoveryHandler()`:

```typescript
function createRecoveryHandler(opts: RecoveryOpts): Subscriber {
  return (event) => {
    if (event.type !== "session_end") return;
    if (event.status === "interrupted") handleAutoResume(event, opts);
    else if (event.status === "error") handleDropRecovery(event, opts);
    // Error surface logging happens in both branches
  };
}
```

### Proposal 3: Remove Double Escalation
**Effort**: Small (half day)  
**Impact**: Medium

Remove `escalateBlockedSession()` from handleCompletionInner. Let the anonymous escalation subscriber (which has the digest classifier) be the sole escalation path. The inline version is the legacy path that predates the classifier.

**Alternatively**: Remove the anonymous subscriber and keep the inline path. But the inline path doesn't have the classifier, so the subscriber version is more capable.

### Proposal 4: Move Anonymous Subscribers to Named Factories
**Effort**: Small (1 day)  
**Impact**: Medium (maintainability)

The 5 anonymous `bus.subscribe((event) => { ... })` blocks in may.ts are:
- Hard to test in isolation
- Hard to reason about ordering
- Inconsistent with the named subscriber pattern in session-subscribers.ts

Move them to named factory functions in session-subscribers.ts, following the same pattern as `createContextUpdater`, etc.

### Proposal 5: archiveSession() — Delete Dead Code
**Effort**: Trivial (15 min)  
**Impact**: Low (hygiene)

`archiveSession()` in persistence.ts is defined but **never called** anywhere in the codebase. The comment in manager.ts (line 629) says "Sessions stay in sessions/<id>/ — no archiving." Yet 17,222 sessions exist in history/. This function is dead code that creates a misleading implication that archiving is active.

**Action**: Delete `archiveSession()` or document when/how history/ sessions get there (possibly from a manual/external process).

---

## Priority Ranking

| # | Proposal | Effort | Impact | Priority |
|---|----------|--------|--------|----------|
| 3 | Remove double escalation | S | M | **P1 — bug-adjacent** |
| 5 | Delete archiveSession dead code | XS | L (clarity) | **P1 — quick win** |
| 2 | Merge recovery subscribers | S | M | **P2** |
| 4 | Named subscriber factories | S | M | **P2** |
| 1 | Unify status persistence | M | H | **P3 — highest value but highest risk** |

---

## Summary

The completion.ts pipeline itself is well-designed — 5 focused pure(ish) functions with a clean output contract (SessionOutcome → SessionInfo). The decomposition earns its keep.

The **subscriber layer** is where the complexity explodes: 11 subscribers with no ordering guarantees, triple-redundant status writes, double escalation, and a mix of named factories and anonymous inline handlers. The bus architecture is sound in principle (decoupled side effects), but the implementation has accreted duplicate logic that the original extraction from manager.ts was meant to eliminate.

The most impactful single change would be **removing the double escalation** (Proposal 3) — it's the only one that's arguably a bug rather than just technical debt.
