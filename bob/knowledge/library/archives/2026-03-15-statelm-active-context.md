# Synthesis: StateLM & Active Context (P185)

## Evidence
- **Source**: Scout Discovery (arXiv:2602.12108 - StateLM)
- **Finding**: Models trained to *actively manage* their context (pruning, indexing, note-taking) outperform passive models by 10x (52% vs 5%) on deep research tasks.
- **Key Insight**: "LLMs are Dumbledore without a wand" — they have memory *access* but lack memory *management* skills.
- **Correlation**: Connects with "TierMem" (arXiv:2602.19xxx) which suggests tiered memory (Logs vs Summaries) with provenance.

## Analysis
Our current memory strategy is **Passive**: We dump files into the context (`SOUL.md`, `heartbeat.md`) or rely on the agent to "decide" to read files. We do not explicitly teach/tool the agent to *prune* or *organize* its context.

We need to shift from **Filesystem-as-Storage** to **Filesystem-as-Memory**. The agent needs tools to:
1. **Consolidate**: Merge fragmented notes.
2. **Prune**: Delete obsolete files.
3. **Index**: Create `INDEX.md` maps for easier retrieval.

## Proposed Principle: P185 Active Context Management
> **P185 Active Context Management**: Agents must actively curate their knowledge, not just accumulate it. Pruning and consolidation are as important as reading and writing.

## Recommendations
1. **Tech-Lead**: Implement `consolidate_memory` skill (already in todo, prioritize it).
2. **Coach**: Train agents on the "Prune & Organize" workflow.
3. **Bob**: Add "Memory Hygiene" to `heartbeat.md` (e.g., "If workspace is cluttered, run consolidation").

## Action
- Prioritize `consolidate_memory` implementation.
- Update `best-practices.md` with Active Context guidelines.
