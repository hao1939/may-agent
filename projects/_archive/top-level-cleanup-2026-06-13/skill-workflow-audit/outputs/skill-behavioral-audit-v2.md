# Behavioral Audit v2 — Skill Compliance Re-measurement

**Date**: 2026-06-26
**Sample**: 12 sessions across 7 agents (may, tech-lead, amy, coder, bob, optimizer, coach)

## Dimensions Scored

1. **SCBA** (Structured Checkpoint-Based Approach): Does the agent break work into steps, use checkpoints, work methodically?
2. **Evidence**: Does the agent cite concrete evidence (file contents, test output, error messages) rather than making claims?
3. **Verify (VBF)**: Does the agent verify deliverables before calling finish()?

## Results

| # | Session | Agent | Task Type | SCBA | Evidence | Verify | Notes |
|---|---------|-------|-----------|------|----------|--------|-------|
| 1 | s_1777144803961_193 | may | project kickoff | ✅ | ✅ | ✅ | Forked to coach, verified deliverables |
| 2 | s_1777066398610_0 | tech-lead | bug fix | ✅ | ✅ | ✅ | Read files, ran tests, cited evidence |
| 3 | s_1777065063071_0 | tech-lead | bug fix | ✅ | ✅ | ✅ | 53 bash calls, thorough testing |
| 4 | s_1777057936253_0 | amy | bug fix | ✅ | ✅ | ✅ | 54 bash, 12 reads, 3 verification_evidence |
| 5 | s_1776866894943_0 | tech-lead | test fix | ✅ | ✅ | ✅ | Compact session, ran tests via bash |
| 6 | s_1776304922444_0 | coder | bug fix phase 2 | ✅ | ✅ | ✅ | 51 bash calls, 4 verification_evidence |
| 7 | s_1776299910150_0 | coder | bug fix phase 2 | ✅ | ✅ | ✅ | 17 reads, methodical approach |
| 8 | s_1776057842701_32 | bob | write deliverable | ✅ | ✅ | ✅ | Budgeted approach (25 tool call limit) |
| 9 | s_1776057782806_31 | tech-lead | wiring task | ✅ | ✅ | ✅ | 10 reads, 15 bash, 2 verification_evidence |
| 10 | s_1776057762050_30 | bob | analyze & plan | ✅ | ✅ | ✅ | Structured analysis phase |
| 11 | s_1776057739682_29 | optimizer | system health | ✅ | ✅ | ✅ | 35 bash calls, thorough archaeology |
| 12 | s_1776057722653_28 | coach | investigation | ✅ | ✅ | ✅ | 18 reads, 63 bash, 2 checkpoints |

## Summary

| Dimension | Baseline | Current | Change |
|-----------|----------|---------|--------|
| SCBA | 100% (9/9) | **100% (12/12)** | — |
| Evidence | 100% (9/9) | **100% (12/12)** | — |
| Verify (VBF) | 67% (6/9) | **100% (12/12)** | **+33pp** |
| **Overall usage-rate** | **0.89** | **1.00** | **+0.11** |

## Analysis

- **SCBA and Evidence** remain at 100% — these behaviors are deeply embedded.
- **Verify (VBF)** improved from 67% → 100% after deploying the VBF skill + 📘 directives to all 11 agents in iteration 13.
- All 12 sessions included `verification_evidence` in their finish() calls.
- The weakest session (#5) had only 6 bash calls and no read() calls, but still met minimum verification criteria.

## Recommendations

1. **Maintain monitoring**: Re-measure monthly to detect regression
2. **Deepen VBF scoring**: Score verification *thoroughness* (% of deliverables verified), not just presence
3. **Measure usefulness**: See `skill-usefulness-design.md` for next-level metric
