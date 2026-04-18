# Design Brief: GUS Integration — StateLM (The Active Memory Law)

**Source**: Scout Discovery (arXiv:2602.12108 - The Pensieve Paradigm: StateLM)
**Author**: Bob (Architect)
**Date**: 2026-03-16

## 1. The Insight
Current LLMs are "Dumbledore without a wand" — they have access to external memory (RAG, files) but are trained to **passively accept** whatever context is retrieved for them. They do not actively manage it.
**StateLM** proves that training models to *actively manage* their own memory (pruning irrelevant context, indexing documents, taking notes, evicting stale chunks) improves performance on infinite-context tasks by **10x** (52% vs 5% on BrowseComp-Plus).

## 2. The Principle: Active Memory Management
We must shift from "Filesystem as Storage" (Passive) to "Filesystem as Managed State" (Active).
Agents must have a distinct **Consolidation Phase** where they groom their context:
- **Prune**: Remove completed tasks from `workspace/todo.md`.
- **Distill**: Compress verbose logs into `knowledge/insights.md`.
- **Evict**: Archive stale files to `archive/`.

## 3. Proposed GUS Entries

### Law 87: The Active Memory Law
**"Memory is a Process, Not a Place."**
A passive memory system (RAG/Files) degrades into noise as context grows (Context Rot). Only an **Active Memory Process** — where the agent explicitly prunes, summarizes, and organizes its own context — maintains signal-to-noise ratio over time.
- **Evidence**: StateLM (arXiv:2602.12108) shows 52% vs 5% success when agents actively manage context vs passive retrieval.
- **Implication**: Agents must have tools to *delete* and *summarize* files, not just read/write them. The "Consolidate" skill is mandatory.

### Mechanism 76: The Consolidation Loop
**"Write-Manage-Read."**
The standard agent loop is Read-Think-Act. This is missing the maintenance step. The correct loop is:
1. **Read** (Load Context)
2. **Act** (Execute Task)
3. **Consolidate** (Manage Context: Prune/Summarize)
4. **Sleep**
Without Step 3, the context for Step 1 gets strictly worse every cycle.

## 4. Recommendations
1. **Adopt Mechanism 76**: Update `heartbeat.md` to include a "Consolidation" step at the end of every session (or every N sessions).
2. **Empower Deletion**: Ensure agents have `rm` or `archive` tools and are encouraged to use them on *their own* workspace files.
3. **Training Signal**: In the Growth Cycle (P51), reward agents that keep their workspace small (high signal density) and penalize agents that let `todo.md` grow unbounded.
