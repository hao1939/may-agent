# Audit: Digest System Dead Weight

**Date**: 2026-04-11  
**Lens**: C (Dead Weight)  
**Scope**: session-digest.ts, classify-error.ts, session-subscribers.ts, completion.ts, may.ts digest paths  
**Evidence**: may.db (6,422 digest rows, 2,801 sessions)

---

## 1. Three Digest Write Paths — Are ALL Used?

### Path 1: `createDigestWriter` subscriber (session-subscribers.ts)
- **Triggers**: `session_start` (2,801 rows), `end` (2,799 rows)
- **Status**: ✅ **ACTIVE** — primary write path, responsible for 87% of all digest rows

### Path 2: Inline in may.ts — Recovery + Escalation
- **Triggers attempted**: `recovery_requeue`, escalation via `classifyDigest()`
- **Status**: ⚠️ **PARTIALLY DEAD**
  - `recovery_requeue`: **0 rows in DB** — the code exists (may.ts ~line 415) but the path never triggers because digest-classified actions always have `action` set, so recovery uses the digest action directly without writing a new digest row
  - Escalation subscriber (may.ts ~line 478): Reads digests but doesn't write them. Uses `classifyDigest()` to re-classify at read time. Not a write path — just a consumer.

### Path 3: Inline in manager.ts — Timeout, Overflow, Zombie
- **Triggers**: `timeout` (0 rows), `overflow` (0 rows), `zombie_cleanup` (2 rows)
- **Status**: ⚠️ **MOSTLY DORMANT**
  - `timeout`: 0 rows — no sessions have timed out (timeout may not be configured for most agents)
  - `overflow`: 0 rows — overflow sessions get handled before this digest is written (the session is already dead)
  - `zombie_cleanup`: 2 rows — extremely rare but functional when triggered

### Path 4: `createCheckpointDigest` (checkpoint.ts tool)
- **Trigger**: `checkpoint` (426 rows)
- **Status**: ✅ **ACTIVE** — 6.6% of all digest rows

### Path 5: `upsertDigest` via session-subscribers.ts — Stuck/Circuit-break/Auto-resume
- **Triggers**: `stuck_detected` (18), `circuit_break` (3), `auto_resume` (62), `infra_retry` (311)
- **Status**: ✅ **ACTIVE** — these are the LLM synthesis and classification paths

### Summary of Write Paths

| Path | Source | Rows | % | Dead? |
|------|--------|------|---|-------|
| createDigestWriter (start) | session-subscribers.ts | 2,801 | 43.6% | No |
| createDigestWriter (end) | session-subscribers.ts | 2,799 | 43.6% | No |
| checkpoint | checkpoint.ts tool | 426 | 6.6% | No |
| infra_retry | manager-retry.ts | 311 | 4.8% | No |
| auto_resume | session-subscribers.ts | 62 | 1.0% | No |
| stuck_detected | session-subscribers.ts | 18 | 0.3% | No |
| circuit_break | session-subscribers.ts | 3 | 0.05% | No |
| zombie_cleanup | manager.ts | 2 | 0.03% | No |
| timeout | manager.ts | 0 | 0% | **Dormant** |
| overflow | manager.ts | 0 | 0% | **Dormant** |
| recovery_requeue | may.ts | 0 | 0% | **Dead** |

---

## 2. Unused Classifier Functions and Exports

### `logShadowComparison()` — Phase 3 artifact, still active
- **Purpose**: Log shadow comparisons between existing recovery action and digest classifier recommendation
- **Origin**: Phase 3 (shadow mode) — described in JSDoc as "Used during Phase 3 to observe classifier accuracy before switchover"
- **Current state**: Phase 4a/4c switchover is COMPLETE. The classifier IS the decision-maker now, not a shadow.
- **6 call sites**: manager.ts (timeout ×1, overflow ×1, zombie_cleanup ×1), session-subscribers.ts (stuck_detected ×1, resume_exhausted ×1)
- **Impact**: These calls compare the "existing action" (hardcoded string) against the digest action. Since the digest classifier is now THE decision-maker, these shadow logs compare against a fictional "what the old system would have done" — **informational only, zero operational value**.
- **Recommendation**: **REMOVE** — `logShadowComparison()` + all 5 call sites. ~30 lines.

