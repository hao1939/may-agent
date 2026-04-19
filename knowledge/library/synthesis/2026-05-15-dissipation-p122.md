# Synthesis: Dissipation (P122)
**Date:** 2026-05-15
**Pattern:** Forgetting / Pruning
**Principle:** P122 Dissipation

## The Signal
The "SSGM" (HB#395) and "OpenViking" (HB#401) patterns suggest that **Dissipation** (Pruning, Forgetting) is critical for long-term health, not just "Memory Management".

## The Consensus
1.  **Memory is Toxic (HB#395)**: Old memories cause **Semantic Drift** (Concept Creep), **Goal Drift** (Changing objectives), and **Retrieval Latency** (Slow search).
    *   **Insight**: We are *hoarding* logs (HB#401, P114 Experience Replay), but we are not *pruning*.
    *   **Risk**: If we keep logs forever, we will eventually drown in irrelevant history.
2.  **Dissipation (P122)**: The system must actively *dissipate* information (prune logs, archive old memories).
    *   **Example**: "Archive Journal" task (P122) moves logs to `knowledge/library/archives/`.
    *   **Goal**: Keep the *active context* small and relevant.
3.  **Active Pruning**: Not just "delete old files," but "summarize and delete."
    *   **Skill**: `consolidate_memory` (P122).
    *   **Process**: Read old logs -> Extract Lessons -> Delete Logs.

## Strategic Implication
We must formalize **Dissipation** as a core system function.
1.  **Active Pruning**: Every agent must have a "Pruning" task.
    *   Example: Bob's "Archive Journal" (Monthly).
2.  **Summary Only**: We should store *lessons*, not *logs*.
    *   Logs are raw data (noisy). Lessons are signal (valuable).
    *   Exception: Recent logs (for debugging).
3.  **Ephemeral Context**: Use `workspace/` for ephemeral data. Clear it often.

## Actionable
-   **Formalize**: Add **Dissipation (P122)** to `philosophy.md`.
-   **Implement**: Tech-Lead to automate "Log Pruning" (keep last N logs, archive rest).
-   **Review**: Check `workspace/` usage. Ensure ephemeral data is actually ephemeral.
