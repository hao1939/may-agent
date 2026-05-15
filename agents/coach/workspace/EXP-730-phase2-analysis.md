# EXP-730 Phase 2: Dormant Gate Root Cause Analysis

**Date**: 2026-03-17 (updated)  
**Status**: COMPLETE — all 3 gates explained

## Summary

All 3 deployed structural gates (EXP-630, EXP-650, EXP-720) have zero log entries. Phase 1 identified EXP-630's `< 3` threshold as dead code. The threshold was raised to `< 5` but the gate STILL cannot fire in practice.

## Root Cause: EXP-630 (Duration Gate) — Still Dead

**Code path** (`heartbeat-data.ts:460-520`):

The scoring system:
- `turnsUsed >= 3` → +3 (BUT turnsUsed is always 0 — ctx.runAgent never populates it)
- `summaryLength >= 300` → +2
- `summaryLength >= 150` → +1
- `deliverableCount >= 2` → +2
- `deliverableCount >= 1` → +1
- `outputLength >= 1000` → +2

**Why it can't fire with threshold < 5:**
- Upstream artifact gate (EXP-520) forces agents to have ≥1 deliverable → score ≥ 1
- Most agents write summaries ≥300 chars → +2 (total ≥ 3)
- Most sessions produce output ≥1000 chars → +2 (total ≥ 5)
- With `looksTrivia = substanceScore < 5`, sessions scoring exactly 5 pass. Typical session scores 5-6.

**The `tooFewTurns` path is permanently blocked**: `turnsUsed > 0 && turnsUsed < 3` — but turnsUsed is ALWAYS 0. So `turnsUsed > 0` is always false.

**Fix needed**: Either:
1. Raise threshold to `< 7` (catches sessions with no real tool usage)
2. Remove the `turnsUsed > 0` guard (let tooFewTurns always be false — it already is)
3. Replace substance scoring with actual tool-call count from the session transcript

## Root Cause: EXP-650 (Impact-Scanning Gate)

Gate fires when multi-edit sessions have no search operations. But:
- Most agents naturally search files as part of their workflow
- The keyword detection is broad ("grep", "rg", "find" in output text)
- Any session that reads files or does bash commands will contain these keywords

**Fix needed**: Change detection from "any search keyword in output" to "search for the specific symbols that were modified" — requires semantic understanding, not keyword matching.

## Root Cause: EXP-720 (Few-Shot Injection)

Zero entries because no worker sessions have traversed this code path since deployment. The code is correct (verified via `bun -e`), but the runtime hasn't invoked it.

**Fix needed**: None — just needs time/traffic.

## Recommendation

**EXP-630 is the highest-priority fix** because:
1. It addresses a real problem (shallow sessions = 50% per EXP-710)
2. The fix is simple (threshold adjustment)
3. It's already deployed infrastructure — just needs parameter tuning

**Proposed fix**: Change `substanceScore < 5` to `substanceScore < 7` AND add a `turnsUsed === 0` bonus to the firing logic (since 0 means "unknown", it should count TOWARD trivia, not against it).

Better yet: Since `turnsUsed` is always 0 and unreliable, remove it from scoring entirely and rely only on `summaryLength + deliverableCount + outputLength`. Threshold `< 5` would then fire when:
- 1 deliverable (+1) + short summary <150 (+0) + short output <1000 (+0) = 1 → FIRES ✅
- 1 deliverable (+1) + medium summary (+1) + short output (+0) = 2 → FIRES ✅
- 1 deliverable (+1) + long summary (+2) + long output (+2) = 5 → does NOT fire
- 2 deliverables (+2) + long summary (+2) + long output (+2) = 6 → does NOT fire

This is actually reasonable! The problem is `turnsUsed >= 3` adds +3 — but turnsUsed is always 0, so it never adds. Wait — re-reading: if `turnsUsed` is 0, then `turnsUsed >= 3` is false, so no +3 bonus. That's correct.

**Revised analysis**: The gate SHOULD fire for sessions with 1 deliverable + short summary + short output (score = 1). But in practice, does this happen?

The upstream artifact gate re-prompts sessions with 0 deliverables. After re-prompt, agents typically produce ≥1 deliverable AND write a substantial summary (because the re-prompt instructions say to). So output is typically ≥1000 chars and summary ≥150 chars.

**True root cause**: The artifact gate's re-prompt ITSELF produces enough output/summary length to satisfy the duration gate. The gates are architecturally incompatible — the first gate's recovery action satisfies the second gate's threshold.

## Escalation

Escalate to tech-lead:
1. Remove `turnsUsed` from scoring (always 0, misleading)
2. Consider session-level tool-call count as a real signal (if accessible)
3. Alternative: Make duration gate run BEFORE artifact gate, or combine into a single unified quality gate

## Status

Phase 2 COMPLETE. Escalation needed.