### `classifyError` triple re-export
- **classify-error.ts** → original definition ✅
- **index.ts** → re-export (consumed by may.ts, agent-loader.ts) ✅
- **requests.ts** → re-export (consumed by manager-agents-tool.ts) ✅
- **manager.ts** → re-export (consumed by **NOTHING**) ❌

**Recommendation**: Remove `export { classifyError } from "./classify-error.js"` from `manager.ts` (line 95) + dead comments on lines 91, 94.

### CLASSIFY_TRIGGERS — 5 of 9 triggers never fire
Of the 9 triggers in the `CLASSIFY_TRIGGERS` set:
- **Active** (have rows): `stuck_detected` (18), `circuit_break` (3), `zombie_cleanup` (2), `auto_resume` (62)
- **Dormant** (code exists, 0 rows): `timeout`, `overflow`
- **Never written** (no code writes them): `resume_exhausted`, `session_end_blocked`, `session_end_failure`

Wait — `resume_exhausted` IS written by `createAutoResume` in session-subscribers.ts but the DB shows 0 rows. This means no session has ever exhausted all resume attempts. Similarly, `session_end_blocked` and `session_end_failure` are NOT digest triggers — they're used as arguments to `classifyDigest()` in may.ts's escalation subscriber, but that subscriber doesn't write digests with those triggers.

**Not dead — just dormant.** Keep in CLASSIFY_TRIGGERS since the code paths exist and can fire under error conditions.

---

## 3. Orphaned Digest Infrastructure

### `recovery_requeue` digest write (may.ts ~line 415)
The inline digest write after successful requeue:
```typescript
upsertDigest(PERSIST_DIR, {
  sessionId: info.sessionId,
  agent: info.agent,
  trigger: "recovery_requeue",
  what_happened: `Recovery requeue attempt ${attempts + 1}/${MAX_RECOVERY_ATTEMPTS} (${source}): ...`,
  details: { attempt: attempts + 1, ... },
}).catch(() => { /* best-effort */ });
```
**0 rows in production.** The path fires (recovery does happen — the bus emits info messages about requeues) but the async `upsertDigest` likely silently fails because the original session's digest state has already been finalized. Or the `recovery_requeue` trigger doesn't match any of the early-return paths in `upsertDigest`.

Actually — looking more carefully: `recovery_requeue` IS NOT a `session_start` trigger, so it hits the LLM synthesis path but no `manager` is passed (may.ts calls `upsertDigest(PERSIST_DIR, {...})` without a manager argument). Without a manager, and without `what_happened` pre-provided... wait, `what_happened` IS provided. So it should insert. The `.catch(() => {})` silently swallows any error.

**Likely explanation**: Recovery requeues DO happen (logged via bus.emit info messages) but the digest write fails silently. Zero rows confirms this is effectively dead.

**Recommendation**: Either fix the silent failure or remove the dead write. Low priority — the data it would produce is purely informational.

### LLM Synthesis Functions — Used but only internally
- `llmSynthesize()` — called by `upsertDigest()` when `what_happened` is not pre-provided
- `parseDigestResponse()` — called by `llmSynthesize()`
- `readTranscriptDelta()` — called by `upsertDigest()` for transcript reading
- `formatTranscriptCompact()` — called by `upsertDigest()` for transcript formatting
- `extractFilesModified()` — called by `upsertDigest()` for file extraction

These are all private (non-exported) and only called from within session-digest.ts. They serve the stuck_detected, circuit_break, and zombie_cleanup paths (18 + 3 + 2 = 23 LLM-synthesized digests). **Low volume but functional. Not dead.**

### `DigestInput` and `DigestAction` types — fully consumed
- `DigestInput`: Used by `upsertDigest()` parameter
- `DigestAction`: Return type of `classifyDigest()`, used by may.ts and session-subscribers.ts
- `DigestRow`: Used everywhere — context injection, recovery, escalation

---

## 4. Redundant Fields in the Digest Schema

