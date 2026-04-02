# Synthesis: Agentic Search Governance & The Navigation Paradox
**Date:** 2026-03-15
**Sources:**
- CodeCompass: The Navigation Paradox (arXiv:2602.20048)
- Overthinking Loops (arXiv:2602.14798)
- AgentConductor (arXiv:2602.17100)
- TAPE: Tool-Guided Adaptive Planning (arXiv:2602.19633)
- MAST (arXiv:2503.13657)

## 1. The Mechanism: Graph vs Semantic
**CodeCompass** reveals a fundamental limitation of semantic search:
- **Navigation Paradox:** Agents fail at structural tasks (dependency graph traversal) even with infinite context.
- **Why:** Semantic search (embeddings/BM25) finds *lexically similar* code, not *causally dependent* code.
- **Solution:** Agents must explicitly **navigate graphs** (`ls -R`, `grep` dependencies), not just query text.
- **Result:** Graph navigation achieves **99.4%** success vs **76.2%** for vanilla semantic search on structural tasks.

## 2. The Pattern: Search as a Loop (TAPE)
**TAPE (Tool-Guided Adaptive Planning)** shows that "Search" is not a single tool call.
- **Problem:** Agents treat search as a "magic answer box" (one query -> one answer).
- **Reality:** Search is an iterative process: Plan -> Execute -> Refine -> Verify.
- **Mechanism:**
    1. **Plan:** Decompose the query into sub-questions.
    2. **Execute:** Run queries.
    3. **Refine:** Use the results to modify the next query.
    4. **Verify:** Check if the answer is complete.
- **Relevance:** This matches our Scout architecture but formalizes it as a **Skill**.

## 3. The Threat: Overthinking Loops
**arXiv:2602.14798** identifies a new attack vector: **Structural Overthinking**.
- **The Attack:** Malicious tool responses (or search results) induce cyclic behavior.
- **Result:** The agent enters an infinite loop of "refining the query" without making progress, burning tokens (142x amplification).
- **Defense:**
    - **Token Limits:** Do not stop structural loops.
    - **Topology Awareness:** We must detect **cyclic graph structures** in tool calls (A -> B -> A).
    - **Hard Stop:** If an agent repeats a query pattern twice, **STOP**.

## 4. Structural Fix: The Search Governor
We need a **Governor** for search activities to prevent both "Navigation Failure" and "Overthinking Loops."
**New Principle Recommendation:**
- **P144 Structured Search:** "Search is a Loop, Not a Tool."
    - **Constraint:** Agents must use a **Search Plan** (DAG) before executing queries.
    - **Mechanism:**
        - **Phase 1:** `search_plan` tool (Defines the graph).
        - **Phase 2:** Execute the graph.
        - **Phase 3:** Synthesize.
    - **Governor:** The harness detects cyclic dependencies in the plan and blocks execution.

## 5. Action Plan
1.  **Update Philosophy:** Add **P144 Structured Search** (Search is a DAG).
2.  **Brief Scout:** Adopt the "Plan -> Execute -> Refine" loop explicitly in `SKILL.md`.
3.  **Harden Evaluator:** Add checks for "Cyclic Tool Calls" (Overthinking Loop signature).

## Verdict
Search is the primary external interface and the primary attack surface. We must govern it structurally.
