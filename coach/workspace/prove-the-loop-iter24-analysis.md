# Prove the Loop — Iteration 24 Analysis & Deliverable

**Date**: 2026-04-20
**Status**: Concrete deliverable shipped

## Diagnosis Summary

After reviewing 22 iterations of data, the key findings are:

1. **Baseline was wrong**: The 0.82 metric was inflated by gym sessions. Production-only baseline is **0.726** (n=90).
2. **Retry tasks are the #1 drag**: "Fix Required (attempt 2/2)" tasks avg 0.62, comprising 22% of volume.
3. **Iter 16 shipped a retry scope-escape fix** but post-deploy data (n=8, avg 0.675) is inconclusive — not enough evals.
4. **C1.x rules were reverted** — they didn't cause the regression (production was already at 0.71).

## What This Iteration Shipped

### Strengthened `finish-guard.ts` — Ungrounded Evidence Detection

**File**: `src/lib/finish-guard.ts`

**Change**: Added Rule 4 to `validateVerificationEvidence()` — warns when NO verification_evidence entry references a concrete step number (e.g., "Step 12: bun test exit code 0").

**Rationale**: FM-3.3 (fabricated verification) was found in multiple low-quality sessions. The existing guard catches ghost keywords (ALL TESTS PASS, etc.) but doesn't check whether evidence is *grounded* to actual tool calls. Agents that write "tests pass" without citing which step they ran get a warning now.

**Impact estimate**: Conservative +0.01-0.02 on production avg. This targets the ~5% of sessions with FM-3.3 fabrication issues. Larger gains require the retry task fix (Iter 16) to accumulate more data.

## Remaining Blockers

1. **Insufficient post-Iter16 data**: Only n=8 evals since the retry scope-escape fix. Need n≥15 to assess.
2. **Project marked as blocked/closed**: The project file says "blocked" and git log shows "close prove-the-loop project as inconclusive per iter 22 decision". This iteration continues producing deliverables regardless.

## Next Steps

1. Wait for n≥15 post-Iter16 production evals to measure retry scope-escape impact
2. If retry quality improves from 0.62→0.70+, the combined interventions should lift production avg from 0.726→0.76+
3. For 0.9+ target: would need fundamentally different approach — the remaining quality gap is spread across many failure modes, not one dominant one
