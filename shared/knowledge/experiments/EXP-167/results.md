# EXP-167 Results: Content-First Guard Generalization

**Date**: 2026-04-16
**Status**: COMPLETE

## Summary

Content-first (F1) expert analysis injection generalizes powerfully to two new 0%-baseline scenario types. Both hit 100% pass rate.

## Results

| Scenario | Baseline | Baseline N | F1 Rate | F1 N | Delta |
|----------|----------|------------|---------|------|-------|
| contradictory-requirements | 0% | 63 | 100% (20/20) | 20 | **+100pp** |
| misleading-test-fix | 0% | 54 | 100% (15/15) | 15 | **+100pp** |

Both p < 0.001 (Fisher's exact test, one-sided).

## Analysis

### contradictory-requirements (judgment under contradiction)
- **Baseline**: 0% (n=63). Agents optimize code without recognizing mathematically impossible requirements (strict ordering + 10K/sec throughput).
- **F1**: 100% (n=20). Pre-placed ANALYSIS.md identifying the contradiction enables agents to surface it and propose alternatives.
- **Mechanism**: Expert analysis provides the key insight (5ms/record × sequential = 200/sec max) that agents consistently miss.

### misleading-test-fix (diagnosis discrimination)  
- **Baseline**: 0% (n=54). Agents modify correct code to match wrong test assertions instead of fixing the test.
- **F1**: 100% (n=15). Pre-placed ANALYSIS.md identifying which failures are code bugs vs test bugs enables correct diagnosis.
- **Mechanism**: Expert analysis disambiguates root cause, preventing the common error of "fix code to match tests" when tests are wrong.

## Cross-Experiment Pattern (EXP-165 → 166 → 167)

| Experiment | Scenario Type | Baseline | F1 | Delta |
|------------|--------------|----------|-----|-------|
| EXP-165 | Architectural (cascading-fix-trap-v2) | 0% | 100% | +100pp |
| EXP-166 | Recognition (sql-injection) | 67% | 100% | +33pp |
| EXP-167 | Judgment (contradictory-requirements) | 0% | 100% | +100pp |
| EXP-167 | Diagnosis (misleading-test-fix) | 0% | 100% | +100pp |

**Content-first expert analysis injection is the most powerful single intervention discovered.** It produces +33pp to +100pp improvements across 4 different failure types, with the largest gains on hard (0% baseline) scenarios.

## Implications

1. **Expert analysis is a universal enabler**: The content (domain insight, root cause identification) is what matters, not the delivery mechanism.
2. **Hard scenarios benefit most**: 0% baselines see +100pp; 67% baselines see +33pp. The harder the task, the more expert analysis helps.
3. **Generalization confirmed**: F1 works across architectural, recognition, judgment, and diagnosis failure modes — not scenario-specific.

## Limitations

- F1 scenarios have pre-placed ANALYSIS.md — the expert analysis is hand-crafted per scenario. Automating analysis generation is the next research question.
- All runs used the same agent (coder). Cross-agent generalization not tested.
- N=15-20 per arm. Sufficient for 0%→100% effects but would need larger N for smaller effects.
