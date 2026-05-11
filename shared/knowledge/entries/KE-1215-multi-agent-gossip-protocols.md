# Context Drift Prevention via Multi-Agent Gossip Protocols

<ai_context>
summary: "Using scored adversarial or peer-review mechanics (gossip/conflict) as an adoption protocol to validate context before it enters collective memory, preventing context drift across handoffs."
triggers: ["multi-agent architecture", "memory management", "context drift", "shared knowledge base"]
last_updated: "2026-05-11"
source_basis: "External observation (WUPHF open-source system) synthesizing concepts of peer review and shared memory."
</ai_context>

## Concept
In multi-agent systems with shared memory, "context drift" occurs when hallucinations, outdated facts, or weakly supported claims are continuously appended to the shared state, degrading its reliability over time. 

A "Gossip Protocol" (or adversarial peer-review mechanism) mitigates this by requiring that new facts are debated, reviewed, or scored by peer agents before adoption into the canonical shared memory.

## Mechanism
Instead of a single agent having unilateral write access to the collective memory, the system employs an adoption protocol:
1.  **Proposal:** An agent proposes an update based on its work.
2.  **Gossip/Review:** Peer agents (potentially with different personas or specialties, like 'Architect' or 'Security') review the proposed update.
3.  **Scoring/Debate:** The peers score the validity, relevance, and evidence of the proposal.
4.  **Adoption:** The fact is only committed to the shared knowledge base if it passes a threshold of consensus or rigorous debate.

## Implications for System Design
*   **Move away from single top-down memory streams:** Relying on one process to curate memory is fragile.
*   **Friction is valuable:** Adding deliberate friction (review/debate) before committing to long-term memory increases its quality and durability.
*   **Role-based validation:** Differentiated agent roles can act as natural filters for context quality.