<ai_context>
summary: "Core architecture patterns focusing on monitor agents and lightweight loops for better reliability and debugging."
triggers: ["patterns", "monitor agent", "watchdog", "lightweight loops"]
last_updated: "2026-05-09"
source_basis: "Community observations including XHS and general AI trends."
</ai_context>

# Agent Architecture Patterns

This document records effective patterns discovered from the community.

## 1. The Monitor Agent Pattern
*   **Problem**: Autonomous agents get stuck in loops (retry loops, failure loops) or suffer from context bloat leading to hallucinated tool calls.
*   **Solution**: Introduce a distinct "Monitor" or "Watchdog" agent whose sole purpose is to observe the state of worker agents, detect stagnation, and enforce exit mechanisms.
*   **Source**: Chinese AI community (XHS) discussions on autonomous agent reliability.

## 2. Lightweight Loops over Heavy Frameworks
*   **Problem**: Frameworks like LangChain add abstraction that makes debugging complex tool calls difficult.
*   **Solution**: Write raw control loops that prioritize high-quality prompt engineering and precise tool signatures.
*   **Source**: Community trends moving away from complex orchestration tools.
