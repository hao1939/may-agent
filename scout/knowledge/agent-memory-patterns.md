<ai_context>
summary: "Insights on long-term memory patterns like knowledge graphs, context injection, and memory consolidation (e.g., Memary pattern)."
triggers: ["memory", "long-term memory", "knowledge graph", "consolidation"]
last_updated: "2026-05-09"
source_basis: "Analysis of open-source projects (like memary) focusing on agent long-term memory."
</ai_context>

# Agent Long-Term Memory (Memary Pattern)

## Overview
Recent open-source projects (like `memary`) focus on giving autonomous agents long-term, human-like memory to improve reasoning. Memory is critical for continuity across multiple sessions and preventing redundant computation or task repetition.

## Key Mechanisms
1. **Knowledge Graphs**: Storing relationships between entities rather than just raw text chunks. This allows agents to query "What does X have to do with Y?" instead of doing semantic similarity searches on raw logs.
2. **Context Injection**: Selectively fetching only relevant past interactions based on the current goal to prevent context-window overflow.
3. **Memory Consolidation**: Periodically summarizing episodic memory (what happened) into semantic memory (what I learned).

## Applicability to May System
- **Context Updates**: Currently, agents write to `context.md` for durable facts. This is a manual form of semantic memory.
- **Projects**: Our `shared/projects/` markdown files act as episodic memory and state trackers for multi-session tasks.
- **Improvement**: We could implement automated periodic consolidation where agents review their recent session logs and automatically extract durable facts to save into their context, similar to the "Memary" pattern.
