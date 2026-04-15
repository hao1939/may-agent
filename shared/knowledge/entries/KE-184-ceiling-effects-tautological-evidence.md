# KE-184: Ceiling Effects in Gym Scenarios Produce Tautological Evidence

**Status**: Active
**Source**: EXP-163 (H-161 Independence Test, N=70), retrospective analysis of EXP-154/EXP-155
**Date**: 2026-04-15
**Confidence**: ★★★★★ (Definitively demonstrated — the mechanism is logical, not probabilistic)
**Related**: KE-181 (process vs product metrics), KE-178 (hard gate boundary conditions), H-161 (dual IT functions)

---

## Core Finding

**When a gym scenario has a ceiling-level baseline (≥90% product pass rate), any intervention tested on it risks producing tautological evidence: the treatment "works" only because the scorer conflates process compliance with product quality.** The agent was already succeeding; the intervention merely adds detectable artifacts that the scorer counts as additional "passes."

This is a **methodological threat** to the entire gym-based experimentation pipeline, not specific to any one hypothesis.

## The Mechanism

```
1. Scenario has high baseline product quality (agent solves it without help)
2. Intervention adds a process artifact (e.g., FINDINGS.md, ANALYSIS.md)
3. Scorer checks for both product correctness AND artifact existence
4. Baseline: 100% product, 0% process → low "overall" score
5. Treatment: 100% product, 100% process → high "overall" score
6. Researcher reports "+Xpp improvement from intervention!"
7. Reality: 0pp product improvement; Xpp is entirely artifact compliance
```

The tautology: a gate that requires artifact production will always produce the artifact it checks for. If the scorer treats artifact existence as evidence of intervention effectiveness, every gated intervention will appear to "work" on any ceiling scenario — regardless of whether it improves actual outcomes.

## Case Study: EXP-154/EXP-155 → EXP-163

EXP-154/EXP-155 reported an 85pp improvement from forced externalization on the hidden-dependency scenario. EXP-163 (N=70, 4 arms) revealed:

| Metric | Baseline (N=30) | Treatment (N=40) | Delta |
|--------|-----------------|-------------------|-------|
| Product quality | 100% | 100% | **0pp** |
| Process compliance | 0% | 100% | +100pp |
| Overall (as reported) | 0% | 100% | +100pp |

The "+85pp" was entirely process compliance. The agent fixed both bugs in every single baseline run.

## Detection Rules

Before trusting gym experiment results, verify:

1. **Baseline product pass rate < 80%**: If the agent already succeeds without help, the intervention has nothing to improve
2. **Primary metric is product quality only**: Process checks (artifact existence, planning steps) should be diagnostic, not in the primary pass/fail
3. **Treatment effect survives product-only analysis**: Re-score with process checks removed. If the effect disappears, it was tautological
4. **Gate-created artifacts are not gate-checked**: If Arm X requires FINDINGS.md and the scorer checks for FINDINGS.md, that's a design circularity

## Scope of Impact

This finding retroactively affects:
- **EXP-155 hidden-dep**: Entire reported effect was tautological (corrected in KE-129, KE-181)
- **Any future experiment** on a scenario with >90% baseline product quality
- **Baseline assessments**: A scenario showing 100% product baseline should be flagged as "at ceiling — not suitable for intervention testing"

This finding does NOT affect:
- **EXP-127 (contradictory-requirements)**: 0% baseline product quality — genuine failure that externalization fixes
- **EXP-156 (misleading-test-fix)**: 0% baseline product quality — genuine failure
- **Any experiment where baseline product pass rate is 30-70%**: These have room for real improvement

## Generalization

The ceiling-effect tautology is an instance of a broader pattern: **measurement instruments that are sensitive to the intervention's mechanism rather than to the outcome of interest will always show an effect, whether or not the intervention changes outcomes.** In clinical trials this is called "surrogate endpoint bias." In our gym system, process checks are surrogate endpoints — they measure intervention compliance, not task performance.

## Recommendations

1. **Always report product and process metrics separately** in experiment results
2. **Run a baseline product-quality check** (≥10 runs) before investing in treatment arms
3. **If baseline product quality ≥ 90%**, either find a harder scenario or accept the scenario is a regression test (useful for "does the intervention break anything?" but not "does it help?")
4. **Review existing KE entries** that cite experiments on high-baseline scenarios — flag potential tautological evidence

---
*Filed: 2026-04-15. This is the methodological complement to KE-181 (which covers process-vs-product metric separation). KE-184 covers the broader ceiling-effect pattern and its implications for experiment design.*
