# Finding: session-digest.ts Architecture Review (893 LOC)

**Lens**: A (System Architecture)  
**Date**: 2026-04-16  
**File**: `src/lib/session-digest.ts`

## Summary

The file is well-organized around a single domain concept (session digests) with 6 logical sections separated by comment headers. Cohesion is reasonable — all code relates to creating, querying, formatting, and classifying digests. However, at 893 LOC with 11 exported functions, it's approaching the threshold where a split would improve navigability. The prior Lens C findings (classifyError re-export, recovery_requeue write) appear to have been cleaned up; `logShadowComparison` remains but is actively used.

## Responsibilities (6 sections)

| Section | Lines (approx) | Functions |
|---|---|---|
| Types & constants | 1-67 | DigestRow, DigestInput, DigestAction, CLASSIFY_TRIGGERS |
| DB queries | 68-180 | getLastDigest, getRecentDigests, getCrossAgentDigests, getUnresolvedDigests |
| Formatting | 181-335 | formatDigestContext + 4 private helpers |
| Transcript processing | 400-515 | formatTranscriptCompact, readTranscriptDelta, extractFilesModified (all private) |
| LLM synthesis | 516-602 | llmSynthesize, parseDigestResponse (both private) |
| Classification + entry points | 603-893 | classifyDigest, logShadowComparison, upsertDigest, createStartDigest, createEndDigest, createCheckpointDigest |

**Assessment**: Cohesion is acceptable — everything orbits "session digests." The formatting section (155 lines) and DB query section (112 lines) are the best split candidates if the file grows further.

## Entry Points & Consumers

| Export | Consumers |
|---|---|
| `upsertDigest` | manager.ts, manager-retry.ts, session-subscribers.ts, may.ts |
| `logShadowComparison` | manager.ts (3 call sites), session-subscribers.ts (2 call sites) |
| `getRecentDigests`, `getCrossAgentDigests`, `getUnresolvedDigests`, `formatDigestContext` | manager.ts (session context building, L565-570) |
| `createStartDigest`, `createEndDigest` | session-subscribers.ts |
| `createCheckpointDigest` | tools/checkpoint.ts |
| `getLastDigest`, `classifyDigest` | may.ts |

All 11 exports are actively consumed. No dead exports.

## Prior Lens C Findings Status

- **classifyError re-export**: ✅ Cleaned up (no reference in file)
- **recovery_requeue write**: ✅ Cleaned up (no reference in file)  
- **logShadowComparison**: Still present (L664-677). Still actively called from 5 sites across manager.ts and session-subscribers.ts. This is a Phase 3 shadow-mode artifact — it only logs comparisons, never acts on them. **Recommend reviewing whether shadow mode data has been collected long enough to graduate or remove.**

## Coupling Assessment

- **Appropriate**: Imports `getDb` from requests.ts, `readSessionMessages` from persistence.ts, `SubagentManager` type from manager.ts, `log` from log.ts. All are thin, well-defined interfaces.
- **LLM coupling**: `llmSynthesize` calls `manager.run("evaluator", ...)` — couples digest creation to evaluator agent availability. This is fine; the function has a try/catch fallback.
- **No circular deps**: manager.ts imports from session-digest.ts but session-digest.ts only imports the SubagentManager type (not the module).

## Observations

1. **logShadowComparison is pure logging** (L664-677): 14 lines, no side effects beyond `log("info", ...)`. If shadow comparison phase is complete, this and all 5 call sites can be removed in one cleanup pass (~30 lines total across files).

2. **Formatting section is the largest chunk** (~155 lines, L181-335): `formatDigestContext` and its 4 helpers handle all text rendering. If digest formatting grows (e.g., new display contexts), this is the natural extraction point into a `session-digest-format.ts`.

3. **File is well-structured**: Clear section headers, private helpers stay private, types are co-located. No immediate action needed.

## Severity: LOW

No architectural problems. The file is well-organized, all exports are consumed, prior dead code was cleaned up. The only actionable item is evaluating whether `logShadowComparison` shadow mode has served its purpose.

## Recommended Actions

- **Follow-up (P2)**: Review shadow comparison logs to decide if `logShadowComparison` can be removed (classifier graduated) or needs to stay (still collecting data).
- **No split needed now**: At 893 LOC with good section boundaries, the file is maintainable. Revisit if it grows past ~1100 LOC.