### `task` column — write-heavy, read-light
- **Populated**: On every row (via `last?.task ?? input.task`)
- **Read by**: `formatDigestEntry()` → used as fallback display text when `what_happened` is null
- **In practice**: `what_happened` is null only on `session_start` rows (2,801) and a few infra_retry/auto_resume (7). But `session_start` rows are never displayed via `formatDigestContext()` (query filters for `trigger IN ('end', 'checkpoint')`).
- **Conclusion**: The `task` column is carried forward from row to row and displayed only as a fallback label. It's **marginally useful** — the fallback path does fire when `what_happened` is null on displayed rows, but that's extremely rare now (7/6422 = 0.1% of rows, and none of those are 'end' or 'checkpoint' triggers).
- **Not removable** without risk — it serves as the only display text for the (rare) rows that lack what_happened.

### `details` column — write-heavy, barely read
- **Written**: On 3,621 of 6,422 rows (56%)
- **Read by**: ONLY `formatDigestEntry()` line 237, which extracts `details.duration` for display
- **Common keys**: `duration, turnCount, opCount` (end digests), `consecutiveErrorTurns` (stuck), `attempt, maxAttempts, reason` (retry)
- **Only `duration` is extracted** — all other keys in `details` are stored but **never read back**
- **Conclusion**: `details` is a write-only JSON blob for most of its content. Only `duration` matters. However, the column serves as a debug/forensics tool — it's low-cost to keep.

### `action` + `action_reason` columns — sparse but critical
- **Populated**: Only 62 of 6,422 rows (1%)
- **Read by**: may.ts recovery subscriber (line 387-390), `logShadowComparison()` call sites
- **These are the decision output** of the classifier. Sparse but operationally critical — they drive recovery decisions.
- **Not redundant.**

### `outcome` column — heavily used
- **Populated**: 6,050 of 6,422 rows
- **Read by**: `getUnresolvedDigests()`, `classifyDigest()`, `formatDigestEntry()`
- **Not redundant.**

### `still_open` column — sparse but valuable
- **Populated**: 66 of 6,422 rows (1%)
- **Read by**: `getUnresolvedDigests()`, `classifyDigest()`, `formatDigestEntry()`
- **Drives** "Unresolved Items" section in context injection
- **Not redundant.**

---

## 5. Summary of Findings

### Dead Code (safe to remove)
| Item | Location | Lines | Impact |
|------|----------|-------|--------|
| `logShadowComparison()` function | session-digest.ts:664-678 | ~15 | Phase 3 artifact, shadow mode complete |
| `logShadowComparison()` call sites | manager.ts (3), session-subscribers.ts (2) | ~15 | Phase 3 artifact |
| `logShadowComparison` import | session-subscribers.ts:14 | partial line | Dead import after removal |
| `logShadowComparison` import | manager.ts:88 | partial line | Dead import after removal |
| `classifyError` re-export from manager.ts | manager.ts:91-95 | ~5 | Zero consumers |
| `recovery_requeue` digest write | may.ts:~415-420 | ~8 | 0 rows produced, silently fails |

**Total removable: ~43 lines**

### Dormant but not dead (keep)
- `timeout` and `overflow` triggers in CLASSIFY_TRIGGERS — code paths exist, just haven't fired yet
- LLM synthesis functions — serve 23 real digest rows (stuck/circuit/zombie)
- `task` column — fallback display, extremely rare but functional
- `details` column — mostly write-only but useful for forensics

### Not dead (fully active)
- All 3 main write paths (createDigestWriter, checkpoint, recovery triggers)
- `classifyDigest()` — used by may.ts recovery + escalation
- `classifyError()` — used by may.ts Tier 2 fallback + manager-agents-tool.ts
- Context injection chain: getRecentDigests → getCrossAgentDigests → getUnresolvedDigests → formatDigestContext
- All DigestRow fields except `details` (which is partially read)

### Architecture observation
The digest system is **well-factored with minimal dead weight**. The main waste is the Phase 3 shadow comparison infrastructure (~30 lines) that stayed after switchover to Phase 4. The `recovery_requeue` write is a silent failure (~8 lines). Everything else is either actively used or dormant-but-reasonable.
