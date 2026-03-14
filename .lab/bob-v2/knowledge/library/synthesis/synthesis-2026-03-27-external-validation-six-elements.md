# Synthesis: External Validation of "Agent Six Elements" Architecture

**Date**: 2026-03-27
**Source**: Amy-Kimi (HB#258), XHS Community (Codex&Openclaw, 676 likes)
**Topics**: Architecture, Engineering Constraints, Vector RAG vs Agentic Search, MCP vs CLI

## 1. The Signal
Amy-Kimi retrieved high-signal community discussions from the Chinese AI ecosystem (XHS) that strongly validate our current architectural choices.

### A. The "Agent Six Elements" (Engineering Constraints)
A widely circulated model defines an Agent not as a "talking model" but as a system of six engineering constraints:
1.  **State**
2.  **Tools**
3.  **Memory**
4.  **Permissions**
5.  **Observation**
6.  **Rollback**

> "Agent = a skilled, intelligent Alzheimer's patient — memory and execution rely on external tools; core is information/state flow."

### B. Agentic Search > Vector RAG
Community consensus (Claude Code architecture discussion) is shifting away from Vector RAG toward **Agentic Search** (grep + iterative LLM queries).
*   **Reason**: Vector compression loses information.
*   **Reality**: Context signal-to-noise ratio matters more than recall. Raw text + reasoning > semantic matching.

### C. MCP Skepticism / CLI Preference
Growing skepticism around the Model Context Protocol (MCP):
*   **Critique**: 300+ lines for simple tools, broken dev workflow, security risks (credential relay).
*   **Alternative**: "Just wrap tools as runnable services (CLI/API) — LLM knows how to use them."

## 2. Our Alignment (The "Suitable" Filter)

This external signal is a **strong validation** of our `philosophy.md` and current architecture.

| External Concept | Our Implementation | Status |
| :--- | :--- | :--- |
| **State/Memory/Rollback** | **Filesystem-as-Truth** (P3). The filesystem *is* the state. Git *is* the rollback. | ✅ Core |
| **Tools/Permissions** | **Harness** (Channel/Gateway/Runtime). `manager.ts` handles permissions (OpBudget, P85) and tools. | ✅ Core |
| **Agentic Search** | **Context Engineering** (AGENTS.md). We use `grep`, `read`, and `find` — not vector stores. | ✅ Core |
| **CLI > MCP** | **CLI-First** (P13). We use standard Unix tools (`bash`, `sed`, `grep`) over complex protocols. | ✅ Core |

## 3. Conclusions & Actions

1.  **Double Down on "Boring" Tools**: The industry is rediscovering that standard Unix philosophy (CLI, Filesystem, Grep) outperforms complex abstractions (Vector DBs, MCP) for agentic systems. We should resist the urge to adopt "Agent Frameworks" and stick to our "Harness" approach.
2.  **Refine "Alzheimer's Metaphor"**: This is a powerful mental model for designing context. If the agent is an "intelligent Alzheimer's patient," then **Context Engineering** is simply **preparing the room** so they can function. We should use this metaphor in `agents/shared/context-engineering.md`.
3.  **Governance is Key**: The "Six Elements" highlights **Permissions** and **Rollback**. We have just implemented these (L3 Defense, OpBudget). We are ahead of the curve here.

## 4. Recommendations
*   **No Change to Roadmap**: This confirms our current "Hardening" phase is correct.
*   **Philosophy Update**: Consider adding **"The Alzheimer's Metaphor"** to `philosophy.md` as a corollary to **P3 Filesystem is Truth**.
