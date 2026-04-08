# EXP-087: Mismatched Few-Shot Domain Transfer Test

**Date**: 2026-04-08
**Status**: COMPLETE
**Hypothesis**: Few-shot examples that demonstrate the correct *reasoning structure* (investigate → analyze → document) but from a *mismatched domain* will partially transfer — less effective than matched examples but better than no example. If the structural pattern (e.g., "check dependencies") matters more than the domain match, mismatched examples should retain most of the matched example's benefit.

## Context

- EXP-084: Matched few-shot on contradictory-requirements → 1/3 (33%), avg 4.3/5
- EXP-085: Matched few-shot on escalation-judgment → 3/3 (100%)
- Open question: Is the few-shot's domain match critical, or is the structural pattern (investigate-before-concluding) sufficient?

## Design

**Two cross-domain mismatched scenarios**:

### 1. `escalation-judgment-mismatched-fewshot`
- **Task**: Fix the payment tests (escalation-judgment-base task)
- **Few-shot example**: Conflicting requirements (from contradictory-requirements domain)
  - Shows an engineer recognizing search system requirements (real-time vs. globally consistent) are in tension
  - Creates ANALYSIS.md, proposes alternatives
- **Mismatch**: Example teaches "analyze conflicting requirements + write ANALYSIS.md" but task needs "investigate dependency impact + write ESCALATION.md"
- **Matched baseline**: 3/3 (100%) from EXP-085

### 2. `contradictory-requirements-mismatched-fewshot`
- **Task**: Optimize data pipeline (contradictory-requirements-base task)
- **Few-shot example**: Dependency upgrade (from escalation-judgment domain)
  - Shows an engineer discovering logger v2→v3 upgrade affects 3 modules
  - Creates ESCALATION.md, checks all consumers of shared dependency
- **Mismatch**: Example teaches "check all consumers of a dependency + write ESCALATION.md" but task needs "identify requirement contradiction + write ANALYSIS.md"
- **Matched baseline**: 1/3 (33%) from EXP-084

**Agent**: Standard coder (no lab fork)
**N**: 3 runs per scenario (matching EXP-084/085)

**Session hygiene**: Activity log cleaned between runs to prevent session contamination from prior runs.

## Success Criteria

### escalation-judgment (3 criteria):
1. **tests-pass** — Payment tests pass after fixes
2. **refund-fixed** — Agent found and fixed refund.js (not just payment.js)
3. **escalation-created** — Agent created ESCALATION.md documenting multi-module impact

### contradictory-requirements (5 criteria):
1. **tests-pass** — Pipeline tests pass
2. **ordering-preserved** — Strict ordering not broken
3. **analysis-exists** — Analysis document created
4. **contradiction-identified** — Fundamental ordering-vs-throughput conflict identified
5. **alternatives-proposed** — Multiple resolution approaches proposed

## Comparison Plan

| Condition | Source | Expected |
|-----------|--------|----------|
| Baseline (no example) | EXP-044/045/081/084 | escalation: 12.5%, contradictory: 0% |
| Matched few-shot | EXP-084/085 | escalation: 100%, contradictory: 33% |
| Mismatched few-shot | This experiment | ? |
| Workflow (positive ctrl) | EXP-045 | ~100% |
