# EXP-172: LLM-Generated F1 Analysis (Scout → Coder) — Results

**Date**: 2026-04-17
**Analyst**: Coach

---

## Summary

**Scout→Coder pass rate: 0/16 (0%)** — identical to EXP-165 full-gate (0/16) and baseline (0/38).

The dedicated scout phase with analysis-only framing did NOT improve performance. LLM-generated analysis fails to produce the root-cause insight needed, regardless of framing.

## Data

### Arm A: Scout→Coder (N=16)

| Check | Pass Rate |
|-------|-----------|
| all-tests-pass | 16/16 (100%) |
| pipeline-order-fixed | **0/16 (0%)** |
| grade-threshold-fixed | 16/16 (100%) |
| test-not-modified | 16/16 (100%) |
| data-not-modified | 16/16 (100%) |
| policy-not-modified | 16/16 (100%) |
| no-hardcoded-values | 16/16 (100%) |
| penalties-not-hacked | 16/16 (100%) |
| clean-code | 16/16 (100%) |

**Overall pass: 0/16 (0%)** — fails on `pipeline-order-fixed` every time.

### Comparison to Reference Arms (EXP-165)

| Arm | Pass Rate | pipeline-order-fixed |
|-----|-----------|---------------------|
| Expert F1 (reference) | 15/15 (100%) | 15/15 (100%) |
| Full-gate (reference) | 0/16 (0%) | 0/16 (0%) |
| **Scout→Coder (EXP-172)** | **0/16 (0%)** | **0/16 (0%)** |
| Baseline (reference) | 0/38 (0%) | 0/38 (0%) |

### Statistical Comparison

- Scout→Coder vs Expert F1: 0% vs 100%, p < 0.001 (Fisher's exact)
- Scout→Coder vs Full-gate: 0% vs 0%, identical
- Scout→Coder vs Baseline: 0% vs 0%, identical

## Hypothesis Evaluation

- **H-172a (Quality hypothesis) — SUPPORTED**: The scout fails to produce expert-quality analysis. Despite analysis-only framing and explicit instructions to trace pipeline ordering, the LLM-generated analysis does not correctly identify the pipeline order as a root cause (or identifies it but insufficiently).

- **H-172b (Session Contamination) — NOT TESTED**: Since the scout's analysis quality matches the full-gate's (both produce 0% pipeline-order-fixed), we cannot distinguish contamination effects. The analysis quality is the binding constraint.

## Key Finding

The pattern is striking: the agent passes ALL tests (100%) but NEVER fixes the actual pipeline ordering bug (0%). This means:
1. The agent finds workarounds that make tests pass without fixing the root cause
2. Even a dedicated analysis phase with "no fixing" framing doesn't prevent the agent from missing the pipeline ordering issue
3. The ROOT_CAUSE_ANALYSIS.md produced by the scout presumably describes surface-level fixes rather than the true root cause

**The bottleneck is recognition quality, not session structure.** Expert-written analysis (F1) produces 100% pass because it explicitly describes the correct root cause. LLM-generated analysis — whether in-context (full-gate) or in a dedicated scout phase — fails to identify it.

## Implications

1. **LLM analysis generation is the hard problem**: Framing doesn't solve it. The scout approach doesn't work.
2. **Expert knowledge injection remains the only working intervention**: F1 (100%) vs every LLM-generated variant (0%).
3. **Future directions**: Instead of trying to get the LLM to discover the root cause, consider:
   - Structured analysis templates that force specific checks (e.g., "compare documented vs actual execution order")
   - Tool-assisted analysis (automated diff of documented vs actual behavior)
   - Hints rather than full analysis (partial expert knowledge)

## DB Reference

Gym run IDs: 2278–2293 (batch of 15 + 1 manual verification run)
