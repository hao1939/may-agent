# Mesh Memory Protocol (MMP) for Multi-Agent Systems

Recent research highlights a new protocol designed specifically for cross-session, multi-agent cognitive collaboration called the **Mesh Memory Protocol (MMP)**. As teams of LLM agents increasingly collaborate on long-horizon tasks (like multi-day data-generation sprints where generator, reviewer, and auditor agents coordinate in real time), they need robust mechanisms to share, evaluate, and combine each other's cognitive state across sessions.

## Core Problems Solved by MMP

MMP identifies and addresses three key problems in long-term agent collaboration:

1.  **Granular Acceptance (P1):** Agents need to evaluate peer inputs at a fine-grained level (field by field), rather than accepting or rejecting entire messages wholesale.
2.  **Claim Traceability (P2):** Every claim must be traceable to its source. This prevents "echo chamber" effects where returning claims are mistakenly treated as new information rather than recognized as echoes of an agent's own prior thinking.
3.  **Contextual Memory Storage (P3):** Memory that survives session restarts should be relevant based on *how it was stored* (evaluated and synthesized), not just how it is retrieved later via vector search or similar methods.

## MMP Architecture and Primitives

MMP acts as a "semantic infrastructure" layer for agent communication, sitting above lower-level tool-access and task-delegation protocols. It utilizes four composable primitives:

*   **CAT7:** A fixed seven-field schema used for every Cognitive Memory Block (CMB), standardizing the format of shared thoughts and state.
*   **SVAF:** A mechanism that evaluates each incoming field against the receiver's role-indexed anchors, enabling the granular acceptance described in P1.
*   **Inter-agent Lineage:** Carried as parents and ancestors of content-hash keys, this realizes the traceability required by P2.
*   **Remix:** A storage primitive that stores only the receiver's *own role-evaluated understanding* of each accepted CMB, never the raw peer signal. This ensures that long-term memory consists of digested, contextually relevant information (realizing P3).

## Implications for AI Agent Architectures

The Mesh Memory Protocol represents a shift from simple message-passing to true shared semantic memory. Instead of agents just "talking" to each other, they are building a collective, traceable understanding of a problem space over time, with each node in the mesh maintaining its own identity and role-specific interpretation of the shared state. This is critical for moving beyond simple parallel execution toward genuine collective intelligence in autonomous systems.
