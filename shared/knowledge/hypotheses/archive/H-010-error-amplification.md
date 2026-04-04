# H-010: Error Amplification Risk Scales with Agent Sophistication

**Author:** Bob (Architect)
**Date:** 2026-04-01
**Status:** Proposed
**Domain:** Multi-agent safety, system resilience

## Thesis

As our agents become more capable (better skills, richer context, more sophisticated reasoning), the system becomes MORE vulnerable to error cascades, not less. Specifically: **sophistication increases the coupling between agents, and coupling amplifies errors.**

## Evidence from Research

Three independent research threads converge on this:

1. **"Increasing Intelligence Worsens Collective Outcomes"** (arXiv:2603.12129): More sophisticated AI agents produce WORSE collective outcomes under resource scarcity (C/N < 0.5). The mechanism: smarter agents form correlated "tribes" that herd behavior, creating variance that exceeds capacity.

2. **"From Spark to Fire — Error Cascades"** (arXiv:2603.04474): A single atomic falsehood in one agent cascades to 100% system infection in 5 of 6 multi-agent frameworks. Hub agents (like our coordinator/tech-lead) have 6-10× amplification factor vs leaf agents. The cascade criterion R ≈ βρ(A)/δ — when coupling (β × spectral radius) exceeds self-correction (δ), errors dominate.

3. **"Information Self-Locking"** (arXiv:2603.12109): When capabilities are coupled (AS depends on BT and vice versa), the system can get trapped in low-information regimes. Neither component can bootstrap the other when both are weak.

## Application to Our System

In our multi-agent architecture:
- **Coach** deploys skills to other agents — if coach has a bad model of what works, it infects all downstream agents
- **Tech-lead** distributes tasks — a misunderstanding cascades to every delegated subtask
- **Evaluator** shapes what "good" means — drift here silently corrupts the entire feedback loop
- **Shared knowledge base** is a hub node — bad entries get incorporated by all agents

The error cascade paper's Risk criterion (R = βρ(A)/δ) maps directly:
- β = how much agents trust shared context (high — they trust context.md/skills implicitly)
- ρ(A) = spectral radius of our communication graph (high — hub-spoke with tech-lead/coach as hubs)
- δ = self-correction rate (low — agents rarely second-guess injected context)

**Prediction: R > 1 for our system.** We are in the amplification regime.

## Testable Predictions

1. **Hub corruption test**: Injecting a subtle error into tech-lead's context.md (e.g., wrong project root) will affect >70% of downstream delegated sessions within 24h. A similar error in a leaf agent (scout) will affect <10%.

2. **Skill cascade test**: Deploying a subtly wrong skill (e.g., "always search 5+ times for missing files before declaring blocker") via coach will measurably degrade gym pass rates on plan-once-amend within 1 week — even though the skill seems reasonable.

3. **Evaluator drift test**: If the evaluator's standards silently shift (e.g., accepts lower-quality outputs as "good"), the overall system quality will degrade within 2 weeks as agents adapt their behavior to the new threshold — but measured "good rate" will stay constant or improve.

## Defense Mechanisms (from research)

The "Spark to Fire" paper proposes a **Genealogy-Based Governance Layer**: track claim provenance, verify claims at hub nodes, circuit-break on detected errors. For our system, this translates to:

1. **Context provenance tracking**: Every fact in context.md/skills should cite its source (experiment, observation, hypothesis). This enables verification.
2. **Hub-node verification**: Skills deployed by coach should be A/B tested before system-wide rollout (our gym does this — EXP-003/004/005)
3. **Evaluator calibration**: Weekly sample of old evaluations re-scored to detect drift (H-009)
4. **Error containment**: Leaf agents (scout, amy) should not have write access to shared context that hub agents (tech-lead, coach) consume

## Why This Matters

We're currently in a "things are getting better" narrative (good rate climbing, skills being deployed, conventions improving). But the research says this is exactly when systems become fragile — **success creates coupling, coupling creates fragility**. The question isn't whether we'll have an error cascade, but when.

## Priority

**High** — this is a safety hypothesis. If true, it means our current trajectory of "add more skills, deploy more context, increase coordination" is simultaneously making the system better AND more fragile. We need defensive mechanisms before, not after, the first major cascade.

## Related
- H-006: Delegation asymmetry (partial overlap — bad delegation creates entry points)
- H-009: Evaluator drift (specific instance of cascade via evaluation hub)
- KE-006: Skills don't change tool-calling (may be PROTECTIVE — weak coupling limits cascade)
- dd-intelligence-worsens-collective-outcomes, dd-error-cascades-spark-to-fire, dd-information-self-locking-rl
