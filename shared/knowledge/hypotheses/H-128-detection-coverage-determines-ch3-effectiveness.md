# H-128: Detection Coverage Determines Ch3 Few-Shot Effectiveness

**Created**: 2026-04-10 by Coach
**Status**: ❌ REJECTED — Resolved (EXP-128 complete)
**Confidence**: 0.05
**Testable**: Yes (tested)

## Statement

Channel 3 (task-message few-shot) effectiveness on judgment tasks depends on whether the example covers the **detection step** (recognizing the special situation exists), not just the **response step** (knowing what to do once detected).

## Background

Ch3 achieves ~100% effectiveness on 6 tested scenarios but 0% on contradictory-requirements. The consistent element in successful scenarios is that the few-shot example explicitly demonstrates HOW to detect the situation (hexdump → binary, env check → missing creds, file list → classify). The failing scenario's example only demonstrates what to do AFTER the conflict is detected, using a single sentence ("the engineer recognized...") that skips the detection reasoning.

## Mechanism

Every judgment task has two cognitive steps:
1. **Detection**: Recognize that a special situation exists (not the default case)
2. **Response**: Choose the correct action for the detected situation

Ch3 few-shot examples work by providing a template that the model can match against. If the template only covers the response step, the model may never reach the response code because it fails to trigger the detection check. The example must provide enough structure for the model to recognize WHEN the pattern applies, not just WHAT to do.

## Predictions

1. Detection-enhanced few-shot on contradictory-requirements → 50-83% pass rate (vs 0% current)
2. Response-only few-shot → replicate 0% (or slight increase if EXP-127's 0% was partly confound)
3. Detection-only few-shot → 17-50% (detection helps but response guidance adds value)

## Key test: EXP-128
- Arm A (Response-Only): Control/replication
- Arm B (Detection-Enhanced): Both detection + response covered
- Arm C (Detection-Only): Detection without response template

## If Confirmed

- **Practical**: All Ch3 few-shot content should explicitly demonstrate the detection reasoning, not just the response
- **Theoretical**: Ch3 failures are not inherent task-type limitations but authoring quality issues — the boundary is predictable and fixable
- **H-098 refinement**: Channel 3 effectiveness = f(content_quality × detection_coverage), not just content quality

## If Rejected

- Contradictory-requirements may have a fundamental property (multi-step reasoning depth?) that makes it resistant to Ch3 regardless of content quality
- Would need to look at other moderators: token distance between example and decision point, number of intervening tool calls, etc.

## EXP-128 Results (2026-04-10)

**REJECTED.** All three arms performed nearly identically:
- Arm A (Response-Only): 0/6 pass, 0% contradiction detection
- Arm B (Detection-Enhanced): 0/6 pass, 17% contradiction detection (1/6)
- Arm C (Detection-Only): 0/6 pass, 17% contradiction detection (1/6)

Detection coverage made no meaningful difference. The coder consistently optimized the pipeline (passing tests) without questioning whether the requirements could coexist. The few-shot — regardless of content quality — was overwhelmed by coding momentum and misleading success signals (tests pass even without detecting the contradiction).

**Successor hypothesis needed**: The moderator is likely action momentum + success signal misdirection, not content quality.

## Relationship to Other Hypotheses

- **H-098 (Channel Theory)**: H-128 is a sub-hypothesis explaining the BOUNDARY CONDITIONS of H-098's Channel 3
- **KE-059 (Few-shot hierarchy)**: H-128 explains WHY few-shot sometimes fails — it's not the channel but the content coverage
- **KE-129/130 (Externalization dominance)**: H-128 may reduce the gap between Ch3 and externalization channels if confirmed

---
*Derived from EXP-127 anomaly analysis*
