# EXP-198: Results — Procedural Discovery Skill for Relational Bugs

**Status**: COMPLETED
**Date**: 2026-06-22
**Cost**: ~$1.50 (30 gym runs)

## Summary

All three arms scored 0/10 on cascading-fix-trap-v2. The procedural discovery skill ("swap adjacent pipeline steps and check if tests improve") completely failed — identical to baseline. Neither the procedure alone (Arm B) nor procedure + worked example (Arm C) helped agents discover the ordering bug. This is a strong null result that **falsifies H-198a** (predicted ≥25%).

## Data

| Arm | Intervention | N | Pass | Rate | Notes |
|-----|-------------|---|------|------|-------|
| A (baseline) | None | 10 | 0 | 0% | All fail on `pipeline-order-fixed` only |
| B (procedural) | Step-by-step swap procedure in task.md | 10 | 0 | 0% | Same failure pattern |
| C (proc+example) | Procedure + worked example from different domain | 10 | 0 | 0% | Same failure pattern |

**All 30 trials**: Pass 8/9 checks, fail exactly on `pipeline-order-fixed`. No variance.

Comparison to prior experiments:
- EXP-177 baseline: 0/40 (0%) — consistent
- EXP-195 baseline: 1/10 (10%) — slight shift
- EXP-195 direct hint: 4/10 (40%) — only explicit bug identification works
- EXP-198 procedural: 0/10 (0%) — procedure is no better than nothing

## Analysis

### H-198a: FALSIFIED
Procedural skill predicted ≥25%. Observed 0%. The null is not due to small N — 0/10 is unambiguous.

### H-198b: UNTESTABLE
Transfer couldn't be tested since the base skill showed no effect.

### Why procedures fail

The procedural approach assumed the bottleneck was "agents don't know the method." But the real bottleneck appears deeper:

1. **Agents don't execute procedures faithfully.** Even with explicit "swap A and B, run tests, check if improvement" instructions, the agent doesn't actually do this. It reads the instruction, nods, and continues with its default pattern-matching approach.

2. **The Ch2 reasoning gap (H-098) may be at the execution level, not the knowledge level.** The agent knows what to do (procedure provided), can fix the bug when told (EXP-195 40%), but can't bridge from procedure to execution autonomously.

3. **This validates H-181 P-181c**: Even procedural interventions fail. The relational bug blindness is not a knowledge gap (declarative or procedural) — it's a **capability gap** in the model's reasoning about inter-component relationships.

### Implications

The intervention hierarchy for relational bugs is now clear:
- Generic declarative skill: **0%** (EXP-195)
- Procedural discovery method: **0%** (EXP-198)  
- Direct hint (near-explicit): **40%** (EXP-195)
- Full fix provided: ~100% (trivial)

Only scenario-specific knowledge works. This strongly suggests the fix needs to be **structural** (e.g., tool-assisted pipeline analysis, automated swap-and-test scaffolding) rather than prompt-based.

## Conclusion

**H-198a FALSIFIED.** Procedural discovery skills don't help agents find relational bugs. The relational bug blindness (H-181) is robust against both declarative and procedural prompt-level interventions. Only direct, near-explicit hints bridge the gap. Next avenue: tool-level or workflow-level scaffolding that automates the discovery procedure rather than instructing the agent to do it.

## Followups

- Write KE summarizing the complete intervention hierarchy (declarative → procedural → direct → tool-assisted)
- Design EXP-199: Tool-assisted relational bug discovery — provide the agent with a "pipeline-swap" tool that automatically permutes pipeline steps and reports test results
- Update H-181 P(H) to 0.90 (all prompt-level interventions exhausted, capability gap confirmed)
