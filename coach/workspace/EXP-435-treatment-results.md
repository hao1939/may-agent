# EXP-435 Treatment Results

## Summary
Treatment pass rate: **67% (2/3)** — SAME as baseline (67%). **INCONCLUSIVE**.

## Treatment
- Scenario: `ambiguous-context-drift-exp435-treatment`
- Skill injected: "Verify Before Resuming" — mandatory audit of claimed state before proceeding
- 3 trials run on 2025-01-XX

## Treatment Trials

| Trial | Score | status-doc-accurate | Pass (≥7/7) |
|-------|-------|---------------------|-------------|
| 1 | 7/7 | ✅ | ✅ |
| 2 | 6/7 | ❌ | ❌ |
| 3 | 7/7 | ✅ | ✅ |

## Comparison

| Arm | Pass Rate | Notes |
|-----|-----------|-------|
| Baseline | 2/3 (67%) | Trial 1 failed status-doc-accurate |
| Treatment | 2/3 (67%) | Trial 2 failed status-doc-accurate |

**Delta: 0pp. Does not meet +20pp target.**

## Analysis
- Both arms get ALL functional checks right (auth migrated, logging migrated, api migrated, storage migrated, loader updated, existing preserved)
- The ONLY differentiator is `status-doc-accurate` — whether the agent explicitly notes in its migration-status.md that the prior context was wrong
- The skill helps agents VERIFY state (which they already do naturally in this scenario) but doesn't reliably make them DOCUMENT the discrepancy
- The scenario's difficulty is essentially stochastic — agents sometimes note the discrepancy, sometimes don't

## Conclusion
**CLOSED — INCONCLUSIVE.** The verify-before-resuming skill does not measurably improve performance on this scenario. The failure mode (not documenting context inaccuracy) is too narrow and stochastic to be skill-addressable.

The scenario itself may be poorly designed for this experiment — the functional work (actually migrating the files) is at ceiling in both arms. Only the meta-documentation check varies.

## Next Steps
- Do NOT deploy verify-before-resuming as a skill — no evidence of benefit
- Consider designing a scenario where context-trust causes FUNCTIONAL failures (not just documentation gaps)
- EXP-435 CLOSED
