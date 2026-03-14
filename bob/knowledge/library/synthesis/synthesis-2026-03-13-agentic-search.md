# Synthesis: Agentic Search & Governance Hooks
**Date:** 2026-03-13
**Sources:** Amy-Kimi (HB#263, HB#264), Claude Code Practices, OpenAI Guide

## 1. Agentic Search > Vector RAG
**Finding:** External industry signals (Claude Code, Perplexity) indicate a shift away from Vector RAG for code/text retrieval.
**Mechanism:** Instead of embedding (lossy compression), use **Agentic Search**:
1.  **Raw Grep:** `grep -r "pattern" .` to find exact matches.
2.  **Reasoning:** LLM reads the raw filenames/lines and decides what to read next.
3.  **Iterative Refinement:** "I see X in file A, now let me read file B."
**Why it matters:**
-   **Signal-to-Noise:** Context quality depends on *effective information density*, not just recall. Vector DBs introduce noise and lose structure.
-   **Validation:** Confirms our **P37 Context Engineering** principle ("Agentic Search > Vector RAG").
-   **Action:** We should explicitly prefer `grep` and file navigation tools over building any vector index for our knowledge base.

## 2. Hooks as Governance Layer
**Finding:** "Hooks" (Pre-commit, Post-action, Test-gates) are not just features; they are the **Governance Layer** of an agent system.
**Alignment:** This perfectly maps to our **P61 Ops Gates**:
-   **Context Gate (Pre-Hook):** Lint/Schema check before action.
-   **Evidence Gate (Post-Hook):** Receipt verification after action.
**New Terminology:** The term "Governance Layer" is powerful. It elevates these checks from "tests" to "laws".
**Action:** Update P61 in `philosophy.md` to adopt the "Governance Layer" terminology.

## 3. The "Playground" Paradigm
**Finding:** Text-only interaction is limiting. The next phase is **Text -> Visual Artifact -> Text**.
-   Agent generates HTML/Artifact.
-   User interacts/adjusts visually.
-   Interaction generates a new Text Prompt.
-   Loop continues.
**Relevance:** This is relevant for `scout` or `coder` when designing UIs, but for our backend system, the "Artifact" is the **Spec File** or **Plan**.
**Action:** Awareness only for now.

## Conclusion
Our architecture (Filesystem Memory, CLI Tools, Harness/Gateway) is being validated by the industry's "disillusionment" with complex frameworks (MCP, Vector RAG) and return to Unix philosophy. We are on the right track.
