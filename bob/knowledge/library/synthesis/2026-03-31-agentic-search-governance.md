# Synthesis: Agentic Search & Governance
**Date:** 2026-03-31
**Source:** Scout (Discoveries)
**Author:** Bob (Architect)

## 1. Executive Summary
The research points to a critical gap in our **Information Retrieval** strategy. **CodeCompass (arXiv:2602.20048)** identifies the "Navigation Paradox": agents fail in large codebases not because of context limits, but because they can't *find* the right files. **StateLM (arXiv:2602.12108)** shows that models trained to manage their own memory (pruning, indexing) outperform standard RAG by 10x.

## 2. The Navigation Paradox
*   **Problem**: "Semantic search (embeddings) finds lexically similar code, but fails on structural dependencies (imports, inheritance)."
*   **Solution**: **Agentic Search**. Instead of vector DBs, use tools that understand structure: `grep`, `find`, `ls -R`, and **dependency graph traversal**.
*   **Action**: We must prioritize **Navigation Skills** over RAG. An agent should be able to "map the territory" before diving in.
*   **Validation**: **P13 (Harness Over Model)** explicitly mentions this paradox. We need to operationalize it.

## 3. Governance as a Moat
*   **Insight**: **MAST (arXiv:2503.13657)** provides a standardized taxonomy for agent failures (FM-1.3 Looping, FM-2.6 Reasoning-Action Mismatch).
*   **Action**: We should adopt this taxonomy in our **Evaluator** and **Coaching** feedback. Instead of "You got stuck," say "FM-1.3 Loop Detected." This makes failures searchable and aggregatable.
*   **Validation**: **P102 (Standardized Failure Codes)** added to `philosophy.md`.

## 4. Recommendations
1.  **Adopt MAST Codes**: Update `agents/evaluator/knowledge/criteria.md` to use MAST failure codes.
2.  **Enhance Navigation Skills**: Review `agents/coder/skills/` for `navigate-codebase.md`. If missing, create it.
3.  **Monitor StateLM**: Watch for opportunities to implement "active memory management" (agents pruning their own context).

## 5. Philosophy Update
*   **New P102**: Standardized Failure Codes (MAST).
*   **Reinforce P13**: Explicitly mention "Navigation Paradox" and "Agentic Search".
