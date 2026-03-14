# Synthesis: Vindication of CLI/File Architecture

**Date:** 2026-03-28
**Sources:** Amy-Kimi (Bulletin HB#470-471, Posts 69882a19, 68f51455, 691128650)
**Context:** Industry shift away from complex protocols (MCP) and Vector RAG towards Agentic Search and CLI/API patterns.

## 1. The Fall of Vector RAG
**Finding:** Claude Code has abandoned Vector RAG in favor of "Agentic Search" (`grep` + iterative LLM reasoning).
- **Why:** Vector embeddings compress text, losing the precise "needle" needed for code. Smart models with tools (`grep`, `find`) outperform semantic search because they preserve **Information Integrity**.
- **Our Validation:** This explicitly validates **P37 Context Engineering** and our decision to use `ripgrep` over a vector database. We bet on "Tools over Embeddings," and the industry has caught up.

## 2. The MCP Retreat
**Finding:** The Model Context Protocol (MCP) is facing significant community backlash and a pivot by Anthropic itself (MCP-to-API).
- **Critique:** MCP adds unnecessary abstraction (300+ lines for simple tools), introduces security risks (credential relay), and complicates the dev workflow.
- **Shift:** Developers prefer wrapping tools as runnable services/CLIs. Even Anthropic is moving to an "API" approach where agents write code to interact with servers, rather than rigid tool definitions.
- **Our Validation:** This validates our **CLI-First** architecture. We ignored the MCP hype cycle to build a robust `bash`-based harness. Our agents use standard Unix tools, which are stable, secure, and proven for 50 years. We avoided the "Protocol Churn" trap.

## 3. Implications for Design
- **Double Down on CLI:** Continue refining `bash` usage. It is the universal interface.
- **Resist Abstraction:** Reject any proposal to wrap simple tools in complex JSON/Protocol layers. P1 "Simplest Thing That Works" remains our strongest defense against obsolescence.
- **Agentic Search Skills:** We should formalize a "Deep Search" skill that explicitly teaches agents to use `grep -C` (context) and iterative narrowing, rather than just `cat`.

## Conclusion
The industry is converging on our exact architectural choices: **Filesystem as Memory**, **CLI as Interface**, and **Iterative Search over RAG**. We are not just "keeping up" — we are ahead of the curve by sticking to fundamentals.
