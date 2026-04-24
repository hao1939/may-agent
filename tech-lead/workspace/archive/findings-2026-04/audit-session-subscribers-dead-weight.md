# Audit: session-subscribers.ts Dead Weight

**Date**: 2026-04-14  
**Auditor**: Scout (Lens C)  
**File**: `src/lib/session-subscribers.ts` (288 lines)  
**Context**: Apr 12 cleanup removed eval paths 2-3 (809 lines) and Apr 11 removed activity/progress writers. What's left orphaned?

---

## Subscriber Inventory

All 5 subscribers registered in `may.ts` lines 216-238:

| # | Subscriber | Event | Purpose |
|---|-----------|-------|---------|
| 1 | `createContextUpdater` | session_end | Applies `context_updates` from finish() to `agents/<name>/context.md` |
| 2 | `createRequestTracker` | session_end | Tracks `new_items` and fuzzy-matches `completed_items` against pending requests |
| 3 | `createDigestWriter` | session_start, session_end | Creates start/end digest entries via `session-digest.ts` |
| 4 | `createStuckDetector` | session_start, turn_end, session_end | Counts consecutive error-only turns, cancels at threshold 6 |
| 5 | `createAutoResume` | session_end (interrupted) | Retries interrupted sessions with backoff, escalates after 2 failures |

---

## Finding 1: NO Dead Subscribers (Post-Cleanup)

The Apr 11 commit (`80a490b`) already removed the dead subscribers:
- `createActivityWriter` (wrote `workspace/activity.jsonl` nobody reads)
- `createProgressWriter` (wrote `workspace/progress.md` nobody reads)

The Apr 12 commit (`dc40c1d`) removed dead evaluation paths from `evaluator.ts` but did **not** leave orphaned subscribers — the evaluation code was inline in `evaluator.ts`, not subscriber-based.

**Verdict**: All 5 remaining subscribers are actively used. No dead subscribers.

---

## Finding 2: Shadow Comparison Logging — Vestigial Phase 3 Artifact

`logShadowComparison()` is called in two subscribers:
- **StuckDetector** (line 192): logs comparison on `stuck_detected` trigger
- **AutoResume** (line 284): logs comparison on `resume_exhausted` trigger

Also called in `manager.ts` for timeout, overflow, and zombie_cleanup.

This was a **Phase 3 shadow classifier** mechanism — comparing the digest classifier's recommendation against the hardcoded action to validate the classifier before trusting it. But as of now:

- **Phase 4a** (StuckDetector): Already trusts the classifier for `circuit_break` decisions (lines 209-230). The `stuck_detected` shadow log (line 192) is vestigial — it logs but the system doesn't act on `stuck_detected` anyway (it's just a warning).
- **Phase 4c** (AutoResume): Already trusts the classifier for `auto_resume` decisions. The `resume_exhausted` shadow log (line 284) is pure telemetry noise — the system always escalates on exhaustion regardless.

**Impact**: ~10 log lines per day of "shadow comparison" data nobody analyzes. Low cost but dead telemetry.

**Recommendation**: Remove `logShadowComparison` calls from subscribers (and eventually from manager.ts) once confidence in the classifier is established. Or, if shadow validation is still desired, pipe it to a queryable table instead of log noise.

---

## Finding 3: Triple-Write Pattern for Session Status

Session status is written in **three places** on session_end:

1. **persistence.ts** `updateSessionStatus()` → writes `meta.json` (called by `handleCompletionInner` in manager.ts, line 842)
2. **DbWriter** `handler()` → writes SQLite `sessions` table (lines 44-50 of db-writer.ts)
3. **DigestWriter** `createEndDigest()` → writes SQLite `session_digests` table with outcome field

These are NOT duplicates — they serve different consumers:
- `meta.json`: crash recovery (process restart reads meta to reconstruct state)
- `sessions` table: request tracking, cron queries, dashboard
- `session_digests` table: LLM-synthesized summaries for context injection

**Verdict**: Intentional fan-out, not redundancy. All three have distinct readers.

---

## Finding 4: RequestTracker Overlap with DbWriter

Both write to the requests system:
- **DbWriter**: Tracks `message_created` events as new requests (line 53)
- **RequestTracker**: Tracks `new_items` from finish() as self-assigned requests, fuzzy-matches `completed_items` to mark requests COMPLETED

These handle **different data sources** — no overlap. DbWriter handles inter-agent messages; RequestTracker handles the finish() payload. Distinct, complementary.

---

## Finding 5: StuckDetector Complexity — Classifier Decision Matrix Has a Bug

The StuckDetector's Phase 4a decision matrix (lines 209-230) has this logic:

```typescript
if (action === "kill" || action === "nothing") {
  emitCancel(event.sessionId, reason);  // kills the session
}
```

Note: `action === "nothing"` **still kills the session**. This means the classifier's "nothing" recommendation (do nothing, let it continue) is treated identically to "kill". This is likely a Phase 3→4 migration bug where "nothing" was the old hardcoded action and the mapping wasn't updated.

**Impact**: If the classifier recommends "do nothing" for a stuck session, the system kills it anyway. The classifier's nuance is lost.

**Severity**: Medium — the classifier rarely says "nothing" for circuit_break, but when it does, the intent is wrong.

---

## Summary

| Finding | Severity | Action |
|---------|----------|--------|
| No dead subscribers | ✅ Clean | None needed |
| Shadow comparison logging vestigial | Low | Remove or redirect to queryable store |
| Triple-write is intentional | ✅ Clean | None needed |
| RequestTracker vs DbWriter complementary | ✅ Clean | None needed |
| StuckDetector "nothing" maps to kill | **Medium** | Fix: "nothing" should skip cancel, like "resume" |

**Overall**: The subscriber file is clean post-cleanup. The two actionable items are (1) shadow comparison log removal and (2) the StuckDetector "nothing"→kill mapping bug.
