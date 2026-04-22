# EXP-200 Results: Belief Externalization for Verification Gravity Wells

**Date**: 2026-06-22
**Status**: DEPLOYED — AWAITING DATA

## Implementation

Belief externalization block (BELIEVE/UNCERTAIN/FALSIFY) successfully added to `buildReviewPrompt()` in `agents/shared/workflows/project.ts` at lines 418-420.

## Observations (as of deployment day)

- **Code confirmed deployed**: grep confirms the 3-line belief block is present in the review prompt builder.
- **No reviewer outputs observed yet**: Search of checkpoint files, session logs, and session DB found zero instances of reviewers producing BELIEVE/UNCERTAIN/FALSIFY blocks.
- **Likely reason**: No active projects have triggered the project review workflow since deployment. Both bob projects are blocked; other agents' projects may not have had review iterations.

## Next Steps

- [ ] Wait for ≥10 project review iterations to accumulate
- [ ] Search session outputs for BELIEVE/UNCERTAIN/FALSIFY blocks
- [ ] Qualitative analysis: did belief statements catch any incorrect assumptions?
- [ ] Decision: scale up or abandon

## Interim Assessment

The intervention is zero-cost (prompt-only, ~50 tokens). No reason to remove it. Will check back in 2-3 heartbeats for accumulated data.
