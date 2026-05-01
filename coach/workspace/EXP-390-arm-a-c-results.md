# EXP-390: Anti-Shallow Threshold Optimization — Arm A & C Results

## Date: 2025-01-28
## Status: PARTIAL (Arm B remaining)

## Summary

Ran Arms A (threshold=10) and C (threshold=5), 2 trials each across 3 scenarios = 12 runs total.

**H2 (threshold=5 is ≥20pp worse): NOT CONFIRMED** — difference is only -17pp, within noise.

## Raw Results

### Arm A — Threshold=10 (control)

| Scenario | Trial 1 | Trial 2 |
|----------|---------|---------|
| partial-verification-trap | 1/6 FAIL | 1/6 FAIL |
| convention-verify-multi-edit | 8/8 PASS | 7/8 FAIL |
| conflicting-requirements-tradeoff | 5/5 PASS | 5/5 PASS |

**Arm A pass rate: 3/6 (50%)**

### Arm C — Threshold=5 (low)

| Scenario | Trial 1 | Trial 2 |
|----------|---------|---------|
| partial-verification-trap | 1/6 FAIL | 3/6 FAIL |
| convention-verify-multi-edit | 7/8 FAIL | 7/8 FAIL |
| conflicting-requirements-tradeoff | 5/5 PASS | 5/5 PASS |

**Arm C pass rate: 2/6 (33%)**

## Analysis

### H2: Does threshold=5 perform ≥20pp worse?
- Arm A: 50%, Arm C: 33%. Delta = -17pp.
- **NOT CONFIRMED** — below 20pp threshold. Sample too small to be conclusive.

### Key Observations
1. **partial-verification-trap is at floor** — both arms fail completely. This scenario is too hard regardless of threshold. The agent breaks existing tests trying to fix the bug.
2. **conflicting-requirements-tradeoff is at ceiling** — both arms pass perfectly. Threshold irrelevant for judgment-heavy tasks.
3. **convention-verify-multi-edit is the only discriminating scenario** — verify-after-edit compliance is stochastic (same finding as EXP-350/355). Arm A got lucky once (8/8), Arm C missed both.
4. **Arm C Trial 2 on partial-verification-trap** was actually better (3/6 vs 1/6) — the agent with fewer forced calls actually fixed the bug and ran tests, just missed edge cases.

### Preliminary Conclusion
The anti-shallow threshold (5 vs 10) has **no meaningful effect on task success**. The scenarios are either too hard or too easy for the threshold to matter. The threshold's real value is preventing "ghost completions" (sessions with 0 work), not improving task quality.

## Next Steps
- **Option 1**: Run Arm B (threshold=15) to complete the experiment
- **Option 2**: Close as INCONCLUSIVE — threshold doesn't affect task success, only session-completeness discipline
- **Recommendation**: Close. The anti-shallow rule's value is binary (prevents empty sessions), not gradient (more calls ≠ better work). Keep threshold=10 as reasonable minimum.
