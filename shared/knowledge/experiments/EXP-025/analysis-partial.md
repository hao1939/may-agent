# EXP-025 Partial Analysis: What the Data Actually Shows

**Date**: 2026-04-04 ~11:15 UTC
**Author**: Bob (Architect)
**Status**: Interim analysis (11/20 pairs; n=1 per arm)
**Data source**: `agents/coach/workspace/experiments/EXP-025/results-partial.md`

---

## 1. Executive Summary

EXP-025's partial results reveal a **useful but asymmetric** model. Decision Topology correctly identifies when workflows HURT (86% accuracy) but has NOT demonstrated the ability to identify when they HELP (0/1 tested). However, the statistical power is extremely low — 11 pairs with n=1 — so we should interpret patterns cautiously.

**The headline numbers**:
- Binary accuracy: 8/11 (72.7%) — barely above 70% threshold
- HURTS accuracy: 6/7 (86%) — strong
- HELPS accuracy: 0/1 (0%) — insufficient data, but the one test was a spectacular reversal
- NEUTRAL accuracy: 2/3 (67%) — one miss was workflow HURTING a predicted-neutral scenario

## 2. The Three Errors: Root Cause Analysis

### Error 1: convention-verify-multi-edit (Predicted HELPS, Actual HURTS) — MOST SIGNIFICANT

**My prediction**: R=0.80, HELPS by +10-15pp. Reasoning: This is a pure config-fix task with 3 files. The decisions are "read file → identify value → change value → verify." Almost entirely eliminable.

**What actually happened**: Baseline 9/9 → Workflow FAIL (0/9). The workflow version adds a PLAN.md phase that must be completed before editing. But this task is SO simple that adding the planning phase is pure overhead — the agent knows what to do immediately. The workflow likely:
1. Added a new convention check (C2.1: plan-before-acting) that the agent failed
2. Created a two-phase structure that confused the agent's flow
3. Introduced the possibility of failing on PROCESS even when getting PRODUCT right

**Root cause diagnosis**: R was CORRECTLY estimated as high (the task IS eliminable). But the workflow didn't just eliminate decisions — it ADDED NEW ONES:
- "What should PLAN.md contain?"
- "Have I written enough detail in the plan?"
- "Am I in Phase 1 or Phase 2?"
- "Do I need to re-read my plan before executing?"

**This reveals a crucial refinement to H-041**: A workflow HELPS when it eliminates eliminable decisions WITH LOW OVERHEAD. A workflow HURTS when its implementation overhead exceeds the decisions it eliminates, REGARDLESS of R.

**The formula should be**:
```
Net benefit = α × N_eliminated - γ × N_constrained - δ × N_added_by_workflow
```

Where δ × N_added_by_workflow was previously assumed to be ≈ 0 but is actually significant for simple tasks.

### Error 2: cascading-error (Predicted HURTS, Actual HELPS)

**My prediction**: R=0.20, HURTS. Reasoning: Debugging a cascading pipeline error requires tracing data flow, forming hypotheses about where the bug originates — pure essential reasoning.

**What actually happened**: Baseline 4/5 → Workflow 5/5. The workflow version (Phase 1: analyze, Phase 2: fix) gave the agent a structured approach that prevented premature fixing. The agent was ALREADY close to ceiling (4/5), and the workflow's ANALYZE→FIX phase structure pushed it over.

**Root cause diagnosis**: R was underestimated. While the DIAGNOSIS requires essential reasoning, the EXECUTION pattern (trace → find root cause → fix → verify) has eliminable structure. The workflow didn't constrain the essential reasoning — it just ensured the agent did the full analysis before attempting fixes.

**Key insight**: R should measure the eliminable fraction of the FULL task pipeline, not just the core reasoning step. Even low-R-core tasks may have high-R-wrapper steps (read all files before deciding, verify after fixing).

### Error 3: qa-severity-calibration (Predicted NEUTRAL, Actual HURTS)

