# Semantic Memory Graphs for Persistent Agent Knowledge

**Authors:** Ramirez, Liu, Petrov (2024)
**Venue:** ICML 2024 Workshop on Foundation Model Agents

## Abstract

We introduce SemanticWeave, a knowledge-graph-based memory system for LLM agents that structures learned facts as entity-relation triples with confidence scores and provenance tracking. Rather than storing raw experiences, SemanticWeave extracts and maintains a growing ontology of the agent's operational domain, enabling efficient reasoning over accumulated knowledge without retrieving lengthy historical transcripts.

## Approach

After each task, a distillation step extracts factual claims from the session transcript (e.g., "project X uses framework Y", "function Z has bug type W"). Claims are represented as weighted triples in a property graph with timestamps and source references. Conflicting claims trigger a resolution protocol: newer claims with higher-confidence sources override older ones, but contradictions are flagged for review. The graph supports structured queries ("what frameworks does project X use?") and fuzzy traversal ("what's related to this error pattern?"). A nightly compaction pass merges redundant nodes and prunes low-confidence claims older than 30 days.

## Key Results

In a 30-day deployment with a coding assistant handling 15 repositories, SemanticWeave reduced redundant questions to users by 67% and improved cross-session context accuracy from 34% to 78%. The knowledge graph grew to ~4,200 triples occupying 1.8MB. Structured queries resolved in <10ms. The main advantage over episodic approaches was cross-task transfer: facts learned in one repository context correctly informed work in related repositories 43% of the time. Agent self-consistency (giving the same answer to equivalent questions) improved from 51% to 89%.

## Limitations

The distillation step is lossy — procedural knowledge ("how to deploy service X") is poorly captured as static triples. The system requires careful ontology design; poorly chosen entity types led to graph fragmentation in 2 of 15 repositories. Update latency (distillation runs post-task) means the graph is always one task behind. The approach also cannot represent sequential procedures or temporal dependencies between facts.
