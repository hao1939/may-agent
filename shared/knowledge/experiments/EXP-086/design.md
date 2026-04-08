# EXP-086: Few-Shot Boundary Test — Mismatched Example

**Date**: 2026-04-08
**Status**: COMPLETE

## Design

**Hypothesis**: A structurally mismatched few-shot example still improves judgment, but less than a matched example.

**Scenario**: `escalation-judgment-fewshot-mismatched` — identical environment/task/success_criteria to `escalation-judgment-base`, but with `injected_context.md` containing a worked example from a different domain (conflicting requirements for a data pipeline — about ordering vs throughput tradeoffs).

**Controls**:
- Baseline: EXP-044 escalation-judgment-base = 1/8 (12.5%)
- Matched: EXP-085 escalation-judgment-fewshot = 3/3 (100%)

**Treatment**: 3 runs on escalation-judgment-fewshot-mismatched

## Key Mismatch

| Dimension | Matched (EXP-085) | Mismatched (EXP-086) |
|-----------|-------------------|---------------------|
| Domain | Dependency upgrade → multi-module check | Conflicting requirements → analyze tradeoffs |
| Structural pattern | Change → find all consumers → fix all → document | Tension → analyze → propose alternatives → document |
| Specific behavior demonstrated | Check all files using dependency, create ESCALATION.md | Write ANALYSIS.md with tradeoffs |

## Results Summary

- **Mismatched few-shot**: 2/3 (66.7%) — improved over baseline but worse than matched
- **ESCALATION.md created**: 0/3 (vs 3/3 for matched)
- **Both files fixed**: 2/3 (vs 3/3 for matched)
- Full results: `results.md`
