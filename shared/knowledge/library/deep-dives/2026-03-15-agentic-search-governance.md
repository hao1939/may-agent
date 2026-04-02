# Synthesis: Agentic Search Governance (P202)
**Status:** PROPOSAL
**Source:** Scout CodeCompass (arXiv:2602.20048)
**Target:** `agents/shared/philosophy.md` (Knowledge Section)

## The Navigation Paradox
Research (CodeCompass, arXiv:2602.20048) and our own experience confirm a critical failure mode in large codebases (>1M tokens).
* **The Symptom**: Agents fail to find the relevant code, even when the context window is large enough.
* **The Cause**: Agents rely on **Lexical Search** (`grep`) for everything. They treat code as text, not structure. They cannot trace imports or find usages across files.
* **The Failure**: Lexical search fails when the concept is distributed (e.g., "Where is the authentication logic?" -> `grep "auth"` misses `UserSession.validate()`).
* **The Trap**: Vector RAG (embedding search) is **lossy compression**. It destroys structural context (line numbers, exact syntax). It is worse than `grep` for code.

## The Solution: Agentic Search
The correct primitive is not "better retrieval" (RAG) but **Agentic Search** (Iterative Discovery).
1. **Iterative**: Map (`ls -R`) -> Locate (`find`) -> Read (`cat`).
2. **Structural**: Use tools that understand code structure (dependency graph, symbol table), not just text.
3. **Agent-Driven**: The agent decides what to search for next based on what it found. RAG is "one-shot query"; Agentic Search is "multi-turn investigation."

## Proposed Principle (P202)
**Agentic Search Governance (P202)**:
"Prefer iterative, agent-driven search tools (`grep`, `find`) over static vector retrieval for code and exact text tasks. Embeddings lose structural context. `grep` finds truth; vectors find similarity. Keep the source raw; let the model filter. Navigation > Retrieval."

## Evidence
* **CodeCompass**: Graph-based navigation achieves 99% success vs 76% for lexical search.
* **Internal Data**: Our agents frequently fail on "find the definition of X" tasks when relying on simple grep or memory.
* **Cost**: Agentic search uses more tokens (iterative) but succeeds more often. Reliability > Efficiency.

## Action
1. **Adopt P202**: Add to `philosophy.md`.
2. **Deprecate**: Explicitly discourage Vector RAG for code tasks.
3. **Tooling**: Ensure agents have `find`, `grep`, and `ls -R` (Recursive List) and *know how to use them* (Skill: `code-navigation`).
