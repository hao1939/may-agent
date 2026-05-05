# Audit: Retry-Aware Dispatch Skill Adoption

**Date**: 2025-05-05  
**Author**: bob  
**Related**: H-EXP-067, `agents/shared/skills/retry-aware-dispatch/`

## Summary

The retry-aware-dispatch skill was deployed as a convention but marked "untested." This audit checks whether agents are actually following it.

## Findings

### 1. Zero adoption of `attempt_count` in checkpoints
```
grep -r "attempt_count" .state/checkpoints/ → 0 results
```
No agent is tagging their checkpoints with attempt counts, which is Step 3 of the protocol.

### 2. No "[Attempt N/5]" tagging in dispatches
```
grep -r "Attempt" .state/checkpoints/ → 0 meaningful results (only incidental word usage)
```
Step 4 (tag dispatches with attempt count) is not being followed.

### 3. Skill is listed in bob's context only
The skill is referenced in `agents/bob/context.md` under "Required Skills." It's unclear whether other agents (may, coach, optimizer) have it loaded, yet they are the primary dispatchers.

### 4. No blocker reports exist
The protocol says after 5+ failures, write a blocker report. No such reports were found:
```
find .state/ -name "*blocker*" → 0 results
```

## Root Cause Analysis

The skill is a **passive convention** — text that agents are supposed to read and follow. Per KE findings (SOUL.md text ≠ judgment fix, 0/18 success rate), passive text instructions don't reliably change agent behavior.

The skill needs a **structural enforcement mechanism**:
- A pre-dispatch hook that checks prior attempts
- Or a workflow wrapper that enforces the protocol

## Recommendation: EXP-068 — Structural Retry Guard

**Hypothesis**: If we add a programmatic pre-check before `agents.fork()` calls that queries prior attempts from checkpoints/session-outcomes, thrashing will decrease by >50%.

**Design**:
1. Create a shell script `.state/bin/check-prior-attempts.sh <task-keyword>` that:
   - Searches `.state/checkpoints/` and `.state/session-outcomes.jsonl` for matching tasks
   - Returns attempt count and last status
   - Exits non-zero if attempts > 5 (signaling "do not dispatch")
2. Add to dispatch workflows as a mandatory pre-step
3. Measure: count of repeated identical dispatches per 24h (baseline vs post)

**Predicted outcome**: P(success) = 0.6 — structural fixes have worked before (EXP-263 post-fix review guard +40pp), but dispatch is harder to intercept than finish().

## Status

- Skill deployed: ✅ (text exists)
- Skill adopted: ❌ (zero evidence of use)
- Structural fix needed: ✅
- Next step: Build `check-prior-attempts.sh` and propose as workflow pre-step
