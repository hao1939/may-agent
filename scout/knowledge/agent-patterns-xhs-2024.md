<ai_context>
summary: "Details two dominant agent patterns observed in XHS/Chinese AI communities in 2024: the Manager-Worker hierarchical coordination pattern and the Three-Tier memory model."
triggers: "When designing multi-agent communication, setting up memory architectures, or defining agent boundaries."
last_updated: "2024"
source_basis: "Observations from the Chinese AI developer community (Xiaohongshu/XHS)."
</ai_context>

# AI Agent Patterns: Hierarchical Coordination & Three-Tier Memory

## Overview
Recent observations from the Chinese AI developer community (notably Xiaohongshu/XHS) highlight a shift in how autonomous agents are structured and how they manage context. Two dominant patterns have emerged as practical solutions to common agent failure modes.

## 1. Multi-Agent Coordination: The Manager-Worker Pattern
Earlier experimental architectures often utilized peer-to-peer agent networks. However, these systems frequently suffered from endless loops, context collapse, and loss of focus.

**The Shift:** Teams are increasingly adopting a strict hierarchical "Manager-Worker" pattern.
- **Manager Agent:** Acts as a router and evaluator. It delegates specific tasks to specialized worker agents and enforces output formatting and quality criteria before accepting the result.
- **Worker Agents:** Highly specialized execution units with narrow scopes and constraints.
- **Why it works:** Strict accountability boundaries prevent context collapse. The manager ensures the overarching goal is met without getting bogged down in implementation details, while workers operate efficiently within their focused domains.

## 2. Agent Memory Architectures: The Three-Tier Model
Managing state and context is a persistent challenge. Relying solely on the context window leads to token exhaustion and forgotten details.

**The Solution:** A structured three-tier memory model:
1.  **Working Memory:** The active context window (current session/turn).
2.  **Episodic Memory:** Session history and logs, typically retrieved via RAG (Retrieval-Augmented Generation) when historical context is needed.
3.  **Semantic Memory:** Durable facts, system knowledge, and user preferences stored outside the context window (e.g., as key-value pairs, knowledge graphs, or structured markdown files like our `context.md` and `projects/*.md`).

**Key Takeaway:** Separating transient conversational context (working/episodic) from durable system facts (semantic) is critical for long-term agent stability and continuous learning.

## Implications for Our System
These external trends strongly validate our existing architecture (clear agent boundaries, project files as semantic memory, distinct roles). We should continue to reinforce the "Manager-Worker" dynamic where applicable, perhaps by introducing more specialized worker tools or workflows managed by the session owner.
