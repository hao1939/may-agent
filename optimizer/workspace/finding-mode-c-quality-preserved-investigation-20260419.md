# Mode C: Quality-Preserved Metric Investigation

**Date:** 2026-04-19  
**Current:** 0.8975 | **Target:** 0.90 | **Gap:** 0.003

## Summary

The quality-preserved metric (AVG quality for optimizer's heuristic-scored sessions over 7d) sits at 0.897, just below the 0.9 target. The gap is driven by **66 sessions (10% of 659 total) scoring below 0.75**, with work-session and workflow-sourced call tasks being the primary drag.

## Distribution

| Bucket | Count | Avg Quality | Share |
|--------|-------|-------------|-------|
| 0.90+ | 405 | 0.991 | 61.5% |
| 0.75–0.89 | 188 | 0.826 | 28.5% |
| 0.50–0.74 | 46 | 0.645 | 7.0% |
| 0.25–0.49 | 15 | 0.312 | 2.3% |
| <0.25 | 5 | 0.104 | 0.8% |

## Root Causes (in the 66 sessions scoring <0.75)

| Issue Pattern | Count | Description |
|---|---|---|
| reasoning_mismatch | 16 | Task says do X, session does Y |
| session_error | 13 | Session crashed/errored out |
| opBudget_exhaustion | 7 | Ran out of ops before completing |
| VERIFICATION_FAILURE | 5 | Claimed success without evidence |
| shallow_session | 3 | Too few meaningful actions |
| SCOPE_BLEED | 1 | Modified files outside scope |

## Task Type Breakdown

| Task Type | Count | Avg Quality |
|---|---|---|
| heartbeat | 49 | 0.939 ✅ |
| phase2-execute | 295 | 0.927 ✅ |
| other | 17 | 0.929 ✅ |
| cron | 16 | 0.894 ⚠️ |
| **work-session** | **282** | **0.858** ❌ |

## Session Source Breakdown (call sessions only)

| Source | Count | Avg Quality |
|---|---|---|
| callAgent | 20 | 1.000 |
| **workflow** | **257** | **0.826** |

## Key Finding

**Work sessions dispatched via workflows are the primary quality drag.** They average 0.858 quality vs 0.927+ for other task types. The 282 work sessions at 0.858 pull the overall average down significantly.

Common failure modes in low-quality work sessions:
1. **Reasoning-action mismatch (16 cases):** Session diverges from assigned objective — does investigation instead of execution, writes wrong deliverable filename, etc.
2. **Session errors (13 cases):** Crashes before producing output.
3. **Op budget exhaustion (7 cases):** Runs out of budget mid-task, producing incomplete work.
4. **Verification failures (5 cases):** Claims success but evidence shows tests didn't pass or files weren't written.

## Concrete Fix Opportunities

### Fix 1: Improve work-session task clarity (high impact)
The 16 reasoning-mismatch cases suggest work-session prompts may be ambiguous. Tightening the objective/deliverable specification in work-session dispatch templates would reduce misalignment.

### Fix 2: Guard against op-budget exhaustion (medium impact)
7 sessions exhausted their op budget. Adding early "am I on track to finish?" checkpoints at ~60% budget consumption could trigger graceful partial completion instead of abrupt cutoff.

### Fix 3: Enforce verification before finish(success) (medium impact)
5 sessions claimed success without evidence. A pre-finish guard requiring read-back of deliverables would catch these.

### Impact Estimate
If the 66 low-quality sessions (<0.75) were raised to the 0.75 floor:
- Current avg: 0.897
- New avg: ~0.908 (above 0.9 target)

Even raising just the 20 lowest sessions (currently averaging 0.28) to 0.5 would push the metric to ~0.904.

## Recommendation

Focus on **work-session task template improvements** — this is the single lever that affects 282 sessions (43% of volume) and has the lowest average quality. The reasoning-mismatch pattern suggests the problem is upstream in task formulation, not in optimizer execution capability.
