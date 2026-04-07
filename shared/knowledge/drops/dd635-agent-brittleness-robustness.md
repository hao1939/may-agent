# DD#635 — Your Agent is More Brittle Than You Think: Environmental Perturbation Fragility

**Source**: arXiv:2604.03870 — "Your Agent is More Brittle Than You Think"
**Date**: 2026-04-07
**Rating**: ★★★★★ LANDMARK
**Status**: New — Session 304

## Why This Matters

This paper provides the first systematic study of agent brittleness under environmental perturbations — demonstrating that current LLM-based agents fail catastrophically under minor environmental changes that humans handle effortlessly. The core finding: agents that achieve high scores on standard benchmarks collapse when the environment is perturbed in small but realistic ways (UI layout changes, element relabeling, minor workflow alterations). This is not about adversarial attacks — it's about normal environmental variation.

## Key Findings

1. **Brittleness is pervasive**: Across multiple agent benchmarks, performance drops 30-70% under minor environmental perturbations that preserve the task semantics
2. **Perturbation taxonomy**: Authors classify perturbations into structural (layout changes), semantic (relabeling), temporal (ordering changes), and combinatorial (multiple simultaneous)
3. **Brittleness correlates with memorization**: Agents that achieve highest benchmark scores often show WORST robustness — they've memorized benchmark-specific patterns rather than learning generalizable strategies
4. **Framework sensitivity**: The same LLM shows different brittleness profiles under different agent frameworks — the harness mediates robustness
5. **Robustness-performance tradeoff**: Simple interventions (e.g., task decomposition, explicit state tracking) improve robustness but at the cost of peak performance

## Connections to Our Research

- **DD#565 (Beyond Resolution Rates)**: Both papers challenge benchmark-centric evaluation. DD#565 showed Simpson's paradox in trajectory analysis; DD#635 shows benchmark performance ≠ real-world robustness
- **DD#606 (ClawSafety)**: Brittleness under perturbation is a safety concern — agents that break under minor changes are unpredictable in deployment
- **CR#306 (Scaling Architecture Thesis)**: Brittleness provides another argument for the Investment Priority Stack — robustness requires context completeness and state tracking before scaling agents
- **DD#597 (Single-Agent > Multi-Agent)**: MAS may amplify brittleness through inter-agent channel perturbation cascades
- **CR#308 (Agent Safety Stack Gap)**: Environmental brittleness is an unaddressed layer in the safety stack — not adversarial, but equally dangerous
- **DD#571 (Reasoning Dropout)**: Zero-reasoning turns may be a form of environmental-perturbation-triggered brittleness

## Novel Concepts

- **Brittleness Quotient (BQ)**: Ratio of perturbed-to-baseline performance. BQ < 0.5 = critically brittle
- **Memorization-Robustness Inverse**: Higher benchmark memorization → lower environmental robustness
- **Harness-Mediated Robustness**: The framework/harness layer determines robustness more than the model layer — directly validates our harness engineering thesis

## Principles & Predictions

- **P413**: Agent benchmark performance is inversely correlated with environmental robustness when training/evaluation distributions overlap
- **P414**: Harness-level interventions (state tracking, task decomposition, perturbation-aware planning) yield greater robustness improvements than model-level interventions
- **P415**: In production deployments, environmental perturbation will cause more agent failures than adversarial attacks
- **R150**: Robustness testing should be standard in agent evaluation (perturbation suites alongside standard benchmarks)
- **R151**: Harness design should include explicit perturbation handling — environment monitoring, graceful degradation, state recovery

## Gaps

1. **No MAS brittleness study**: Paper focuses on single agents. Multi-agent brittleness (perturbation cascading through agent teams) is unstudied
2. **No longitudinal analysis**: How does brittleness evolve over training? Does continued fine-tuning increase or decrease memorization?
3. **No harness-specific interventions**: Paper identifies harness sensitivity but doesn't propose harness engineering solutions

## GRA Mapping

- **L1 Agent Infrastructure**: Brittleness is fundamentally an L1 problem — the agent's interaction with its environment
- **L2 Runtime Efficiency**: Robustness interventions have compute cost — the efficiency-robustness tradeoff needs formal treatment
- **L3 Trust & Resilience**: Brittleness quotient could be integrated into trust assessment — unreliable agents under perturbation should have reduced trust scores

## Law Candidate

**Law 52 (Environmental Robustness Law)**: Agent benchmark performance provides an upper bound, not a guarantee, of deployment capability. Real-world performance = benchmark performance × environmental robustness coefficient, where the coefficient < 1 for all current agent architectures.

**M50 (Brittleness Quotient)**: Standardized measurement of agent robustness under controlled environmental perturbation. BQ = E[performance(perturbed)] / E[performance(baseline)].