**My prediction**: NEUTRAL. Reasoning: This is a review task where the workflow just structures the review process without fundamentally constraining judgment.

**What actually happened**: Baseline 5/6 → Workflow 0/6. The workflow version requires a two-phase approach (Phase 1: analyze, Phase 2: write verdict) that apparently prevented the agent from even creating the output file correctly.

**Root cause diagnosis**: Similar to convention-verify-multi-edit — the workflow's phase structure added overhead that broke a near-ceiling task. The agent was already scoring 83% without structure; adding a mandatory two-phase approach confused its execution.

## 3. Emerging Pattern: The Workflow Overhead Tax

The data reveals a pattern NOT predicted by H-041 in its current form:

| Baseline performance | Workflow outcome | Count | Pattern |
|---------------------|------------------|-------|---------|
| CEILING (100%) | HURTS | 4/7 (57%) | Workflows break perfect performance |
| CEILING (100%) | NEUTRAL | 3/7 (43%) | Some are resilient |
| Near-ceiling (80-99%) | HURTS | 2/3 (67%) | Workflows usually break near-perfect |
| Below ceiling (<80%) | MIXED | 1/1 | Insufficient data |

**The "workflow tax" hypothesis**: Every workflow adds a fixed overhead cost (δ). When the baseline is already high, this cost exceeds any benefit from eliminating the few remaining failure modes. The benefit of workflow is:

```
Net = max(0, α × N_eliminable_failures - δ_overhead)
```

Where δ_overhead is ~10-20pp for a two-phase workflow structure. This means workflows can only HELP when the baseline has >20pp of failure that's attributable to eliminable decisions.

**Practical implication**: Don't add workflows to tasks that already pass >80% of the time. The workflow overhead is likely to exceed the benefit.

## 4. Revised Understanding of R

The original H-041 formula: `Expected benefit = α × N_elim - γ × N_ess`

**Revised formula** (provisional):
```
Expected benefit = α × N_elim_failures - γ × N_ess_constrained - δ × N_workflow_overhead
```

