# Finding: session-digest.ts Write Path Flow Complexity

**File**: `src/lib/session-digest.ts` (893 LOC)
**Date**: 2026-04-16
**Severity**: Low — well-structured, minor redundancy

## Summary

The digest write path is reasonably well-organized with clear separation between CREATE/DIGEST/CLASSIFY phases. The main concern is **4 redundant entry points** that duplicate `upsertDigest()` logic, and **excessive call sites** (13+) that could benefit from consolidation.

## Q1: How many distinct code paths lead to upsertDigest()?

**13 call sites across 4 files**, plus 3 convenience wrappers that bypass it entirely:

| Caller | File | Triggers |
|--------|------|----------|
| `may.ts` L385 | `src/app/may.ts` | 1 call (cron handler) |
| `manager-retry.ts` L296 | `src/lib/manager-retry.ts` | 1 call (retry flow) |
| `manager.ts` L679,759,802,882,1267 | `src/lib/manager.ts` | 5 calls (session lifecycle events) |
| `session-subscribers.ts` L190,216,282,313 | `src/lib/session-subscribers.ts` | 4 calls via upsertDigest |
| `session-subscribers.ts` L353 | | 1 call via `createStartDigest()` (bypasses upsertDigest) |
| `session-subscribers.ts` L381 | | 1 call via `createEndDigest()` (bypasses upsertDigest) |

## Q2: Inside upsertDigest(), sequential steps and I/O count

**upsertDigest()** (L695-791) performs:

1. `getLastDigest()` — **1 DB read** (get previous step number)
2. Branch on `session_start` → `insertDigest()` — **1 DB write** + `getLastDigest()` — **1 DB read** (return). Total for start path: 2 reads + 1 write.
3. For non-start triggers:
   - `readTranscriptDelta()` — **1 file read** (session messages from disk)
   - `formatTranscriptCompact()` — pure transform
   - `llmSynthesize()` — **1 LLM call** (spawns evaluator agent) — conditional on `!what_happened && manager`
   - `extractFilesModified()` — pure transform
   - `insertDigest()` — **1 DB write**
   - `classifyDigest()` — pure logic (switch on trigger)
   - `updateDigestAction()` — **1 DB write** (conditional on CLASSIFY_TRIGGERS match)
   - `getLastDigest()` — **1 DB read** (return value)

**Total I/O for full DIGEST+CLASSIFY path**: 2 DB reads, 2 DB writes, 1 file read, 1 LLM call (max).

## Q3: Classification call chain depth

`classifyDigest()` (L608-660) is a **single-level switch statement** — no call chain at all. It maps trigger → action directly. No redundant re-classification observed.

The classifier only runs when `CLASSIFY_TRIGGERS.has(input.trigger) && what_happened` — clean guard.

## Q4: Dead branches or unreachable code

**Minor**: `createStartDigest()` (L793) duplicates the `session_start` branch of `upsertDigest()`. Both insert with `trigger: "session_start"`, step=1, outcome="in_progress". The convenience function is called from `session-subscribers.ts` L353, while `upsertDigest()` also handles `session_start` internally. This means `createStartDigest` makes the `session_start` branch in `upsertDigest` partially dead — callers use one or the other, not both.

Similarly, `createEndDigest()` (L820) duplicates the non-LLM digest path of `upsertDigest()` for the `end` trigger.

`createCheckpointDigest()` (L859) is a third convenience wrapper.

**These 3 wrappers (L793-893, ~100 LOC) could be removed** if callers used `upsertDigest()` directly — the main function already handles all cases.

## Q5: buildDigestBriefing() / read-write coupling

`buildDigestBriefing()` doesn't exist by that name. The read path uses:
- `formatDigestContext()` (L181) — reads digests via `getRecentDigests()` + `getCrossAgentDigests()` + `getUnresolvedDigests()`, formats them into context strings.

Read and write paths are **cleanly decoupled** — read functions only do SELECT queries, write functions only do INSERT/UPDATE. No shared mutable state. The only coupling is the DB schema itself (both sides reference `session_digests` table).

## Recommended Actions

1. **Low priority**: Consider removing the 3 convenience wrappers (`createStartDigest`, `createEndDigest`, `createCheckpointDigest`) and routing all callers through `upsertDigest()`. Saves ~100 LOC and eliminates the dual-path confusion. However, the convenience functions avoid the overhead of LLM-related branching, so this is a tradeoff.

2. **No action needed** on classifier — it's clean, single-level, well-guarded.

3. **The 13 call sites** across 4 files are worth watching — if digest creation logic changes, many files need updating. But this is acceptable for now given the event-driven architecture.
