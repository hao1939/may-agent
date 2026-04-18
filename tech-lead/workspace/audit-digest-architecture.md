# Audit: Session Digest / Classifier Architecture

**Date**: 2026-04-12  
**Lens**: A (Architecture)  
**Scope**: session-digest.ts (893 lines), classify-error.ts (68 lines), session-subscribers.ts (316 lines), evaluator.ts (831 lines), may.ts recovery/escalation paths  
**Evidence**: Full code reading, may.db (7,800 digest rows), production usage patterns

---

## 1. System Overview: What the Digest System Does

The digest system serves three distinct purposes:

| Purpose | Files | Consumer |
|---------|-------|----------|
| **Context injection** — Give agents memory of recent sessions | session-digest.ts (getRecentDigests, getCrossAgentDigests, getUnresolvedDigests, formatDigestContext) | manager.ts → buildSessionContext() |
| **Recovery decisions** — Decide what to do when sessions fail/stuck/interrupted | session-digest.ts (classifyDigest), classify-error.ts (classifyError) | may.ts recovery subscriber, may.ts escalation subscriber, session-subscribers.ts (stuck detector, auto-resume) |
| **Lifecycle recording** — Append-only log of session events | session-digest.ts (upsertDigest, createStartDigest, createEndDigest, createCheckpointDigest) | session-subscribers.ts (digest writer), checkpoint tool, manager.ts, may.ts |

These three purposes are cleanly layered: recording feeds context injection, and classification reads recorded data. The design is sound.

---

## 2. Architecture: Data Flow

```
Session Events (bus)
    │
    ├─ session_start → createDigestWriter → createStartDigest → INSERT (session_start)
    ├─ checkpoint    → checkpoint tool    → createCheckpointDigest → INSERT (checkpoint)
    ├─ session_end   → createDigestWriter → createEndDigest → INSERT (end)
    │
    │  [Recovery triggers — fire on error/stuck/interrupted events]
    ├─ session_end (error)       → may.ts recovery   → getLastDigest → read action → resume/requeue/escalate/nothing
    ├─ session_end (failure)     → may.ts escalation  → getLastDigest → classifyDigest() → escalate/nothing
    ├─ stuck_detected            → session-subscribers → upsertDigest(+LLM) → classifyDigest() → action
    ├─ circuit_break             → session-subscribers → upsertDigest(+LLM) → classifyDigest() → action
    ├─ auto_resume               → session-subscribers → upsertDigest(+LLM) → classifyDigest() → action
    ├─ timeout/overflow/zombie   → manager.ts          → upsertDigest(+LLM) → classifyDigest() → action
    │
    │  [Context injection — reads at session_start]
    └─ manager.buildSessionContext() → getRecentDigests + getCrossAgentDigests + getUnresolvedDigests → formatDigestContext → injected into agent prompt
```

---

## 3. Architectural Issues

### Issue A: Two Classifiers, Unclear Boundary

The system has **two classifiers** that serve overlapping purposes:

1. **`classifyDigest()`** in session-digest.ts — A pure function that maps `(outcome, still_open, what_happened, trigger)` → `DigestAction`. This is the primary decision-maker for stuck/circuit_break/auto_resume/timeout/overflow/zombie paths.

2. **`classifyError()`** in classify-error.ts — A pure string-matching function that maps error message → `"infra" | "logic" | "unknown"`. Used as Tier 2 fallback in may.ts recovery.

The **boundary is clear on paper** (digest = structured understanding, error = string matching) but the **execution path is confusing**:

- In may.ts recovery (line ~375-430): Tier 1 reads `digest.action` (pre-computed by upsertDigest during the stuck/circuit_break trigger). Tier 2 falls back to `classifyError()`.
- In may.ts escalation (line ~478-520): Reads `digest.what_happened` and re-runs `classifyDigest()` at decision time.
- In session-subscribers.ts stuck detector: `upsertDigest()` both LLM-synthesizes AND classifies in one call. The action is baked into the DB row.

So we have:
- **Pre-computed classification** (action baked into digest row at write time) — used by may.ts recovery
- **On-the-fly classification** (classifyDigest called at read time) — used by may.ts escalation
- **String-matching fallback** (classifyError) — used when no digest exists

**This is not a problem yet**, but it's a complexity trap. Three different classification strategies coexist, and the boundary of "when does which one fire?" requires reading 3 files to understand.

**Simplification opportunity**: The on-the-fly classification in may.ts escalation subscriber (~line 485-490) could pre-compute at write time like the recovery path does. This would mean all classification is baked into the DB row at write time, and readers just check `digest.action`. Removes one indirection.

### Issue B: upsertDigest() Does Too Much

