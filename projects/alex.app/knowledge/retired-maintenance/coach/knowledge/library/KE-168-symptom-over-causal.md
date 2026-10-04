# KE-168: Symptom Descriptions Outperform Causal Explanations for Bug Discovery

**Source**: EXP-168 (F1 Dose-Response, N=385 across 13 arms)
**Date**: 2026-06-22
**Confidence**: HIGH (large N, clean dose-response curve)

## Finding

When helping agents discover relational bugs, **describing symptoms** (what's visibly wrong) is 2× more effective than **explaining causes** (why it's wrong):
- Symptoms → 75% pass rate
- Full causal analysis → 38% pass rate
- Vague nudges → 0% (same as baseline)

## Mechanism

The bottleneck is **recognition/attention**, not reasoning. Once the agent notices the right symptoms, it reasons its way to the fix. Causal explanations may actually distract — the agent reads the explanation instead of looking at the code.

## Design Rules

1. **Skills should describe failure symptoms**, not theories: "When tests pass individually but integration fails, suspect component ordering" 
2. **Minimum threshold**: You must name the problem domain. Generic advice ("be thorough") is indistinguishable from no advice.
3. **Sweet spot for training**: Problem identification without solution (47% pass rate) — agent still learns to fix it.
4. **Never stack**: Combined interventions (f1+f2) performed worse than single interventions (7% vs 38%). Confirms KE-123.

## Applies To

- Skill authoring for any agent
- Cascading/relational bug scenarios specifically  
- Any situation where discovery > reasoning is the bottleneck
