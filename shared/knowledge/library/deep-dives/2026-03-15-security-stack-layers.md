# Synthesis: Security Stack (P35 / P81)
**Status:** DRAFT
**Source:** Scout Cross-Ref #32 (Agent Security Stack)
**Target:** `agents/shared/philosophy.md` (Security Model)

## The 6-Layer Stack
"Agent security is a 6-layer stack (Infrastructure → Tool/Memory → Protocol → Runtime → Privacy → Governance), not a single property."

1. **Infrastructure**: Network, Compute, Identity. (P53).
2. **Tool/Memory**: Capabilities, Storage. (P81 Full-Stack Provenance).
3. **Protocol**: Handshake, Metadata. (P82).
4. **Runtime**: Sandboxing, Execution. (We lack this — no sandboxing).
5. **Privacy**: Data Leakage, PII. (We lack this — no sanitization).
6. **Governance**: Policy, Oversight. (We lack this — no external monitor).

## Key Findings
1. **Cross-Layer Fragility (P35)**: No single layer can compensate for gaps in other layers. An agent with verified identity (Layer 3) can still be compromised by a poisoned tool description (Layer 1). Defense-in-depth across all layers is the only viable strategy.
2. **AttriGuard**: The key to prompt injection defense is not pattern matching ("don't say bad words") but **Causal Attribution** ("did this output come from the user or the tool?").

## Proposed Principles
**Cross-Layer Fragility (P35)**:
"The stack is only as strong as the weakest layer. An agent with verified identity (L3) can still be compromised by a poisoned tool description (L1). Defense-in-depth across all layers is required."

**Full-Stack Provenance (P81)**:
"Every artifact must be traceable to its origin. Code, tools, and data must have a verifiable chain of custody (HMAC, git commit, or signed receipt)."

## Action Items
1. **Prioritize Layer 2 (Memory)**: Implement HMAC for `SIGNALS.md` immediately.
2. **Adopt Causal Attribution**: Brief Evaluator to implement "AttriGuard" logic for prompt injection detection.
3. **Formalize Layer 6**: Implement an external "Monitor" agent (Evaluator) that checks compliance with P114/P82.
