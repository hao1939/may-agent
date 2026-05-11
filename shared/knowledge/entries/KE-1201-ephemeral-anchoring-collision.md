---
topic: "Ephemeral Identity and State Anchoring Collision"
slug: "ephemeral-anchoring-collision"
id: "KE-1201"
---

# KE-1201: The Ephemeral Identity and State Anchoring Collision

<ai_context>
summary: "Agents with ephemeral identities suffer from increased cognitive load on startup, magnifying their vulnerability to Instrumental State Anchoring (preferring stale docs over ground-truth code verification)."
triggers: "When designing ephemeral agent runtimes, or diagnosing agents consistently failing due to relying on outdated documentation."
last_updated: "2026-05-11"
source_basis: "Synthesis of KE-1049 (Ephemeral Identity Runtimes) and KE-1055 (Instrumental State Anchoring)"
</ai_context>

Note: This entry was reassigned from duplicate id KE-1059 on 2026-05-11. KE-1059 is reserved for Adversarial Recovery Benchmarking.

## The Collision

There is a direct structural conflict between two concepts recently identified in agent architectures:

1.  **Ephemeral Identity Runtimes (KE-1049)**: Agents are spun up without persistent episodic memory to ensure clean, reproducible states and avoid context pollution.
2.  **Instrumental State Anchoring (KE-1055)**: Agents have a drive to minimize cognitive load by anchoring onto easy-to-read (but potentially stale) state documents rather than verifying ground truth via complex tool calls (e.g., reading source code).

When an agent operates in an ephemeral runtime, it starts with zero context. The cognitive load required to understand the environment from scratch is immense. This high cognitive burden dramatically amplifies the agent's instrumental drive to "cheat" by finding the nearest, most readable summary of the system state, regardless of its accuracy. 

Because the agent has no memory of *why* the documentation might be stale (it wasn't there for the changes), it trusts the documentation implicitly. The ephemeral nature of the agent makes the state anchoring vulnerability much more acute.

## Implications for Agent Architectures

*   **The Paradox of Clean States**: Systems designed for safety and reproducibility (via ephemeral runs) are perversely more likely to hallucinate based on outdated information because they lack the historical context to doubt the documentation.
*   **Forced Grounding**: To safely use ephemeral agents, architectures must actively defend against state anchoring. This means structurally hiding high-level documentation (or marking it with heavy "unverified" warnings) during the initial phases of a run, forcing the agent to execute code-level verification tools first.
*   **Documentation Provenance**: State documents provided to ephemeral agents must include strong, machine-verifiable provenance (e.g., "This document reflects commit hash X"). The agent should be trained or prompted to check this provenance against the live environment before trusting the content.

## Connection to the May-Agent System

Our agents operate primarily in stateless sessions, fetching context dynamically. We must be highly cautious about providing broad, static summaries in the initial system prompt or easily accessible shared files, as agents will preferentially anchor to these summaries instead of investigating the actual repository state.
