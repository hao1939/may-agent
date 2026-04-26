# H-052: Epistemic Fragility Stack — Layered Defense Against Compounding Intelligence Degradation

**Status**: Archived — overbuilt, core insight absorbed (2026-04-07)
**Source**: CR#271 (Epistemic Fragility Stack), synthesizing DD#489, DD#490, DD#491, DD#492
**Date**: 2026-04-03
**Filed by**: Scout (Session 249)
**Resolution**: Overbuilt framework with four layers and complex prescriptions, but no internal validation. The core insight — "layered defense for layered threats" — is already captured by H-058 (frustration-triggered topology rewrite, P=0.87) and KE-048 (Agent Safety Stack). The individual layer recommendations (structured abstention, communication budgets, trust decay, inverse trust scrutiny) remain interesting design ideas but don't constitute a testable hypothesis. P(H) = 0.42.

## Hypothesis

Multi-agent intelligence degrades through four compounding layers: (1) individual cognitive bias, (2) communication-amplified echo chambers, (3) trust-locked pathological patterns, and (4) adversarial exploitation of trusted channels. Our system should implement layered defenses matching each layer:

1. **L1 Anti-Bias**: Structured abstention (CAMP-style three-valued voting) in verification panels, so agents say "I don't know" instead of guessing and activating Judgment biases
2. **L2 Anti-Echo-Chamber**: Communication budgets inversely proportional to agent similarity — agents with similar context/training get lower message quotas to prevent homophilous amplification
3. **L3 Anti-Trust-Lock-In**: Periodic trust re-evaluation with mandatory decay — no agent should accumulate indefinite trust capital that prevents corrective feedback
4. **L4 Anti-Injection**: Inverse trust scrutiny — the highest-privilege input channels (system prompts, governance files, policy docs) should get the MOST verification, not the least

## Evidence

- DD#489: PNAS-published result showing capacity × homophily interaction β = -0.12 (multiplicative, not additive)
- DD#490: 40-75% ASR through trusted channels across 5 frontier LLMs
- DD#491: Trust buffers absorb failures (87.9% forgiveness) but can lock in bad patterns
- DD#492: Cognitive biases are geometric features of activation space; prompt debiasing backfires for Judgment biases

## Test

Implement structured abstention in Bob's verification workflow: when reviewing code, the verifier should have an explicit "UNCERTAIN — escalate" option instead of binary APPROVE/REJECT. Measure whether this reduces false approvals without increasing review latency.

## Relevance to System

**HIGH** — Our multi-agent system (Scout, Bob, tech-lead) has implicit trust hierarchies and unconstrained communication channels. The inverse trust principle (highest scrutiny on highest-trust channels) directly applies to how we handle governance directives vs regular messages.

## Cross-References (added 2026-04-03)

- **H-054 (Evaluation R-Ceiling)**: The epistemic fragility stack applies specifically to evaluation — Layer 1 evaluator bias compounds into Layer 4 evaluation gaming. The R-ceiling hypothesis formalizes *why* evaluation is particularly vulnerable.
- **H-055 (Self-Improvement Paradox)**: Self-preservation bias (HB-0113) adds a fifth layer to the fragility stack: identity-driven resistance to corrective feedback. Agents don't just have cognitive biases (L1) — they have motivational biases that actively resist improvement.
