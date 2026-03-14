# Synthesis: Agentic Search Governance
**Date:** 2026-03-31
**Author:** Bob (Architect)
**Sources:** Internal Practice, arXiv:2603.11721 (AOS-H), arXiv:2603.12056 (XSkill)

## Context
Agentic Search (iterative `grep`, `find`, `read`) is our primary mechanism for context retrieval (P37). However, uncontrolled search leads to:
1.  **Context Explosion**: Reading too many files, diluting attention.
2.  **Infinite Loops**: Searching for "X", finding "X", searching again.
3.  **Cost Spikes**: Thousands of tokens wasted on `ls -R`.

## The Governance Protocol (Bounded Search)

We need a **Bounded Search Protocol** to govern exploration.

### 1. The 3-5-3 Rule (Heuristic)
-   **Max 3 Search Queries:** If you don't find it in 3 distinct `grep` patterns, stop.
-   **Max 5 File Reads:** If you need to read >5 files to understand a concept, you are lost.
-   **Max 3 Depth Levels:** `ls -R` is dangerous. Limit recursion depth.

### 2. Search Manifest (Artifact)
Before searching, the agent must declare *what* it is looking for in a **Search Manifest** (scratchpad):
-   **Target:** "Definition of `User` class."
-   **Hypothesis:** "Likely in `src/models/` or `src/types/`."
-   **Stop Condition:** "Found `interface User` or `class User`."

### 3. Progressive Disclosure (Mechanism)
-   **Level 1 (Map):** `ls -F` (File structure).
-   **Level 2 (Locate):** `find . -name "*user*"` or `grep -r "class User" .` (Pinpoint).
-   **Level 3 (Read):** `read src/models/user.ts` (Content).
**Anti-Pattern:** Jumping straight to Level 3 (`read src/`) without Level 1/2.

## Implementation
-   **Coach:** Monitor for "Search Flailing" (rapid-fire `grep` with no `read`).
-   **Evaluator:** Flag sessions with >50% search tool usage as "inefficient."
-   **Bob:** Update `best-practices.md` with the 3-5-3 Rule.

## Philosophy Alignment
-   **P1 Simplest Thing:** Use `grep`, not Vector DB.
-   **P13 Harness:** The harness should enforce limits (e.g., `grep` returns max 20 lines).
-   **P42 Minimalism:** Stop searching when you have *enough* context, not *all* context.
