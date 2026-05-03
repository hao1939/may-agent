# EXP-575: Edit Failure Rate Audit

**Date**: 2029-05-04
**Purpose**: Determine if verify-after-edit is still needed by measuring actual edit failure rate
**Decision criterion**: If edit failure rate <2%, close EXP-575 as SOLVED-BY-PROXY (per alternative analysis Option 5)

## Method

Searched all session transcripts with timestamps starting `s_17777*` (most recent ~1700 sessions) for:
- **Successes**: "Edit applied" or "✅ Edit" 
- **Rejections**: "oldText not found", "does not match", "no exact match", "EDIT_REJECTED"

## Results

| Metric | Count |
|--------|-------|
| Successful edits | 653 |
| Rejected edits | 91 |
| **Total edit attempts** | **744** |
| **Edit failure rate** | **12.2%** |

## Analysis

**H0 REJECTED**: Edit failure rate is 12.2%, far above the 2% threshold for closing as solved-by-proxy.

This means:
1. **EXP-500's pre-read injection did NOT solve the problem** — edits still fail at a meaningful rate
2. The `edit()` tool's internal rejection (ambiguous match, text not found) catches these failures *before* they corrupt files
3. However, agents waste ~91 tool calls on failed edits that could be prevented by reading first
4. Verify-after-edit remains valuable — not to catch silent corruption, but to confirm edits applied correctly before proceeding

## Key Insight

The nature of edit failures has shifted:
- **Old problem** (pre-EXP-500): Edits applied to wrong content → silent corruption
- **Current problem**: Edits rejected by tool → wasted calls, retry loops, context waste

The edit tool's built-in validation means **silent corruption is near-zero** (the tool rejects bad edits rather than applying them wrong). But the 12.2% rejection rate means agents are frequently attempting edits with stale/incorrect oldText.

## Implications for EXP-575

| Option | Verdict |
|--------|---------|
| Close as SOLVED-BY-PROXY | ❌ REJECTED — 12.2% >> 2% threshold |
| Pursue structural auto-verify | ⚠️ Less urgent — failures are LOUD (tool rejects), not SILENT |
| Refocus on pre-edit read | ✅ RECOMMENDED — reducing the 12.2% rejection rate via mandatory read-before-edit |

## Recommendation

**Pivot EXP-575 from "verify-after-edit" to "read-before-edit enforcement"**

The real problem isn't unverified edits (the tool verifies internally). The real problem is **stale context leading to edit rejections** (12.2% of all edits). EXP-500's pre-read injection was supposed to fix this, but clearly hasn't eliminated it.

### Next steps:
1. Investigate which agents have highest edit rejection rates
2. Determine if rejections cluster in specific patterns (e.g., editing files modified by concurrent sessions)
3. Consider: Is the 12.2% rate from gym scenarios (synthetic) or production sessions?

## Status

**EXP-575 remains OPEN but REFRAMED**: 
- Original framing: "verify after edit to catch silent corruption" → LOW PRIORITY (tool prevents corruption)
- New framing: "reduce 12.2% edit rejection rate via better pre-edit reading" → MEDIUM PRIORITY (waste reduction)
- Deprioritized to P2 pending deeper investigation of rejection patterns