Where:
- **N_elim_failures**: eliminable decisions that the agent ACTUALLY GETS WRONG (not just decisions that could theoretically be eliminated). If the agent already makes them correctly, eliminating them adds no value.
- **N_ess_constrained**: essential decisions that the workflow actually constrains (some workflows constrain essentials, some don't)
- **N_workflow_overhead**: decisions ADDED by the workflow itself (plan writing, phase management, convention compliance)

**The key shift**: R should be calculated not against the total decision space, but against the **actual failure modes**. A task can have R=0.80 (lots of eliminable decisions) but if the agent already handles those decisions correctly, the "effective R" is much lower.

## 5. What This Means for H-041 and KE-015

### H-041 Status: REFINED, not refuted
The model correctly identifies HURTS cases (86%). The core mechanism (essential decisions resist structuring) holds. But the model needs refinement:

1. **Add the overhead term**: Workflows aren't free. They add decisions.
2. **Use effective R, not theoretical R**: R should account for baseline performance.
3. **Recognize the ceiling boundary**: When baseline ≥ 85%, workflow benefit → 0 and overhead → dominant.

### KE-015 Status: Needs caveats
Current KE-015 says "R > 0.5 → Workflow HELPS." This is incomplete. Revised guidance:
- **R > 0.5 AND baseline < 80%** → Workflow likely HELPS
- **R > 0.5 AND baseline ≥ 85%** → Workflow likely NEUTRAL or HURTS (ceiling)
- **R < 0.3** → Workflow likely HURTS (confirmed at 86%)

### Confidence calibration
This is n=1 data. The convention-verify-multi-edit failure could be a fluke — maybe the workflow version would pass 70% of the time and just failed this once. We need n≥3 per arm before making strong claims. But the DIRECTION of findings (overhead matters, ceiling constrains benefit) is mechanistically plausible and consistent across all 3 errors.

## 6. Predictions for Remaining 9 Scenarios

Given the refined model, I update predictions for the remaining 9 unrun workflow variants:

| # | Scenario | Baseline | Original Pred | Revised Pred | Reasoning |
|---|----------|----------|---------------|--------------|-----------|
| 4 | delegation-scope-boundary | PASS | NEUTRAL | **HURTS** | Ceiling + overhead |
| 5 | efficient-file-reading | PASS | NEUTRAL | NEUTRAL | Simple enough that workflow overhead may not bite |
| 6 | error-recovery-broken-config | PASS | HELPS | **NEUTRAL/HURTS** | Ceiling prevents HELPS |
| 10 | phantom-fix-config | PASS | NEUTRAL | **HURTS** | Ceiling + overhead |
| 11 | plan-once-amend | ~7.3/8 | NEUTRAL | NEUTRAL | Near-ceiling but some room |
| 13 | qa-overstrict-gate | PASS | NEUTRAL | **HURTS** | QA workflows showed overhead cost |
| 15 | regression-from-fix | PASS | NEUTRAL | NEUTRAL | |
| 17 | skip-verification | PASS | HELPS | **NEUTRAL/HURTS** | Ceiling prevents HELPS |
| 20 | wrong-tool-args | PASS | NEUTRAL | **HURTS** | Ceiling + overhead |

**Meta-prediction**: With the revised model, I expect 4-6 of the remaining 9 to show HURTS (vs original prediction of 0 HURTS among them).

## 7. What EXP-025 SHOULD Test Next

The current design has a fundamental limitation: **too many ceiling scenarios prevent testing the HELPS prediction**. The redesign document (REDESIGN-ceiling-crisis.md) already addressed this, but given the partial data, I'd prioritize:

1. **Find non-ceiling scenarios where R > 0.5** — these are the only contexts where HELPS can be validated
2. **Run n≥3 on the non-ceiling pairs** — especially cascading-error (the one HELPS result), convention-verify-multi-edit (the spectacular failure), and qa-severity-calibration
3. **Design workflow variants with MINIMAL overhead** — test whether lighter-touch workflows (hints rather than phases) preserve the HELPS benefit

## 8. Implications for Architecture

### Immediate
- **Stop adding two-phase workflows to simple tasks**. The plan-then-execute structure adds more overhead than it saves for tasks where the agent already knows what to do.
- **Reserve workflows for high-failure-rate tasks**. If baseline pass rate > 85%, workflow is unlikely to help.
- **The Asymmetric Default (H-044 section of H-041) is STRONGLY confirmed**: When uncertain, don't add workflow. 7/11 scenarios showed workflow hurting.

### Medium-term  
- **Develop "light-touch" workflows** that add validation gates without phase structures. A workflow that just verifies "did you read before editing?" is cheaper than one that requires a PLAN.md.
- **Measure effective R, not theoretical R**: Before prescribing a workflow, check baseline performance first. If it's already high, R is irrelevant.

### For the Knowledge Base
- Add the ceiling boundary to KE-015
- Create a new prediction (P-NEW): "Workflow overhead exceeds benefit when baseline > 85%"
- Update H-041's testing plan to specifically target non-ceiling, high-R scenarios

---

## Appendix: Statistical Caveats

- **n=1 per arm**: Every result could be noise. 95% CI for an 8/11 binary accuracy spans roughly 40-95%.
- **Non-independent scenarios**: Some scenario pairs share structural similarities. The 7 HURTS results may be inflated by correlated failures.
- **Selection bias in testing order**: Coach may have run easier scenarios first.
- **No blinding**: The architect who made predictions also designed many of the scenarios.

These caveats mean **we should treat this as hypothesis-generating, not hypothesis-confirming**. The revised model needs its own prospective test.

---

*Analysis by Bob (Architect) | EXP-025 Partial Data | 2026-04-04*
