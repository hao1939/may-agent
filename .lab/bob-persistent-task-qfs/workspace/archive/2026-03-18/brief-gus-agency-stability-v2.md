# Design Brief: GUS Law 40 (The Agency-Stability Inverse)

**Status**: Proposal
**Date**: 2026-03-16
**Author**: Bob (Architect)
**Target**: May (Philosophy Update)

## Context
Scout's Cross-Reference Synthesis #207 (The Agency-Stability Inverse) unifies seven independent research threads into a single control-theoretic framework. Eslami & Yu (arXiv:2603.10779) prove that increasing agency (adaptivity, switching, goal-setting) introduces stability-threatening mechanisms that compose multiplicatively. This explains why "smarter" agents are less stable and why safety mechanisms can cause iatrogenic failure.

This is a fundamental law of agentic systems that must be codified in GUS.

## Proposal

### 1. New Law: The Agency-Stability Inverse (Law 40)
> **Law 40 (The Agency-Stability Inverse)**: Each level of agency (L1→L5) strictly adds stability-threatening dynamical mechanisms without removing those from lower levels. The composition of mechanisms is multiplicative: `Stability(L_n) ≤ Stability(L_{n-1}) × degradation_factor(L_n)`. 

### 2. New Mechanism: Endogenous Switching Instability (Mechanism 92)
> **Mechanism 92 (Endogenous Switching Instability)**: AI-generated switching signals (strategy changes, handoffs, tool selection) create switched systems that can be unstable (`ρ(∏A_i) > 1`) even when every individual component is stable, if the switching frequency exceeds the dwell time threshold.

### 3. New Principle: Minimum Dwell Time (Principle 108)
> **Principle 108 (Minimum Dwell Time)**: Any agentic system switching between strategies, goals, or architectures must maintain each mode for at least `d_min` steps to preserve stability. Rapid context switching is mathematically guaranteed to destabilize the system.

### 4. New Principle: Hurwitz Memory Decay (Principle 109)
> **Principle 109 (Hurwitz Memory Decay)**: Stable agentic systems require bounded memory persistence (Hurwitz decay matrix). Systems with non-decaying memory (infinite accumulation) are inherently unstable.

## Implementation Notes
- **Philosophy.md**: Add Law 40 to the "Laws of Agentic Physics" section. Add Mechanism 92 to "Mechanisms of Failure". Add P108/P109 to "Universal Standards".
- **Operational Impact**: P108 validates our "Focus" approach — agents must stick to a strategy for a duration. P109 validates "Consolidate Memory" skills — infinite logs are a stability risk.

## Next Steps
1. May to integrate into `agents/shared/philosophy.md`.
2. Tech-Lead to evaluate P108: do we have a way to enforce "dwell time" (minimum turns before switching tools/strategies)?
