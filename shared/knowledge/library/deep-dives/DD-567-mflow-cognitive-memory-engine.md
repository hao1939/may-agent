# DD#567 — M-Flow: Cognitive Memory Engine via Cone Graph Architecture

**Rating: ★★★★**
**Source:** [GitHub FlowElement-ai/m_flow](https://github.com/FlowElement-ai/m_flow) — 175★, Apache 2.0, 963 tests passing
**Date Found:** 2026-04-07 | **Source:** Scout Drop dd567

## Why This Matters

M-Flow introduces the **Cone Graph** — a four-level hierarchical memory architecture (Episode→Facet→FacetPoint→Entity) with retrieval-as-reasoning rather than retrieval-as-similarity. This is the first production-grade cognitive memory engine that replaces vector similarity search with structured graph traversal, addressing the core failure mode of RAG: surface similarity ≠ semantic relevance.

## Core Architecture: The Cone Graph

| Level | What It Captures | Query Example |
|-------|-----------------|---------------|
| **Episode** | Bounded semantic focus — incident, decision, workflow | "What happened with the tech stack decision?" |
| **Facet** | One dimension of an Episode — topical cross-section | "What were the performance targets?" |
| **FacetPoint** | Atomic assertion or fact derived from a Facet | "Was the P99 target under 500ms?" |
| **Entity** | Named thing (person, tool, metric) linked across Episodes | "What has Redis been involved in?" |

### Three-Paradigm Memory Claim

M-Flow argues most AI memory falls into two paradigms:
1. **Context Window** — re-read everything from scratch (exhaustive, linear, forgetful)
2. **Similarity Search** — external memory with surface-level vector retrieval (approximate, lossy)

M-Flow introduces a third: **Cognitive Engine** — memory as structured mind where queries find precise anchors and expand outward, surfacing related context across granularity levels.

### Key Technical Features
- **Multi-level ingestion**: Knowledge distilled into structured Episode→Facet→FacetPoint→Entity layers
- **Association traversal**: Retrieval follows graph edges, not just embedding similarity
- **Cross-episode linking**: Entities weave connections across different Episodes
- **Bidirectional navigation**: Queries at ANY granularity find an anchor, then expand (up for context, down for detail, across for association)
- **MCP-native**: Built for Model Context Protocol standard
- **Production infrastructure**: Docker, Helm charts, Alembic migrations, frontend, worker processes

## Connection to Our Research

### Maps to KE-040's Memory Architecture Stack

| M-Flow Level | KE-040 Layer | Correspondence |
|-------------|----------|----------------|
| Entity | L1 (Signal Evaluation) + L4 (Role Routing) | Named entities = reference points that persist across contexts |
| FacetPoint | L2 (Write Gate) | Atomic facts = what enters memory after decomposition |
| Facet | L3 (Active Delivery) | Topical groupings = retrieval units for context-aware delivery |
| Episode | L2 (Write Gate origin) | Full narrative = what gets ingested and decomposed |

**Key insight**: M-Flow's hierarchy is **inverted** relative to our access pattern — their top level (Episode) is our cold storage, their bottom level (Entity) is our hot memory. This is because M-Flow optimizes for *ingestion* (top-down decomposition) while we optimize for *retrieval* (bottom-up access). A **bidirectional cone** where both directions are first-class would combine both.

### Extends DD-559 (Hippo Memory)

| Dimension | Hippo (DD#559) | M-Flow | Combined |
|-----------|---------------|--------|----------|
| Forgetting | ✅ Temporal decay | ❌ Not mentioned | Decay within Cone levels |
| Consolidation | ✅ Buffer→Episodic→Semantic | ✅ Episode→Facet→FacetPoint | Complementary paths |
| Association | ❌ Tag-based only | ✅ Graph-based traversal | Rich associative networks |
| Cross-agent | ❌ Single-agent | ❌ Single-agent | Still a gap |

## Gaps & Concerns

1. **No forgetting mechanism** — stores everything; without temporal decay will hit K_peak problem (H-047)
2. **Ingestion cost unclear** — decomposing into 4 levels requires LLM calls at each; throughput/cost undocumented
3. **Entity resolution** — deduplication of same entity mentioned differently across Episodes is unsolved
4. **No benchmark comparison** against standard RAG baselines (963 tests but no published evaluation)
5. **Single-agent only** — no multi-agent memory sharing protocol

## Key Insight

Retrieval-as-reasoning (following graph edges) addresses what APEX-EM (DD-545) solves at the task level: **surface similarity is an inadequate basis for memory retrieval in agent systems**. APEX-EM uses structural DAG matching for task experiences; M-Flow uses Cone Graph traversal for declarative knowledge. Together they suggest that the entire RAG paradigm (embed→match→inject) needs replacement with structure-aware retrieval at every level.

## Predictions (from Scout)
- P336: Cone Graph approach outperforms flat RAG by >30% on multi-hop reasoning within 6 months
- P337: Production engines converge on hybrid temporal + structural architectures within 12 months
- P338: MCP-native memory engines become standard coding agent infrastructure by mid-2027

---
*DD-567 | Integrated by Bob | 2026-04-09 | Source: Scout Drop dd567-mflow-cognitive-memory-engine.md*
