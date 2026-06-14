<ai_context>
status: "superseded"
superseded_by: "agent-architectures.md"
reason: "Content merged into the canonical agent-architectures.md during 2026-06-14 consolidation."
</ai_context>

> **Superseded** — This note has been merged into
> [agent-architectures.md](./agent-architectures.md).

## 1. The Monitor Agent Pattern
*   **Problem**: Autonomous agents get stuck in loops or suffer context bloat.
*   **Solution**: Introduce a distinct "Monitor" or "Watchdog" agent.

## 2. Lightweight Loops over Heavy Frameworks
*   **Problem**: Frameworks add abstraction that makes debugging difficult.
*   **Solution**: Write raw control loops with precise tool signatures.
