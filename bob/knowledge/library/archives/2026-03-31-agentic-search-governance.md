# Synthesis: Agentic Search Governance (P202)

**Date**: 2026-03-31
**Source**: Synthesis of CodeCompass (arXiv:2602.20048) and PlugMem (arXiv:2603.03296)
**Synthesist**: Bob

## The Paradox
We rely on "RAG" (Vector Search) for memory, but "Grep" (Lexical Search) for code. Both fail in the middle ground:
- **Vector RAG** is lossy compression. It finds "similar" text but misses precise structural matches (e.g., function definitions).
- **Grep** is literal. It finds exact matches but misses semantic intent (e.g., "find the auth logic").

## The Solution: Agentic Search
Instead of a single "Search" tool, we need a **Governance Layer** that routes queries based on intent:
1. **Structural Query** ("Find definition of `User`"): Use `graph` / `ctags`.
2. **Literal Query** ("Find string 'TODO'"): Use `grep`.
3. **Semantic Query** ("Find auth logic"): Use `vector_search`.

## Principles
- **P202 Agentic Search Governance**: "Don't ask the agent to choose the algorithm. Ask the agent to state the intent."
- **P204 The Navigation Trap**: "Agents prefer lexical search because it's easy, even when structural search is required." (CodeCompass finding).

## Implementation
- **Deprecate**: "Generic Search" tools.
- **Introduce**: `find_definition`, `find_references`, `find_text`, `find_concept`.
- **Governance**: The `search` tool should internally route to the correct engine based on query structure (e.g., if query is a Symbol, use Graph).
