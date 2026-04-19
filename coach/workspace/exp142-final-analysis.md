# EXP-142 Final Analysis Summary — Bob Guard Exemption

**Date**: 2026-04-15  
**Experiment**: EXP-142 — Exempt Bob from FM-3.3 verification-depth guard  
**Period**: Pre (Apr 6-11, N=466) vs Post (Apr 11-14, N=334)

## Bottom Line

**Bob quality improved by +8.8pp (86.7% → 95.5%)** after exempting him from the FM-3.3 verification-depth guard. The result is highly significant (z=4.17, p<0.0001, 95% CI [+5.0pp, +12.6pp]).

## Hypothesis Results

| # | Hypothesis | Result | Key Data |
|---|-----------|--------|----------|
| H-142a | Bob quality ≥85% | ✅ **95.5%** | +8.8pp, p<0.0001 |
| H-142b | FM-3.3 rate → 0% | ✅ **Code verified** | 4 evaluator annotations ≠ actual blocks |
| H-142c | No control regression | ⚠️ **Partial** | Coach -0.3pp ✅, TL +8.4pp (improved), QA +47.7pp (confound) |
| H-142d | D-o-R stable | ✅ **60.6%** | Was 65.0%, -4.4pp within noise |

## Why It Worked

Bob's `deliver-or-report` workflow Phase 3b (dedicated readback session) provides **superior verification** to the guard's block→retry cycle. The guard was disrupting Bob's output flow without adding value, since D-o-R would verify everything systematically afterward anyway.

## Quality Distribution Shift

The most striking finding: post-deployment, 78.4% of Bob's sessions score 0.90-1.00 (vs ~15.7% pre). The guard wasn't just passing/failing sessions at threshold — it was actively **capping quality** by interrupting flow.

## Recommendation

Make permanent. The `exemptAgents: ["bob"]` config in `manager.ts` should be standard configuration, not experimental.

## Follow-up

- **EXP-150** (coach/tech-lead warn-only): Deployed concurrently. Monitor these separately.
- **Evaluator annotation**: FM-3.3 labels in evaluations don't reliably indicate actual guard blocks. Filed as methodological note.
- **Per-agent calibration principle**: Validated. Extend to other agents where workflow-level verification exists.
