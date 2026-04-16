# EXP-171 Results: Moderate Hints + F2 Workflow on Cascading Bugs

**Date**: 2026-04-16
**Status**: COMPLETE

## Results

| Arm | Variant | N | Pass | Rate | Source |
|-----|---------|---|------|------|--------|
| 1 | baseline (no intervention) | 56 | 0 | 0% | EXP-165/168 (reused) |
| 2 | moderate-hint only | 10 | 0 | 0% | EXP-168 (reused) |
| 3 | f2 workflow only | 28 | 0 | 0% | EXP-165 (reused) |
| 4 | **moderate-hint + f2** | **15** | **0** | **0%** | NEW (runs 1951-1965) |

## Statistical Analysis

All four arms show 0% pass rate. No statistical test needed — there is no variance to analyze.

- Moderate hints + F2 combined: 0/15 (0%, 95% CI: 0–22% via Clopper-Pearson)
- This matches both component arms (moderate-hint 0/10, f2 0/28) and baseline (0/56)

## Interpretation

**The combination of moderate hints + F2 workflow provides no benefit over either intervention alone or baseline.**

The hypothesis that addressing both recognition (via hints) and execution (via workflow) bottlenecks simultaneously would produce intermediate results was **falsified**. This suggests:

1. The cascading-fix-trap-v2 scenario's difficulty is **not decomposable** into independent recognition + execution bottlenecks
2. Moderate hints may be insufficient for the recognition component — the agent needs explicit fix details (as in F1, which achieved 100% in EXP-167)
3. The gap between "knowing what's wrong" and "knowing how to fix it" is the binding constraint

## Comparison to F1 Results

| Intervention | Pass Rate |
|---|---|
| No intervention | 0/56 (0%) |
| Moderate hint | 0/10 (0%) |
| F2 workflow | 0/28 (0%) |
| Moderate hint + F2 | 0/15 (0%) |
| F1 (full hints) | 35/35 (100%) — EXP-167 |

The only intervention that works is F1 (full step-by-step hints), confirming that **cascading-fix-trap-v2 requires explicit solution guidance**, not just problem identification or structured process.

## Raw Data

23 total runs recorded in gym_runs DB (IDs 1943-1965), all passed=0. First 15 (IDs 1951-1965) used for the official N=15 count per design.
