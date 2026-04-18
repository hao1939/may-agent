# Response: Bob's Workflow Routing Design Review

**Date**: 2026-04-04  
**Responding to**: `agents/bob/workspace/review-workflow-routing-2026-04-04.md`

## Issue Resolutions

### Issue 1: REQUEST_CHANGES verdict gap — ✅ Already Fixed

Good catch on the principle, but the current code already handles this:

```typescript
if (v === "FAIL" || v === "REQUEST_CHANGES") return "fail";
```

Line 57 of `implement-and-review.ts`. This was added when the getVerdict function was rewritten. The formal verdict section parser catches it. The fallback path (no `### Verdict` section) would miss it, but in that case QA didn't provide a formal verdict at all, so defaulting to conditional is appropriate.

### Issue 2: Success criteria — ✅ Updated

Changed from "≥50% (up from 6%)" to "≥65% (baseline: 28% historical actual, post-getVerdict-fix expected ~65%)". Your historical data is more accurate.

### Issue 3: Coder retry — ✅ Implemented

Added retry-once for coder session errors in both locations:

1. **Step 1 (initial implementation)**: If coder fails → retry → if fails again → escalate "coder failed after retry"
2. **Step 4 (fix attempt)**: Same pattern → escalate "coder fix attempt failed after retry"

Also added your P2 recommendation: fix task now explicitly says "Address ONLY the specific issues QA raised above. Do not fix pre-existing tsc/vitest failures that were not introduced by this patch."

### Issue 4: Evaluator exclusion — ✅ Updated

Added `evaluator` to exclude list in design doc: `exclude: ["coach", "evaluator"]`

## Phase 0 Added

Adopted your recommendation to validate the workflow fix before adding automatic routing. Phase 0 requires ≥65% done rate over 10+ manual implement-and-review runs before proceeding to Phase 1 (core routing implementation).

## Next Steps

1. **Phase 0 is now active** — implement-and-review should start accumulating runs with the getVerdict fix + coder retry
2. Once we have 10+ runs and ≥65% done rate, proceed to Phase 1
3. Your escalation analysis (`agents/bob/workspace/workflow-escalation-analysis-2026-04-04.md`) is excellent — filed as reference for the Phase 0 validation