`upsertDigest()` is a 90-line function that:
1. Gets the last digest for the session (DB read)
2. Reads transcript delta (file I/O)
3. Optionally runs LLM synthesis (spawns evaluator sub-agent, waits for completion)
4. Extracts files modified from messages (string parsing)
5. Inserts a new digest row (DB write)
6. Optionally classifies and updates the action (DB read + DB write)

This is a **synchronous-looking function that hides async LLM calls**. The callers in session-subscribers.ts call it with `.then()` and `.catch()`, meaning the recovery action is decided asynchronously after the event handler returns. This works but is fragile — if the LLM call takes too long, the session may have already progressed.

**Not a bug — but high complexity for a function that does three conceptually different things** (record, synthesize, classify). The "three operations" comment at the top of the file acknowledges this.

### Issue C: Evaluator and Digest System Have Parallel Transcript Parsing

Both systems parse session transcripts:
- `session-digest.ts:formatTranscriptCompact()` — lighter format for digest LLM synthesis
- `evaluator.ts:formatTranscript()` — richer format for task evaluation

Both call `readSessionMessages()` from persistence.ts. Both iterate messages and extract tool calls. The two implementations are intentionally different (digest is compact, evaluator is detailed), so this is **justified duplication**, not architectural drift.

However: the `extractFilesModified()` function in session-digest.ts manually parses tool call arguments to find file paths. The evaluator doesn't do this — it relies on `finishParams.deliverables`. Since `createEndDigest()` (called by the digest writer subscriber) already receives `filesModified` from `finishParams.deliverables`, the `extractFilesModified()` function is only needed for LLM-synthesized paths (stuck/circuit/zombie) where no finishParams exist. This is correct but means **file extraction logic is split across two code paths** — `extractFilesModified()` for abnormal endings, and `finishParams.deliverables` for normal endings.

### Issue D: Cross-Agent Digest Queries Are Expensive for Low Value

`getCrossAgentDigests()` runs a query that:
1. Fetches the last 20 `end` digests from all OTHER agents in the last 2 hours
2. For each, parses `files_modified` JSON
3. Filters by file overlap with current agent's recent files

This runs on **every session start**. With 10 agents, this is a non-trivial query. But what value does it provide?

Looking at production data:
- Cross-agent digests are injected under "### Cross-Agent Activity (last 2h)" header
- They tell Agent X: "Agent Y recently modified file Z that you also work with"
- This is **theoretically valuable for coordination** but agents rarely act on it — they re-read files anyway

**Not a removal candidate** — the coordination value is real. But the 2-hour window + 20-row scan could be tightened (1-hour window, 5-row limit) with no practical loss.

### Issue E: session-subscribers.ts Passes Manager Reference for LLM Synthesis

The `createStuckDetector()` and `createAutoResume()` functions accept a `managerOrGetter?: SubagentManager | (() => SubagentManager | undefined)` parameter. This is needed because:
- Stuck detection → needs to call LLM synthesis → needs manager to spawn evaluator
- Auto-resume → same

This creates a **circular dependency concern**: session-subscribers depend on the manager type, and the manager creates the subscribers. The code resolves this with the getter pattern (lazy deferred init), which works but is architecturally awkward.

**This is a consequence of LLM synthesis being baked into the digest write path.** If synthesis were a separate async job triggered by an event, the subscribers wouldn't need the manager reference.

---

## 4. Structural Complexity Assessment

| Metric | Value | Assessment |
|--------|-------|------------|
| Files in digest system | 3 (session-digest.ts, classify-error.ts, session-subscribers.ts) | ✅ Reasonable |
| Exported functions from session-digest.ts | 11 | ⚠️ High — could be split into modules |
| Total lines (source) | 893 + 68 + 316 = 1,277 | ⚠️ session-digest.ts is doing too much |
| Total test lines | 233 + 493 + 530 + 157 = 1,413 | ✅ Well-tested |
| DB queries | 7 (insert, update, getLastDigest, getRecentDigests, getCrossAgent, getUnresolved, plus ad-hoc in format) | ✅ Reasonable |
| LLM calls per session | 0-1 for normal sessions, 1-2 for error/stuck | ✅ Conservative |
| Number of digest triggers | 11 (session_start, end, checkpoint, stuck_detected, circuit_break, auto_resume, infra_retry, timeout, overflow, zombie_cleanup, recovery_requeue) | ⚠️ Many — but most are dormant |
| Classification entry points | 3 (pre-computed in upsertDigest, on-the-fly in may.ts escalation, classifyError fallback) | ⚠️ Confusing |

---

## 5. Simplification Recommendations

### S1: Unify Classification Entry Point (Medium — ~40 lines changed)

**Current**: Three places that make recovery decisions (upsertDigest bakes action, may.ts escalation re-classifies, classifyError falls back).

