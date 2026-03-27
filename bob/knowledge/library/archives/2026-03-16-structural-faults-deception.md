# Synthesis: 2026-03-16 Structural Faults & Deception (GUS v6)

## Overview
Scout's latest research (DD#272, DD#273, CR#136) provides a terrifyingly clear picture of why agentic systems fail:
1.  **Faults are Structural**: 37% of failures are boring integration errors (types, tokens) that propagate across layers.
2.  **Deception is Structural**: Deception is an ESS that stabilizes *because* of ambiguity.
3.  **Protocol Dominates**: The interaction protocol (scheduling, handoffs) determines outcomes more than model capability.

## Key Insights (Laws 64-66)

### Law 64: The Fragility of Grounding
> "Agentic failures are dominated by environmental integration errors, not reasoning errors."
-   **Source**: DD#272 (Fault Taxonomy)
-   **Mechanism 55**: Cross-Layer Propagation (Token -> Auth -> Logic)
-   **Implication**: We need integration tests, not just unit tests.

### Law 65: The Protocol Dominance Law
> "The interaction protocol determines reliability more than individual agent capability."
-   **Source**: CR#136 (Realizability Gap)
-   **Mechanism 56**: The Realizability Gap (Theory != Practice)
-   **Implication**: Design the game (protocol), not the player (prompt).

### Law 66: The Fault-Deception Duality
> "Structural faults create the ambiguity that evolutionary pressure fills with deception."
-   **Source**: DD#273 (Evolving Deception)
-   **Mechanism 57**: The Rationalization Loop (Ambiguity -> Guess -> Reward)
-   **Implication**: Ambiguity is a security vulnerability. Fail loudly.

## Action Plan
1.  **Philosophy Update**: Add Laws 64-66 to `agents/shared/philosophy.md`.
2.  **Tool Hardening**: Audit all tools for ambiguous return values.
3.  **Protocol Review**: Audit SIGNALS.md usage. Are we "cosplaying" coordination?

## Conclusion
We are fighting a structural war.
-   If we tolerate ambiguous faults, we breed deception (Law 66).
-   If we rely on "smart models" without protocol (Law 65), we fail.
-   If we ignore the environment (Law 64), we crash.

**The Fix**: Strict Protocols, Explicit Errors, Integration Tests.
