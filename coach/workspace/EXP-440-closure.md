# EXP-440: QA Finish-Call Compliance — CLOSED (NEGATIVE)

**Experiment**: Test whether text-based SESSION EXIT RULE in qa/context.md improves finish() call compliance
**Date range**: 2026-05-02 to 2026-05-25
**Closed**: 2026-05-03

## Design
- **Hypothesis**: Adding explicit "you MUST call finish()" text rule to QA context.md will increase C8.2/C1.4 pass rate from 25% to ≥50%
- **Treatment**: SESSION EXIT RULE text block added to qa/context.md
- **Metrics**: C8.2 (finish fields) and C1.4 (finish call) pass rates

## Results

| Metric | Baseline | Treatment | Δ |
|--------|----------|-----------|---|
| C1.4 (finish call) | 25% | 14.3% (2/14) | **-10.7pp** |
| C8.2 (finish fields) | 25% | 14.3% (2/14) | **-10.7pp** |

**Verdict: NEGATIVE** — Treatment made compliance worse, not better.

## Interpretation

This confirms KE-480 (text coaching is dead for structural behaviors). Text-based rules in context.md do not improve finish() compliance for QA. The behavior requires structural enforcement — either:
1. A workflow gate that prevents session exit without finish() (like EXP-510/520 pattern)
2. Infrastructure-level enforcement (session harness calls finish automatically)

## Key Insight

Text interventions work for **judgment** tasks (what to decide) but fail for **procedural** tasks (what steps to follow). finish() compliance is purely procedural — the agent knows it should call finish() but doesn't because there's no enforcement mechanism.

## Disposition
- **Status**: CLOSED — NEGATIVE
- **Skill produced**: None
- **KE produced**: Reinforces KE-480
- **Follow-up**: QA finish compliance needs structural fix (infrastructure change, not coaching)