**Proposed**: All classification is baked into the digest row at write time. The may.ts escalation subscriber reads `digest.action` instead of calling `classifyDigest()` again. The `classifyError` fallback remains as a safety net for sessions that somehow have no digest (should be ~0 now).

**Benefit**: Single source of truth — "what does the system think should happen?" is always `digest.action`. No re-classification.

**Risk**: Low. The on-the-fly path in may.ts escalation currently classifies with `session_end_blocked`/`session_end_failure` triggers, which aren't written as digest triggers. Would need to write an `end_failure` or `end_blocked` digest with pre-computed action. But `createEndDigest()` doesn't classify — would need a small change.

### S2: Split session-digest.ts Into Three Modules (Medium — ~200 lines moved, no logic change)

**Current**: One 893-line file with three concerns: recording, querying/formatting, and classification.

**Proposed**:
- `session-digest-write.ts` — insertDigest, upsertDigest, createStartDigest, createEndDigest, createCheckpointDigest, LLM synthesis helpers (~400 lines)
- `session-digest-read.ts` — getLastDigest, getRecentDigests, getCrossAgentDigests, getUnresolvedDigests, formatDigestContext, formatDigestEntry, formatCrossAgentEntry, helpers (~350 lines)
- `session-digest-classify.ts` — classifyDigest, classifyError (merge classify-error.ts), CLASSIFY_TRIGGERS (~100 lines)

**Benefit**: Each file has one responsibility. classify-error.ts (68 lines) is absorbed into the classifier module rather than being a standalone file.

**Risk**: Low — pure code organization, no logic changes. Test files would need import updates.

**Trade-off**: This is a "nice to have" — the current file is large but readable. Only do this if touching session-digest.ts for other reasons.

### S3: Remove LLM Synthesis from upsertDigest (Larger — architectural change)

**Current**: `upsertDigest()` synchronously inserts a row, then optionally calls LLM synthesis, then updates the row with the synthesis result, then optionally classifies.

**Proposed**: `upsertDigest()` always inserts immediately with whatever data it has. LLM synthesis is triggered as a separate async process (e.g., a bus event). When synthesis completes, it updates the row and runs classification.

**Benefit**: 
- `upsertDigest()` becomes fast and synchronous
- session-subscribers don't need the manager reference
- Synthesis failures don't delay the digest write

**Risk**: Higher — requires event bus changes, new async flow. The current approach works and the LLM calls are fast (~2-5s). Over-engineering risk.

**Recommendation**: **Don't do this now.** The current approach works. Flag for future if upsertDigest complexity grows.

### S4: Tighten Cross-Agent Query Window (Small — 2 lines)

Change `getCrossAgentDigests(persistDir, agentName, recentFiles)` default `windowMs` from 2 hours to 1 hour, and reduce the candidate limit from 20 to 10.

**Benefit**: Faster query, same practical value (agents rarely care about 2-hour-old cross-agent changes).

---

## 6. What's NOT a Problem

### The append-only digest design
Every digest event adds a new row rather than updating existing rows. This is the right call — it creates an audit trail and avoids update conflicts from concurrent sessions.

### The two-tier recovery (digest + classifyError fallback)
This layered approach is correct. Digest classification is more precise but requires the digest system to be functional. `classifyError` is a zero-dependency fallback. The layering is clear and both tiers are tested.

### The trigger taxonomy
11 triggers seems like a lot, but each represents a genuinely different lifecycle event. They're well-documented and the mapping from trigger → response is clear in `classifyDigest()`.

### formatDigestContext() complexity
The formatting function is 60 lines with three sections (same-agent, unresolved, cross-agent) and overflow protection. This is appropriate — context injection is the most visible output of the system and needs to be well-formatted.

---

## 7. Summary

| Finding | Severity | Recommendation | Effort |
|---------|----------|----------------|--------|
| Three classification entry points | Medium | S1: Unify — bake all classification into digest rows at write time | Medium |
| session-digest.ts is 893 lines with 3 concerns | Low | S2: Split into write/read/classify modules (opportunistic) | Medium |
| upsertDigest() hides async LLM calls | Low | S3: Don't change now — works, flag for future | N/A |
| Cross-agent query window too wide | Low | S4: Tighten from 2h→1h, 20→10 candidates | Small |
| logShadowComparison dead code | Low | Already flagged in dead-weight audit — remove | Small |
| recovery_requeue silent failure | Low | Already flagged in dead-weight audit — remove | Small |

**Overall assessment**: The digest system architecture is **sound but moderately complex**. The three-purpose design (recording, context injection, recovery decisions) is well-layered. The main simplification opportunity is S1 (unify classification) which would reduce the number of "where does the decision get made?" paths from 3 to 1. S2 (file split) is nice-to-have. S3 and S4 are minor.

The system does not need a rewrite. It needs targeted cleanup (S1 + dead code removal from the previous audit).
