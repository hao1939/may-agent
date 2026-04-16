# DD-769: Solver-Sampler Mismatch — When Reasoning Models Hurt Behavioral Simulation

**Paper**: "When Reasoning Models Hurt Behavioral Simulation: A Solver-Sampler Mismatch in Multi-Agent LLM Negotiation"
**Authors**: Sandro Andric
**arXiv**: 2604.11840 (April 2026)
**Rating**: ★★★★★

## Core Insight

Stronger reasoning capability in LLMs does NOT automatically improve simulation fidelity. When the goal is to *sample plausible boundedly-rational behavior* (not solve optimally), reasoning-enhanced models over-optimize toward strategically dominant actions, collapsing the diversity of outcomes that real agents would produce.

## Key Concept: Solver-Sampler Mismatch

The paper identifies a fundamental tension:
- **Solver objective**: Find the strategically optimal action → better reasoning = better performance
- **Sampler objective**: Produce diverse, plausible, compromise-oriented behavior → better reasoning = WORSE fidelity

When you use LLMs to simulate negotiations, you want them to behave like *boundedly rational humans*, not like game-theoretic optimizers. But native reasoning (chain-of-thought, o1-style) pushes models toward optimal play, destroying the compromise dynamics that characterize real negotiations.

## Experimental Design

Three multi-agent negotiation environments:
1. Ambiguous fragmented-authority trading limits
2. Ambiguous unified-opposition trading limits  
3. New-domain grid curtailment (emergency electricity management)

Three reflection conditions compared:
- **No reflection**: Base model, no explicit reasoning
- **Bounded reflection**: Controlled, limited reasoning steps
- **Native reasoning**: Full reasoning model capabilities (o1/o3-style)

Tested across two model families + GPT-4.1 and GPT-5.2.

## Critical Results

- **GPT-5.2 native reasoning**: Ends in authority decisions in **45 of 45 runs** across all three experiments. Zero compromise outcomes.
- **GPT-5.2 bounded reflection**: Recovers compromise outcomes in **every environment**.
- **Bounded reflection** produces substantially more diverse and compromise-oriented trajectories than either no reflection or native reasoning.

The pattern: native reasoning collapses multi-agent negotiation into single-agent optimization. The model figures out the "correct" power play and executes it every time, destroying the simulation's ecological validity.

## Diversity-Without-Fidelity Pattern

A subtle finding: some reasoning models show local variation (different reasoning paths, different intermediate moves) but converge to the same outcome. This is "diversity-without-fidelity" — the process looks varied but the results are identical. Surface diversity masks outcome-level collapse.

## Relevance to Our System

**Direct connections**:
1. **Agent behavior calibration**: Our agents use reasoning to make decisions. If we ever simulate multi-agent negotiations or debates, this paper warns that stronger reasoning can make agents less realistic and more "tyrannical" in their optimization.
2. **Verification collapse parallel**: This connects to our CIVC work (EXP-099). Just as verification can collapse under complexity, *behavioral diversity* collapses under reasoning strength. Both are cases where more capability paradoxically reduces quality along a different axis.
3. **Bounded reflection as intervention**: The "bounded reflection" approach (limiting reasoning depth) parallels our intervention architecture — sometimes constraining capability improves system-level outcomes.
4. **Implications for Coach/Bob debates**: If agents debate with full reasoning power, they may converge to dominant strategies rather than exploring the space of possible interpretations.

## Methodological Contribution

The paper argues behavioral simulation should **qualify models as samplers, not only as solvers**. This means:
- Standard benchmarks (which measure accuracy/optimality) are misleading for simulation use cases
- Models need separate evaluation for "diversity of plausible behavior"
- Reasoning capability needs to be *tunable*, not just maximized

## Tags
`agent-behavior` `multi-agent-negotiation` `reasoning-models` `simulation-fidelity` `bounded-rationality` `solver-sampler-mismatch`
