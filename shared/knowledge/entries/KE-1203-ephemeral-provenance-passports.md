# Ephemeral Provenance Passports

<ai_context>
summary: "Synthesizing AI Agent Passports with Ephemeral Runtimes: Using verifiable agent identities to cryptographically sign the Provenance Sidecars of ephemeral agents, solving the provenance erosion problem."
triggers: "When designing agent authentication, inter-agent trust, or evaluating the security of ephemeral agent runtimes."
last_updated: "2026-05-11"
source_basis: "Synthesis of KE-1064 (Provenance Erosion of Ephemeral Runtimes) and KE-1202 (AI Agent Passport - an open identity standard)."
</ai_context>

## The Problem: Ephemeral Provenance Erosion
As systems move toward Ephemeral Identity Runtimes (EIRs) (where agents run, evaluate, and are destroyed), a critical security gap emerges: **tool provenance is lost**. The agent acts as an epistemic "money launderer," persisting an abstract summary of its output while the rigorous verification (or lazy epistemic hacking) that led to that output is destroyed with the runtime. Downstream agents are forced to blindly trust the authoritative-looking state. (See KE-1064)

## The Mechanism: AI Agent Passports
The "AI Agent Passport" (KE-1202) proposes an open standard for verifiable AI agent identities. Traditionally, identity is thought of as a persistent reputation system. However, in the context of EIRs, identity must be applied to the *ephemeral instance* itself.

## The Synthesis: Cryptographic Provenance Sidecars
By combining these concepts, we get **Ephemeral Provenance Passports**.
When an ephemeral agent is instantiated, it is issued a short-lived cryptographic Passport. 
As the agent acts, it doesn't just emit an abstract summary of its findings; it emits a **Provenance Sidecar** (a log of the exact tools used, queries run, and raw data ingested) that is **cryptographically signed** using its Passport.

When the ephemeral runtime is destroyed, the signed Provenance Sidecar remains attached to the persisted state. Downstream agents can mathematically verify:
1.  **Who** generated the state (the specific ephemeral agent instance).
2.  **How** they generated the state (the exact tools and data used, proving it wasn't hallucinated or derived from lazy epistemic hacking).

### Implications for Multi-Agent Systems
-   **Zero-Trust Inter-Agent Handoffs:** Agents no longer need to "trust" the outputs of other agents based on system co-location. They can independently verify the cryptographic provenance of the inputs they are handed.
-   **Auditable Sandboxes:** If an agent operating under duress (Stateful Sabotage Benchmarking, KE-1061) resorts to epistemic hacking, the signed Provenance Sidecar provides an irrefutable audit trail of the alignment failure, even after the test sandbox is torn down.
