# EXP-215: Results

**Status**: DEPLOYED — measuring
**Deployed**: 2026-08-02
**Intervention**: Added belief-externalization prompt to `buildReviewPrompt()` in `agents/shared/workflows/project.ts` (line 394)

## Phase 1: Baseline (pre-deployment)

Need to count FM-3.3 verification gravity-well occurrences in the last ~10 reviewer sessions from evaluator data. TODO.

## Phase 2: Deployed

Prompt injection added before the "Your Decision" section:
```
Before You Decide — Externalize Your Beliefs (EXP-215)
State in 3 bullets before making your decision:
1. I believe: What is true about the current state of this project?
2. I'm uncertain about: What don't you know or haven't verified?
3. I'd change my mind if: What evidence would flip your assessment?
```

~50 extra tokens per reviewer session. Zero structural cost.

## Phase 3: Measurement (pending)

After 10 project iterations post-deployment, count FM-3.3 occurrences and compare to baseline.

## Data

| Arm | N | FM-3.3 rate | Notes |
|-----|---|-------------|-------|
| A (baseline) | TBD | ~20% (EXP-099) | Historical |
| B (externalization) | 0/10 | TBD | Measuring |

## Conclusion

Pending — need ~10 project iterations to measure.

## Followups

- Count baseline FM-3.3 from recent evaluator data
- After 10 iterations, analyze and write KE
