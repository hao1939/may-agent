# Finding: Coach EXP-176 Session Archaeology (120-op + 109-op)

**Date**: 2026-04-17  
**Mode**: A (Session Archaeology)  
**Sessions**: s_1776372782666_94 (120 ops), s_1776376407934_121 (109 ops)

## Summary

Two coach work sessions consumed 229 ops (~$11) on EXP-176, a scout→coder scenario design experiment. Both sessions are rated "good" (q=0.75, e=0.8) and delivered results — **this is productive work, not waste**. The high op count is inherent to the task type (scenario creation + iterative gym validation).

## What EXP-176 Does

EXP-176 is designing a two-phase scout→coder gym scenario with a target 20-40% baseline pass rate. The goal is to test whether scout analysis quality interventions improve coder outcomes.

- **Session 1** (120 ops): Found/created scout-coder scenarios, investigated why cascading-fix-trap-v2 always fails (0/92 floor effect from EXP-175), designed new scenarios
- **Session 2** (109 ops): Continuation — refined scenario, ran baseline trials to confirm pass rate in target range

## What Was Produced

Two new gym scenarios were created during/after these sessions:
- `scout-coder-event-flow` — baseline results: 3/4 pass (75%, possibly too easy)
- `scout-coder-stale-cache` — baseline results: 0/3 pass (early runs had scoring bug with `require` in ESM, later runs fail on `all-tests-pass` check)

These are active — gym runs continued after the sessions ended (IDs 2213-2219), showing the scenarios are being used for ongoing calibration.

## Cost Assessment

| Metric | Session 1 | Session 2 | Combined |
|--------|-----------|-----------|----------|
| Ops | 120 | 109 | 229 |
| Duration | 32 min | 36 min | 68 min |
| Quality | 0.75 | 0.75 | — |
| Verdict | good | good | — |
| Est. cost | ~$5.60 | ~$5.10 | ~$10.70 |

## Is This Waste?

**No.** This is scenario engineering — an inherently iterative process that requires:
1. Reading existing scenarios for patterns (~10-15 ops)
2. Designing environment files, task.md, success_criteria.js (~20-30 ops)
3. Running gym trials to validate pass rates (~30-50 ops, 5-10 runs × 3-5 ops each)
4. Debugging scoring failures and adjusting (~20-30 ops)

The 120-op and 109-op totals are within expected range for this task type. Compare to prior scenario-creation sessions: EXP-166 setup was 101 ops, EXP-154 design was 133 ops, EXP-123 design was 166 ops.

## Potential Optimizations

1. **Scoring bug waste**: The `require is not defined` error in success_criteria.js (gym runs 2213, 2217) suggests CJS/ESM confusion. A pre-flight validation check on success_criteria.js would catch this before burning gym runs. This was identified in prior findings — **gym preflight validation** remains unimplemented.

2. **Two sessions instead of one**: The work was split across two sessions (120 + 109). If the first session had continued rather than ending and spawning a continuation, context reload overhead could have been avoided. However, this may be due to session timeout limits rather than a choice.

3. **Baseline calibration loop**: Going from 0/92 (floor effect) to designing new scenarios is expensive. The coach could benefit from a **scenario difficulty estimator** — a lightweight pre-check before committing to full baseline runs.

## Actionable Recommendations

| Priority | Action | Est. Savings |
|----------|--------|-------------|
| Medium | Implement gym preflight validation (success_criteria.js syntax/module check) | 5-10 ops per broken scenario |
| Low | Scenario difficulty heuristic (estimate baseline before full runs) | 10-20 ops when scenarios miss target range |
| None | Reduce session ops — these are already efficient for the task type | N/A |

## Key Takeaway

**High-op ≠ wasteful.** These are the highest-op sessions in the system, but they're building experimental infrastructure that enables all future scout→coder experiments. The coach's gym-heavy sessions consistently score "good" quality. The real optimization opportunity is in the tooling (preflight validation, batch runners already deployed) not in the session behavior itself.
