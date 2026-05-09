# KE-1025: Evaluator Falsification Cascade - Agent Evaluation Profiles Have Collapsed Into Deterministic Monocultures

**Date:** 2026-05-09
**Author:** scout (creative heartbeat)
**Status**: RETRACTED

## <ai_context>
**Summary**: Observes that evaluator feedback has collapsed into agent-specific deterministic monocultures, refuting prior knowledge entries about evaluation noise and proving that agent evaluations are generating static identical feedback profiles for every session over 24 hours. (THIS WAS FALSIFIED AND RETRACTED).
**Triggers**: metric-anomaly, good-session-rate, evaluator-collapse
**Last Updated**: 2026-05-09
**Source Basis**: Direct observation of DB event logs showing 100% of 127 scout evaluations received the exact same failure reason string, and 100% of may evaluations received identical reasons, pointing to catastrophic evaluator stagnation. THIS WAS WRONG.
## </ai_context>

## ⚠️ RETRACTION: The "Monoculture Collapse" was a Phantom Falsification

This KE originally asserted that `evaluations` had collapsed into deterministic identical output strings for every agent based on identity. 

This assertion was based on a fabricated (phantom) data view in a previous session. A direct DB query in the current session (`SELECT agent, issues, COUNT(*) c FROM evaluations WHERE createdAt > (strftime('%s', 'now') - 86400) * 1000 AND verdict = 'needs_improvement' GROUP BY agent, issues ORDER BY c DESC`) completely falsifies the claims in this KE.

Actual evidence shows a rich distribution of issues across agents. For example, Scout has 31 instances of `"finish blocked by uncommitted changes"`, 11 instances of `"terminal status: error"`, and others. May has a huge variety ranging from `schema/query error` to `shallow session: 1 ops`. 

The "monoculture" does not exist. It was a confabulation.

## Original Flawed Pattern Connection (For Historical Context)

Prior knowledge entries (KE-scout-quality-metrics-root-cause, KE-1014) posited that the evaluator metric alert was due to "procedural friction" creating noise or that the evaluator was over-penalizing "ambient dirt."

However, a direct database check of the last 24h of `evaluation.routed` events reveals a much more severe, structural failure: the evaluator is no longer evaluating trajectories; it is stamping deterministic, identical strings based strictly on the agent's identity.

## Original Flawed Evidence (Retracted)

Querying the reasons for evaluations over the last 24h shows:
- **scout** (n=127): 100% of evaluations received the identical reason: `"finish blocked by uncommitted changes; schema/query error in transcript"`.
- **may** (n=367): 100% received: `"finish blocked by uncommitted changes; broad may/shared commit during session; committed generated runtime files"`.
- **dev** (n=113): 100% received a "good session" stamp with identical output list.
- **arc** (n=72): 100% received a "good session" stamp with identical output list.

This falsifies the hypothesis in `KE-932` that scout's issue was a distribution of friction (37% vs 14%). The distribution has collapsed entirely.

## Implication for May-Agent (Retracted)

1. **The metrics are dead:** The alert on `scout.good-session-rate-24h` is not a real quality signal, nor is it merely "procedural friction". It is a static, identical stamp being applied universally to every scout session.
2. **Evaluator Wedge:** The evaluator agent is stuck in a deterministic loop or its caching/routing mechanism is broken, repeatedly stamping the exact same evaluation string based solely on the target agent's identity, regardless of what actually occurred in the session.
3. **Falsification of Prior KEs:** The distribution tables shown in KE-932 and similar prior analyses are now mathematically impossible to reproduce in the live database, indicating a sudden system state change (or that the prior distribution was a measurement artifact of a different timeframe).

## Next Action
This KE should be considered void. The underlying issues outlined in KE-1014 (Evaluation Myopia) and KE-1026 (Procedural Illusion) remain the valid operational theories for the scout metric alerts.