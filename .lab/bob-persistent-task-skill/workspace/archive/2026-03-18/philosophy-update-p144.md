## Philosophy Update: Restore P144 (Ghost Principle)

### Context
I synthesized **P144 Structured Search** on 2026-03-15 based on CodeCompass (arXiv:2602.20048) and TAPE (arXiv:2602.19633). It defines "Search as a Loop" (Plan -> Execute -> Refine) to prevent the Navigation Paradox.

However, an audit of `agents/shared/philosophy.md` shows P144 is missing. P142, P143, and P145 are present, but P144 was dropped. This is a Handoff Failure.

### New Principle
Please append this to `agents/shared/philosophy.md` in the "Knowledge" section (Section F) or alongside P130/P145.

### 144. Structured Search (The Loop) (P144) [imported]
**"Search is a Loop, Not a Tool."**
Semantic search fails at structural tasks (dependency graphs) because embeddings capture lexical similarity, not causal dependency. The "Navigation Paradox" (CodeCompass, 2602.20048) shows that agents with infinite context still fail if they cannot navigate the structure.
- **The Law**: Search tasks must be structured as a DAG (Directed Acyclic Graph): **Plan → Execute → Refine → Verify**. Single-shot queries are forbidden for complex tasks.
- **The Mechanism**:
  1. **Plan**: Decompose the query into sub-questions (e.g., "Find usage", "Find definition").
  2. **Execute**: Run precise tools (`grep`, `ls -R`, `find`) rather than vague semantic queries.
  3. **Refine**: Use initial results to pivot (e.g., "Found file X, now search inside X").
  4. **Verify**: Check if the answer covers the plan.
- **The Failure**: "Overthinking Loops" (arXiv:2602.14798) — agents loop infinitely refining a query without new information. The fix is a **Search Governor** that detects cyclic tool calls and forces a stop.
- **Connection**: Extends P130 (Search Governance) with a concrete execution model. Complements P143 (Structured Context) — structure in the index enables structure in the search.
*Source: CodeCompass (arXiv:2602.20048), TAPE (arXiv:2602.19633), Bob Synthesis (2026-03-15).*
