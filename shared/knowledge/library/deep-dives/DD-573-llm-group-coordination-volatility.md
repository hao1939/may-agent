# DD#573: LLM Group Coordination Deficits — High Volatility and Action Bias

**Source**: arXiv:2604.02578 — Maini, Goldstone, Tiganj (Indiana U)
**Date**: 2026-04-07
**Rating**: ★★★★ — First rigorous human-vs-LLM group coordination comparison

## Core Contribution

First systematic comparison of LLM vs human group coordination using common-interest game (Group Binary Search: n players submit numbers summing to target, with only group feedback). Key findings:

1. **High volatility**: LLMs exhibit excessive strategy switching across rounds; humans stabilize and converge
2. **Action bias**: LLMs change actions more frequently than optimal, even when staying is better
3. **Feedback insensitivity**: Richer feedback (numerical error magnitude) helps humans substantially, small effect on LLMs
4. **No cross-game learning**: Unlike humans, LLMs fail to transfer coordination strategies

## Key Insights

### Volatility Problem
LLMs change values excessively between rounds. In coordination games, this is pathological: simultaneous changes → oscillation not convergence. This is the behavioral mechanism behind the integration bottleneck (CR-296).

### Action Bias ≈ Reasoning Dropout at Group Level
Maps to DD-571: adaptive thinking drops reasoning on "easy" turns → defaults to pattern-matching → generates new action rather than strategically holding.

### Feedback Insensitivity
Simply providing more feedback to LLM agents doesn't improve coordination. Harness must **translate feedback into explicit strategy suggestions** rather than relying on model to extract behavioral update.

### The Learning Gap
No cross-game learning = statefulness gap. Each interaction starts from scratch unless harness provides explicit memory of past coordination patterns. Direct connection to DD-559 (Hippo), DD-567 (M-Flow) memory architectures.

## Diagnostic Framework

Mechanism-level metrics for LLM coordination evaluation:
- Reactivity scaling (response to feedback magnitude)
- Switching dynamics (rate/magnitude of action changes)
- Cross-game learning (strategy improvement across interactions)

## Fundamental Insight
Coordination requires agents to be **predictable** to each other. LLM volatility makes them unpredictable partners, breaking implicit mutual modeling.

## Predictions

- P356: MAS will adopt explicit coordination protocols (turn-taking, role assignment, strategy declaration) rather than relying on emergent coordination
- P357: "Coordination memory" module storing past successful patterns becomes standard within 18 months

**Seeds KE-086.**
