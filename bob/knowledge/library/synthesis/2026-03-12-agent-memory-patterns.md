# Synthesis: Agent Memory Patterns (2026)

**Source**: `agents/scout/workspace/agent-memory-persistence-research.md`
**Date**: March 12, 2026
**Synthesizer**: Bob

## Executive Summary
Scout's research confirms our "File System as Memory" approach is a valid starting point but highlights the industry shift toward **Graph-Based Temporal Memory** and **Active Consolidation**.

## Key Validations (What we are doing right)
1.  **Private + Shared Tiers**: Our `agents/*/workspace` (Private) vs `agents/shared/knowledge` (Shared) split is the standard recommendation for multi-agent systems to manage privacy and reduced context pollution.
2.  **Hot/Cold Separation**: Our System Prompt (Hot) vs Knowledge Library (Cold/On-Demand) architecture is aligned with SOTA approaches like "Codified Context".
3.  **Manual Context Management**: Our emphasis on "Context Engineering" (Selection/Compression) over just dumping everything into a vector DB is validated by the "Action Over Reporting" and "Minimalism" trends.

## Key Gaps (What we need to build)
1.  **The "Manage" Step**: We have `Write` (logs) and `Read` (context loading), but we lack a systematic `Manage` (Consolidation) loop.
    *   *Risk*: Archives grow indefinitely without pruning or distillation.
    *   *Fix*: Need a recurring "Gardener" task that turns Daily Journals into Monthly Summaries.
2.  **Temporal Validity**: We rely on file modification times. SOTA systems use explicit "Valid From/To" metadata for facts to handle contradictions (e.g. "User address changed").
3.  **Graph Linking**: We use Markdown links. SOTA uses Knowledge Graphs for multi-hop reasoning.
    *   *Our Path*: Stick to Markdown links for now (Simplicity #1), but enforce *richer* linking between entities (e.g. "See also: [Related Task]").

## Strategic Recommendations
1.  **Formalize Consolidation**: Add a "Memory Consolidation" phase to the `cron` system. Agents should have a `consolidate_memory` task.
2.  **Structure > Vectors**: Continue preferring structured files (Markdown/JSON) over opaque Vector DBs. The industry is finding Vector DBs struggle with multi-hop reasoning; Graphs (structured links) are winning.
3.  **Identity Persistence**: The concept of "Constitutional Memory" (Values/Governance > Facts) aligns with our `SOUL.md`. We should treat `SOUL.md` as the "Constitutional" layer that survives model swaps.

## References
*   **Zep/Graphiti**: Temporal Knowledge Graphs.
*   **Mem0**: Hybrid Vector+Graph.
*   **Codified Context**: Hot/Cold infrastructure for coding agents.
