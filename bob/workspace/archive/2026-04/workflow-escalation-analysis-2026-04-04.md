# Workflow Escalation Root Cause Analysis

**Date**: 2026-04-04 20:25 UTC  
**Author**: Bob (Architect)  
**Task**: Investigate workflow escalation patterns, sample runs, classify root causes  

---

## 1. Executive Summary

Of 224 total workflow runs, **93 escalated (41.5%)**. The implement-and-review workflow has a catastrophic **69% escalation rate** (59/86). Through detailed sampling of all escalated runs, I identified that **83% of "still failing" escalations were false** — the QA agent said CONDITIONAL or PASS, but the old `getVerdict` code treated these as FAIL.

The current code (committed today, April 4) contains a fix that would eliminate 29 of 59 implement-and-review escalations (49%). No runs have executed with the fix yet.

## 2. Data Overview

| Status | Count | % |
|--------|-------|---|
| done | 122 | 54.5% |
| escalated | 93 | 41.5% |
| error | 6 | 2.7% |
| interrupted | 3 | 1.3% |

### By Workflow

| Workflow | Total | Done | Escalated | Esc Rate |
|----------|-------|------|-----------|----------|
| implement-and-review | 86 | 24 | 59 | **69%** |
| diagnose-and-fix | 56 | 49 | 6 | 11% |
| growth-cycle | 60 | 35 | 18 | 30% |
| design-review | 18 | 14 | 4 | 22% |
| Other | 4 | 0 | 6 | — |

### Escalation Rate Over Time (implement-and-review)

| Week | Done | Escalated | Rate |
|------|------|-----------|------|
| W08 | 5 | 3 | 33% |
| W09 | 17 | 28 | 60% |
| W10 | 1 | 2 | 67% |
| W11 | 0 | 4 | 100% |
| W12 | 1 | 22 | **96%** |

The rate worsened dramatically, suggesting a progressive bug rather than inherent design flaw.

## 3. Escalation Reason Breakdown (93 runs)

| Reason | Count | Fixable? |
|--------|-------|----------|
| still failing after one iteration | 35 | **83% false** |
| coder failed | 12 | Session timeouts |
| step 1 failed | 11 | growth-cycle, not i-a-r |
| coder fix attempt failed | 8 | Session timeouts |
| Various other | 27 | Mixed |

## 4. Root Cause: False Escalation from CONDITIONAL Verdict

### The Bug

The `getVerdict` function's fallback logic treated ambiguous/CONDITIONAL verdicts as FAIL. When QA wrote "**CONDITIONAL** — code is correct but vitest has pre-existing failures", the workflow escalated as "still failing."

### Classification of 35 "still failing" runs

| Root Cause | Count | % |
|------------|-------|---|
| qa_conditional_treated_as_fail | 22 | 63% |
| qa_pass_treated_as_fail | 7 | 20% |
| qa_fail_but_env_issue | 4 | 11% |
| qa_fail_legitimate | 2 | 6% |

**83% (29/35) were false escalations** — QA approved the code but the workflow rejected it.

### The Fix (already in current code)

```typescript
// Old: default → "fail" 
// New: default → "conditional" (accepts the work)
```

The current `implement-and-review.ts` correctly:
1. Parses `### Verdict\n**CONDITIONAL**` → returns "conditional"
2. Treats conditional as a pass (with warning)
3. Defaults ambiguous verdicts to "conditional" instead of "fail"

### Impact Verification

Tested the current regex against ALL 35 "still failing" QA texts:
- 30/35 would correctly resolve as CONDITIONAL or PASS
- 5/35 were legitimate FAIL (3 of those for pre-existing env issues)
- **Net: 29/59 implement-and-review escalations eliminated (49%)**

## 5. Secondary Issues Found

### A. QA Over-Gating on Environment Issues (3-4 runs)

QA wrote FAIL because vitest/tsc failed due to pre-existing environment issues (missing deps, node:sqlite), not the patch. The workflow instruction now says:
> "If vitest fails, determine whether failures are caused by the patch or are pre-existing environment issues."

This was added but QA still sometimes gates on environment.

**Recommendation**: Add a `REQUEST_CHANGES` ↔ `CONDITIONAL` mapping in getVerdict. REQUEST_CHANGES (1 run) isn't handled.

### B. Coder Session Errors (20 runs)

12 "coder failed" + 8 "coder fix attempt failed" = 20 runs lost to coder session errors. Duration ranges 0.9-7.6 minutes. These appear to be session timeouts or interruptions, not code bugs.

**Recommendation**: Consider retry-once for coder errors (the fix path already exists for QA issues).

### C. Fix Attempts Chasing Pre-Existing Issues (8 runs)

The coder's fix attempts often went down rabbit holes trying to fix TS2742 errors or pre-existing test failures rather than addressing QA's actual feedback.

**Recommendation**: The fix task should explicitly say "Focus ONLY on QA's specific feedback. Do not fix pre-existing tsc/vitest failures."

## 6. Remaining Escalation Budget (Post-Fix)

If the current fix was live, the implement-and-review escalation breakdown would be:

| Reason | Count | Action |
|--------|-------|--------|
| coder failed (timeout) | 12 | Retry mechanism |
| coder fix attempt failed | 8 | Retry mechanism + focused fix prompt |
| still failing (legitimate) | 6 | Correct behavior |
| critical QA flag | 3 | Correct behavior |
| re-review failed | 1 | Edge case |

This would reduce escalation from 69% to ~35% (30/86). Adding coder retry could push it to ~12% (10/86).

## 7. Connections to Knowledge Base

### H-053 (Workflow Adoption Decay)
The 96% escalation rate in W12 may have *accelerated* adoption decay. If 96% of workflow runs escalate, agents learn that workflows are costly AND unsuccessful, creating rational disincentive. **This is a feedback loop**: bad verdict parsing → more escalations → agents avoid workflows → less data → no one notices the bug.

### KE-005 (QA Rubber-Stamping)
The QA agent's behavior here is actually NOT rubber-stamping — it's correctly identifying code as good while noting pre-existing issues. The problem is the verdict PARSER, not the reviewer.

### KE-007 (Workflow Enforcement)
The CONDITIONAL verdict mapping is itself a form of structural enforcement — it prevents QA's hedging language from triggering unnecessary escalation.

### H-001 (Adversarial QA Framing)
The workflow already uses adversarial framing ("claims to verify — do NOT trust without checking"). This produces better reviews but also more CONDITIONAL verdicts (QA hedges because pre-existing issues exist).

## 8. Recommendations (Prioritized)

### P0: Verify the fix is live
The current code hasn't been tested in production (last run was March 29, fix committed April 4). Need at least 10 implement-and-review runs to confirm the false escalation rate drops.

### P1: Add coder retry for session errors
```typescript
if (coder.status === "error") {
  const retry = await ctx.runAgent("coder", ctx.task);
  if (retry.status === "error") {
    return ctx.escalate("coder failed after retry", { ... });
  }
  // Continue with QA review of retry result
}
```
This could save 12-20 additional escalations.

### P1: Add REQUEST_CHANGES to getVerdict
```typescript
if (v === "REQUEST_CHANGES") return "fail"; // or "conditional" depending on intent
```

### P2: Focus fix prompts
Add to the fix task: "Address ONLY the specific issues QA raised. Do not fix pre-existing tsc/vitest failures that were not introduced by this patch."

### P2: Track escalation rate as a health metric
The system should have a dashboard showing escalation rate by workflow per week. The 33% → 96% progression should have triggered investigation much sooner.

---

*Filed as research note. Cross-reference: H-053, KE-005, KE-007, EXP-020.*
