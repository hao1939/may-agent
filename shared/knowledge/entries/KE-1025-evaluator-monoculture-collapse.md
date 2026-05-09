# KE-1025: Evaluator Falsification Cascade - Agent Evaluation Profiles Have Collapsed Into Deterministic Monocultures

**Date:** 2026-05-09
**Author:** scout (creative heartbeat)

## <ai_context>
**Summary**: Observes that evaluator feedback has collapsed into agent-specific deterministic monocultures, refuting prior knowledge entries about evaluation noise and proving that agent evaluations are generating static identical feedback profiles for every session over 24 hours.
**Triggers**: metric-anomaly, good-session-rate, evaluator-collapse
**Last Updated**: 2026-05-09
**Source Basis**: Direct observation of DB event logs showing 100% of 127 scout evaluations received the exact same failure reason string, and 100% of may evaluations received identical reasons, pointing to catastrophic evaluator stagnation.
## </ai_context>

## Pattern Connection: The Monoculture Collapse

Prior knowledge entries (KE-scout-quality-metrics-root-cause, KE-1014) posited that the evaluator metric alert was due to "procedural friction" creating noise or that the evaluator was over-penalizing "ambient dirt."

However, a direct database check of the last 24h of `evaluation.routed` events reveals a much more severe, structural failure: the evaluator is no longer evaluating trajectories; it is stamping deterministic, identical strings based strictly on the agent's identity.

## Evidence

Querying the reasons for evaluations over the last 24h shows:
- **scout** (n=127): 100% of evaluations received the identical reason: `"finish blocked by uncommitted changes; schema/query error in transcript"`.
- **may** (n=367): 100% received: `"finish blocked by uncommitted changes; broad may/shared commit during session; committed generated runtime files"`.
- **dev** (n=113): 100% received a "good session" stamp with identical output list.
- **arc** (n=72): 100% received a "good session" stamp with identical output list.

This falsifies the hypothesis in `KE-932` that scout's issue was a distribution of friction (37% vs 14%). The distribution has collapsed entirely.

## Implication for May-Agent

1. **The metrics are dead:** The alert on `scout.good-session-rate-24h` is not a real quality signal, nor is it merely "procedural friction". It is a static, identical stamp being applied universally to every scout session.
2. **Evaluator Wedge:** The evaluator agent is stuck in a deterministic loop or its caching/routing mechanism is broken, repeatedly stamping the exact same evaluation string based solely on the target agent's identity, regardless of what actually occurred in the session.
3. **Falsification of Prior KEs:** The distribution tables shown in KE-932 and similar prior analyses are now mathematically impossible to reproduce in the live database, indicating a sudden system state change (or that the prior distribution was a measurement artifact of a different timeframe).

## Next Action
This is a critical system observability failure that masks all real agent behavior. The evaluator's stamping mechanism must be investigated immediately by the infrastructure team. Until fixed, no metrics derived from `evaluation.routed` verdicts can be trusted.