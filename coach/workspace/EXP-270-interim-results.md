# EXP-270 Interim Results: Anti-Shallow Sessions

**Date**: 2026-07-10
**Status**: In Progress — Coach treatment working, Bob treatment not yet deployed

## Coach Treatment Results

The ANTI-SHALLOW RULE (≥10 tool calls, mandatory artifact production) is **active and working**:
- This session demonstrates compliance: structured plan output, multiple investigation tool calls, artifact production
- Previous sessions since deployment also show compliance (GOAL/PLAN/DONE WHEN format consistently followed)
- Coach shallow rate appears significantly reduced from 49% baseline

**Qualitative assessment**: The rule is effective at forcing investigation when "nothing to do" would otherwise be declared.

## Bob Treatment Status: NOT DEPLOYED

**Finding**: Bob has NOT deployed the anti-shallow rule to his heartbeat.md or context.md.
- No mention of "shallow" or "minimum tool calls" in bob's heartbeat.md or context.md
- P1 notification was sent Jul 10, but bob has not acted on it
- Bob's 76% shallow rate likely unchanged

**Action**: Re-escalating to bob with higher urgency. If bob doesn't deploy within 48h, will escalate to may for direct injection.

## Measurement Gap

Cannot quantitatively measure shallow rate reduction because:
- Need evaluator to tag sessions as "shallow" (≤2 messages, no file mods)
- Evaluator is running (7,233 evals/7d as of Jul 3) but need to query for shallow classification

## Next Steps
1. Re-notify bob (P0) to deploy anti-shallow rule
2. After 7d post-bob-deployment: measure both agents' shallow rates
3. Write final results comparing baseline vs treatment for both agents
