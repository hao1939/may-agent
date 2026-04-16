# EXP-171: Results — Moderate Hints + F2 Workflow on Cascading Bugs

**Date**: 2026-04-16
**Status**: Complete
**Verdict**: NULL RESULT — combination of two ineffective interventions remains ineffective

## Summary Table

| Arm | Variant | N | Passed | Rate | 95% CI |
|-----|---------|---|--------|------|--------|
| 1 | baseline | 56 | 0 | 0% | [0%, 6%] |
| 2 | moderate-hint | 10 | 0 | 0% | [0%, 31%] |
| 3 | f2-workflow | 28 | 0 | 0% | [0%, 12%] |
| 4 | **moderate-f2** | **21** | **0** | **0%** | **[0%, 16%]** |
| (ref) | f1-only | 15 | 15 | 100% | [78%, 100%] |

Total runs: 130 (115 new + 15 reference from EXP-165)

## Key Findings

### 1. Combining two ineffective interventions does NOT create effectiveness
0/21 (0%) for moderate-f2 confirms that stacking moderate hints with F2 workflow produces no improvement. The hypothesis that addressing recognition + execution bottlenecks simultaneously would help was **wrong**.

### 2. The bottleneck is purely recognition, and it's binary
- **Full F1 hints** (explicit fix details): 100% pass rate
- **Moderate hints** (problem identified, no fix details): 0% pass rate
- The gap between "knowing what's wrong" and "knowing the fix" is the entire bottleneck

### 3. F2 workflow adds nothing on top of moderate hints
This rules out the theory that agents recognize the problem but fail at execution. Even with structured two-phase workflow forcing analysis-then-fix, agents cannot bridge the gap from problem identification to solution.

## Interpretation

Cascading-fix-trap-v2 has a **hard recognition bottleneck** at the fix-identification level. The agent needs to be told not just *what* is broken but *how* to fix it. This is consistent with KE-180 (analysis gates don't help) — writing ANALYSIS.md doesn't produce insight the agent lacks.

**Implication for skill design**: For tasks with hard recognition bottlenecks, only direct solution hints work. Workflow scaffolding and partial hints are insufficient. Training should focus on teaching the specific recognition pattern, not general problem-solving structure.

## Statistical Notes
- All experimental arms show 0% pass rate; no statistical test needed (all identical)
- Fisher's exact: f1-only vs any other arm: p < 0.001
- The 21 runs for moderate-f2 give sufficient power to detect effects ≥15% at α=0.05
