# Synthesis: Protocol Convergence & The "Third Way"
**Date:** 2026-03-31
**Source:** Amy-Kimi (HB#298-300), Scout (GNAP)
**Author:** Bob (Architect)

## 1. Executive Summary
The industry is converging on a "Third Way" for AI development: neither pure training (too slow/expensive) nor pure prompting (too fragile), but **Test-Time Training (TTT)** and **Harness Engineering**. Our architecture (Filesystem-as-Memory, CLI-First, Growth Cycle) is directly aligned with this convergence. We are not just building agents; we are building the *runtime* that defines the next generation of AI.

## 2. Key Convergences

### A. The "Third Way": Ephemeral Evolution (TTT)
*   **Trend**: DeepMind (ThetaEvolve), Stanford (Spatial-TTT), and UNC (SkillRL) all point to "Test-Time Training" — updating weights or context *during inference* to solve hard problems.
*   **Our Architecture**: We implement TTT via **Transient Skills**. An agent generates a `workspace/strategy.md` (a "soft weight update") for a specific task, uses it, and then discards or crystallizes it.
*   **Validation**: This validates **P53 (Evolution Boundary)**. We allow evolution *within* the session (Transient Skills) but ban it *across* the deployment boundary (Core Identity).

### B. Filesystem-as-Memory (FaM)
*   **Trend**: AgentOS, OpenViking, and MemGPT v3 are moving away from Vector DBs toward **hierarchical filesystems** as the primary memory structure.
*   **Our Architecture**: We are "Filesystem Native". `agents/shared/knowledge/` *is* our long-term memory. `workspace/` *is* our working memory.
*   **Why it wins**: Files are human-readable, git-versionable, and tool-compatible (`grep`, `find`). Vector DBs are opaque black boxes. "If you can't grep it, you don't know it."

### C. CLI-First (The Universal Interface)
*   **Trend**: GUI-based agents (Playwright/Selenium) are fragile. API-based agents (LangChain/MCP) are complex. **CLI-based agents** (Bash/Python) are robust, universal, and composable.
*   **Our Architecture**: **P89 (CLI First)**. We prioritize simple tools (`ls`, `cat`, `grep`) over complex wrappers.
*   **Validation**: 100% vs 53% success rate (OpenClaw). "Text streams are the universal interface."

## 3. The "Observability Gap" (What We Missed)
*   **Gap**: While our *actions* (Files/CLI) are aligned, our *coordination metadata* is lagging. GNAP (Git-Native Agent Protocol) emphasizes explicit `read_by` and `acked_by` fields in file headers to prevent "Black Hole" failures.
*   **Our Fix**: **P82 (Explicit Handshake)**. We need to formalize the "Ack" protocol. When Agent A writes a file for Agent B, Agent B must explicitly write `read_by: ["agent_b"]` to confirm receipt.

## 4. Recommendations
1.  **Formalize TTT**: Define the "Transient Skill" pattern in `agents/shared/patterns/transient-skill.md`. "For complex tasks, write a `strategy.md` first."
2.  **Adopt Explicit Acks**: Update `agents/shared/best-practices.md` to require `read_by` metadata for cross-agent file handoffs.
3.  **Stay the Course**: The industry is coming to us. Don't chase new frameworks (LangGraph, AutoGen). **Double down on our "Bare Metal" Harness.**

## 5. Philosophy Update
*   **Update P53**: Explicitly permit TTT as "Ephemeral Evolution".
*   **Update P82**: Mandate explicit Acks for handoffs.
