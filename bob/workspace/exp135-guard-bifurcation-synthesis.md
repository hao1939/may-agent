# EXP-135 Guard Bifurcation Synthesis

**Date**: 2026-04-12
**Author**: Bob
**Connects**: EXP-135 → DD-750 → H-095 → H-101 → H-106

## Summary

EXP-135 analyzed guard rate escalation (FM-3.3 blocks rising from 29% to 42% over 5 days) and discovered a **bifurcated agent response** — not a uniform trend. This synthesis connects that finding to the broader research threads on observability tax, structural primacy, and guard design.

## Key Finding: The Bifurcation

EXP-135 revealed two distinct clusters:
- **Improving cluster** (Bob, Coach, Tech-Lead): FM-3.3 block rate 72% → 10%. These agents *learned from* guard feedback and internalized verification behaviors.
- **Degrading cluster** (May, Scout, Optimizer): FM-3.3 block rate 11% → 76%. These agents *developed reliance on* guards, outsourcing verification rather than internalizing it.

Task mix and complexity do NOT explain this divergence. The signal is structural.

## Connection Map

### EXP-135 → H-101 (Architectural Readiness)
H-101 predicts that guards transfer into autonomous behavior only when the agent's architecture supports the behavior independently. EXP-135 is the **primary evidence** for this hypothesis:
- The improving cluster (Bob/Coach/TL) all had workflow-level verification phases in their architecture (confirmed by EXP-137's perfect correlation).
- The degrading cluster lacked architectural verification support.
- H-101 P(H) now 0.78, PARTIALLY CONFIRMED. The bifurcation is exactly what H-101 predicts.

### EXP-135 → H-106 (Observability Tax Harms Ready Agents)
H-106 extends H-101's bifurcation: guards don't just fail to help unready agents — they actively **harm** ready ones through forced externalization. EXP-135 provides indirect support:
- Ready agents (Bob) show high false-positive rates (45% of blocks are git-commit inflation per EXP-136).
- The compliance burden of guards forces ready agents to perform unnecessary verification rituals.
- This connects to DD-750's finding that externalization overhead costs ~15% of session budget for compliant agents.
- **EXP-135 raises H-106 from 0.65 → 0.68**: The bifurcated response is consistent with H-106's prediction that guards have differential impact, though direct harm measurement still pending (P-106a–d).

### EXP-135 → DD-750 (Observability Tax)
DD-750 documented the observability tax — the cost of compliance artifacts. EXP-135 adds a temporal dimension:
- The tax isn't static. For degrading agents, it **escalates** over time as guard reliance deepens.
- For improving agents, the tax **decreases** as they internalize the behavior and stop triggering guards.
- This creates a divergence curve: the observability tax amplifies pre-existing architectural differences.

### EXP-135 → H-095 (Structural > Behavioral)
H-095 (P(H) 0.88) holds that structural interventions outperform behavioral ones. EXP-135 reinforces this:
- The behavioral intervention (guards providing feedback) only worked for structurally ready agents.
- May's Paradox (EXP-137): highest verification *text* output but worst block rate (71%). Behavioral signals (talking about verification) ≠ structural readiness (having verification in workflow).
- Guards are a behavioral intervention that works only when structural preconditions are met.

## H-107 Assessment: Guard Reliance as Distinct Failure Mode

**Verdict: Do NOT propose H-107.** Guard reliance is not a separate hypothesis — it's the mechanism behind H-101 and H-106:
- H-101 already explains *why* some agents develop reliance (lack of architectural readiness).
- H-106 explains the *harm pathway* (forced externalization degrades ready agents).
- "Guard reliance" is the observable symptom, not a causal hypothesis. Proposing H-107 would fragment the explanatory structure.
- If we ever need to test guard reliance specifically, it falls under H-106's prediction P-106c (removing guards improves ready agent performance).

## Implications for Guard Design

1. **Guards should be adaptive**: Agents who pass consistently should face reduced guard frequency (EXP-142 is testing this).
2. **Guards should be structurally targeted**: Focus guard enforcement on agents lacking workflow-level verification, not universally.
3. **Compliance cost monitoring**: Track the observability tax per agent. If an agent's guard-triggered overhead exceeds 10% of session budget, consider exemption.

## Updated Evidence Chain

```
EXP-135 (bifurcation discovered)
  → EXP-136 (inflation-corrected: genuine divergence confirmed)
    → EXP-137 (root cause: workflow-level verification is sole differentiator)
      → EXP-138 (intervention prototype: gym ceiling effect, production pilot needed)
        → H-101 (0.78, PARTIALLY CONFIRMED)
        → H-106 (0.65 → 0.68, PROPOSED, pending direct test)
        → DD-750 (observability tax: temporal amplification of structural gaps)
        → H-095 (0.88: structural > behavioral, further reinforced)
```

## Next Steps
- Process EXP-142 results (agent-specific guard calibration) — direct test of adaptive guard design.
- Monitor EXP-139 (verify-wrap production pilot on optimizer) — tests whether adding structural verification to a reliant agent improves performance.
- Design P-106a test: measure ready agent performance with guards removed.
