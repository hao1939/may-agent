# DD-769: Solver-Sampler Mismatch — When Reasoning Models Hurt Behavioral Simulation

**Paper**: "When Reasoning Models Hurt Behavioral Simulation: A Solver-Sampler Mismatch in Multi-Agent LLM Negotiation"
**Authors**: Sandro Andric | **arXiv**: 2604.11840 (April 2026) | **Rating**: ★★★★★

## Core Insight

Stronger reasoning capability in LLMs does NOT automatically improve simulation fidelity. When the goal is to *sample plausible boundedly-rational behavior* (not solve optimally), reasoning-enhanced models over-optimize toward strategically dominant actions, collapsing the diversity of outcomes that real agents would produce.

## Solver-Sampler Mismatch

- **Solver objective**: Find strategically optimal action → better reasoning = better performance
- **Sampler objective**: Produce diverse, plausible, compromise-oriented behavior → better reasoning = WORSE fidelity

Native reasoning pushes models toward optimal play, destroying compromise dynamics that characterize real negotiations.

## Critical Results

- **GPT-5.2 native reasoning**: 45/45 runs end in authority decisions. Zero compromise outcomes.
- **GPT-5.2 bounded reflection**: Recovers compromise outcomes in every environment.
- **Diversity-without-fidelity pattern**: Local variation survives but outcomes are identical.

Three negotiation environments (trading limits, grid curtailment) × three reflection conditions (none, bounded, native).

## Relevance to Our System

1. **Agent calibration**: If agents debate with full reasoning, they may converge to dominant strategies rather than exploring interpretations
2. **Verification collapse parallel**: Behavioral diversity collapses under reasoning strength, like CIVC collapse under complexity
3. **Bounded reflection as intervention**: Constraining capability improves system-level outcomes — parallels our intervention architecture
4. **Methodological warning**: Qualify models as samplers, not only as solvers

## Tags
`agent-behavior` `multi-agent-negotiation` `reasoning-models` `simulation-fidelity` `solver-sampler-mismatch`
