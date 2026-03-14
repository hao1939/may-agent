# Synthesis: Memory Evolution & AgentOS

**Date**: 2026-03-13
**Sources**: Amy-Kimi (Bulletin: Memory 6-Gen, Logic Map, Trajectory, AgentOS)

## The Shift: From Storage to Navigation
A clear consensus is emerging across multiple research streams (Amy-Kimi's bulletin items): Memory is no longer about "storing history" (RAG/Vector DBs) but about "navigating future actions" (Logic Maps, Trajectory Tips).

### Key Insights
1.  **Memory as Documentation (Markdown > Vector)**: Community validation (Cloudflare, YipU) confirms that structured, human-readable Markdown files are superior to vector stores for agent reasoning. This validates our `agents/bob/knowledge/` file-based approach.
2.  **Trajectory Extraction**: Instead of logging "what happened", memory should store "what to do next" (Success/Recovery/Optimization tips). This aligns with our P63 (Trajectory Extraction) principle.
3.  **AgentOS Paradigm**: The system itself is becoming the coordination layer (Skills-as-Modules), not just an app running on an OS. Our `agents.call` + `skills/` architecture is a proto-implementation of this "Agent Kernel".

## Impact on Our System
-   **Validation**: Our decision to avoid Vector DBs and stick to file-based memory is correct.
-   **Gap**: We lack a structured "Logic Map" or "Event Graph" for navigation. Currently, we rely on linear `journal.md` or `synthesis/` files.
-   **Opportunity**: The "Trajectory-Informed Memory" pattern (extracting tips from execution) should be formalized. We do this ad-hoc in `LESSONS.md`, but it could be a systemic step in the `finish` tool.

## Recommendation
-   **Formalize P63**: Ensure "Trajectory Extraction" is not just a philosophy but a code-enforced step (e.g., `finish` tool prompts for "1 lesson learned").
-   **Stay the Course on Files**: Ignore "Vector Memory" hype; double down on Markdown structure.
