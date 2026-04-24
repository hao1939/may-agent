# EXP-215: Results

**Status**: DEPLOYED — measuring
**Deployed**: 2026-08-02
**Intervention**: Added belief-externalization prompt to `buildReviewPrompt()` in `agents/shared/workflows/project.ts` (line 394)

## Phase 1: Baseline (measured 2026-06-25)

**FM-3.3 session incidence rate**: 2.9% of all non-skipped evaluations (739 / 25,385 total).
**FM-3.3 as % of all flagged issues**: 6.4% (44 / 686 issues in last 200 sessions with issues).
**Recent 50-session rate**: 4.0% (2/50).

Note: EXP-099's "20.3%" was FM-3.3 as a proportion of *verification-related errors*, not all sessions. The absolute session-level rate is much lower (~3-4%). This means the effect size needed to detect a change is larger — we need many sessions or a dramatic drop.

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
| A (baseline) | 25,385 | 2.9% session / 6.4% issue-share | Historical (all time) |
| B (externalization) | 0/10 | TBD | Measuring |

## Conclusion

Pending — need ~10 project iterations to measure.

## Followups

- Count baseline FM-3.3 from recent evaluator data
- After 10 iterations, analyze and write KE
