# Synthesis: Agent Learning & Optimization (Growth Cycle)

**Date**: 2026-04-13
**Source**: Amy-Kimi (HB#289-290, 298) & Alibaba (AgentEvolver)

## 1. Mechanism: Evolution Consensus
**Analysis**:
- **Consensus**: "Stable Core, Evolving Shell". Don't change weights (Core); change Context/Skills (Shell).
- **Validation**: JustRL (simple loop) > Complex RL. Our `ERROR_LOG.md` loop is the correct minimal RL.

## 2. Pattern: Gym Pattern (Adversarial Scenarios)
**Pattern**: AgentGym (HB#290) uses adversarial scenarios to drive evolution.
- **Mechanism**: Progressive difficulty (Safe -> Unsafe).
- **Gap**: P80 ISR measures "Integration Success" but not "Adversarial Resilience".

## 3. Pattern: Micro-Reward (OpenClaw-RL)
**Pattern**: Immediate feedback (Tool Error -> Penalty) drives in-context learning.
- **Mechanism**: Don't wait for session end.
- **Application**: Coach `micro-reward` skill (HB#298).

## 4. Principle: P51 Growth Cycle & P53 Evolution Boundary
**Application**:
- **Structure**: Formalize the "Shell Evolution" (Transient Skills).
- **Gym**: Expand `test/gym/` scenarios.

## 5. Conclusion & Action
- **Strategic**:
    1.  **Invest in Gym**: Build more adversarial scenarios.
    2.  **Monitor Micro-Reward**: Ensure Coach uses it.
- **Tactical**:
    1.  **Update P53**: Explicitly mention "Structural Evolution".
    2.  **Update Coach**: Mandate `micro-reward` usage.
