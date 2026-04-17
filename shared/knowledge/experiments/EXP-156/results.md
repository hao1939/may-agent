# EXP-156 Results: Hard Gate Generalization

**Date**: 2026-04-17
**Status**: COMPLETE
**Hypothesis**: H-156 — Hard gate (Ch2 "diagnose-before-fix") generalizes beyond hidden-dep to other judgment scenarios

## Summary

**Hard gate dramatically improves misleading-test-fix (10% → 100%), and context-drift baseline is already at ceiling (100% → 100%).**

## Results

### Scenario 1: misleading-test-fix
Agent must fix invoice calculator tests. 2 failures are real code bugs (tax rounding), 1 failure is a test with wrong expected value. The trap: agent must recognize the test is wrong, not the code.

| Arm | Trials | Pass Rate | Notes |
|-----|--------|-----------|-------|
| Baseline (no hard gate) | 10 | 1/10 (10%) | Agent usually modifies applyDiscount to produce 27.17 (wrong answer) |
| Treatment (DIAGNOSIS.md hard gate) | 10 | 10/10 (100%) | Writing diagnosis forces independent math, catches test bug |

**Δ = +90pp** (p < 0.001, Fisher's exact)

### Scenario 2: ambiguous-context-drift
Agent must migrate JSON configs to YAML. Prior session context claims 4/6 done but only 2 actually are. Agent must verify filesystem state vs context claims.

| Arm | Trials | Pass Rate | Notes |
|-----|--------|-----------|-------|
| Baseline (no hard gate) | 10 | 10/10 (100%) | Agent already verifies filesystem state naturally |
| Treatment (VERIFICATION.md hard gate) | 6 | 6/6 (100%) | No improvement needed — ceiling effect |

**Δ = 0pp** — baseline already at ceiling.

## Analysis

### Why hard gate works dramatically on misleading-test-fix:
1. Without the gate, the agent sees "fix all failures" and immediately patches code to match test expectations
2. The DIAGNOSIS.md requirement forces the agent to calculate the correct answer independently BEFORE touching code
3. Once the agent does the math (33.97 × 0.80 = 27.176 → rounds to 27.18), it recognizes the test expects 27.17 which is wrong
4. This is a direct application of Ch2's "verify independently before acting" principle

### Why context-drift doesn't benefit:
1. The agent naturally runs `ls config/` or reads files before migrating
2. File I/O is concrete and immediately reveals reality vs claims
3. The agent doesn't need to be told to verify — filesystem operations ARE verification

### Key Insight
Hard gates are most valuable when:
- The "fast path" (just fix it) gives a plausible but wrong answer
- Verification requires EFFORT (doing math, not just reading files)
- The agent's default behavior is to trust context/tests rather than compute independently

Hard gates add less value when:
- Normal task execution naturally involves verification (e.g., reading files)
- The correct path is also the obvious path

## Recommendations
1. **ADOPT** hard gate for scenarios involving mathematical/logical verification
2. **SKIP** hard gate for scenarios where file I/O naturally reveals ground truth
3. Consider adding hard gates to skills that involve trusting external claims (test assertions, documentation, prior session context with non-trivial verification)
