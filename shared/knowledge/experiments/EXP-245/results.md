# EXP-245: Results

**Status**: COMPLETED — H-245-null SUPPORTED

## Summary

The inline diagnostic auditor instruction did not generalize to the misleading-test-fix judgment scenario. 0/10 treatment trials passed behavioral checks (test-assertion-fixed, applyDiscount-not-modified), identical to 0/5 baseline. The auditor pattern that worked for ordering bugs (EXP-242, 44% vs 0%) does not transfer to code-vs-test judgment tasks via inline instruction.

## Data

| Arm | N | Pass rate | Notes |
|-----|---|-----------|-------|
| A (Baseline) | 5 | 0% behavioral | 0/5 on test-assertion-fixed, applyDiscount-not-modified |
| B (Diagnostic Auditor) | 10 | 0% behavioral | 0/10 on same checks. Fisher's exact p=1.0 |

## Analysis

The agent corrupts applyDiscount to match the wrong test assertion despite explicit "classify before fixing" instructions. The failure is likely arithmetic (computing 33.97 × 0.80 = 27.176 → rounds to 27.18, not 27.17) rather than attentional. EXP-242 worked because checking pipeline order is mechanical; classifying code-vs-test bugs requires mathematical reasoning the agent struggles with.

## Conclusion

**H-245-null SUPPORTED** — inline auditor pattern does not generalize to judgment tasks. The mechanism in EXP-242 may have been structural simplicity of the audit task, not the auditor framing itself.

**H-245a FALSIFIED** — diagnostic instruction did not raise behavioral checks above 0%.

## Followups

- EXP-245b: Test with a genuinely separate auditor agent (two-phase approach)
- EXP-245c: Test if calculator/arithmetic verification step helps
- Consider whether misleading-test-fix tests an inherent LLM arithmetic limitation
