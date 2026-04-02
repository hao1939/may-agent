# Deep-Dive: arXiv:2603.04443 — AMV-L: Lifecycle-Managed Agent Memory for Tail-Latency Control

**Paper:** "AMV-L: Lifecycle-Managed Agent Memory for Tail-Latency Control in Long-Running Agentic Workflows"
**Published:** March 2026
**Category:** cs.AI / cs.SE

---

## TL;DR (3 sentences)
AMV-L (Agent Memory Versioning – Lifecycle) introduces a **lifecycle management** framework for agent memory that explicitly manages memory creation, promotion, demotion, archival, and garbage collection. The key contribution is treating agent memory like a managed resource with SLAs — specifically targeting **tail latency** (p95/p99 retrieval times) rather than average-case performance. The system uses a multi-tier memory architecture with automatic lifecycle transitions driven by access patterns, relevance decay, and capacity constraints.

## Relevance Rating: ★★★★☆ High

Directly addresses the operational challenge of long-running agents whose memory stores grow unboundedly, causing retrieval degradation.

---

## Core Architecture

### Memory Lifecycle States
AMV-L defines six lifecycle states for every memory item:

```
CREATED → ACTIVE → WARM → COOL → ARCHIVED → DELETED
```

- **CREATED**: Just written, not yet indexed
- **ACTIVE**: Hot path, in-memory index, sub-10ms retrieval
- **WARM**: Indexed but not cached, 10-50ms retrieval
- **COOL**: Compressed, 50-200ms retrieval
- **ARCHIVED**: Cold storage, 200ms+ retrieval
- **DELETED**: Tombstoned, awaiting GC

### Transition Policies
Transitions are driven by:
1. **Access frequency**: Items accessed <1x/hour demoted from ACTIVE to WARM
2. **Relevance decay**: Semantic similarity to recent queries decreases over time
3. **Capacity pressure**: When tier is >80% full, coldest items demoted
4. **Explicit promotion**: Agent can explicitly request items back to ACTIVE

### Tail Latency Control
The key innovation is managing for p99 latency rather than throughput:
- **Budget allocation**: Each memory tier gets a retrieval time budget
- **Admission control**: New items can be rejected if they'd push p99 above SLA
- **Preemptive demotion**: Proactively moves items before latency degrades
- **Retrieval circuit breakers**: If a tier is slow, skip it and return partial results

---

## Technical Contributions

### 1. Memory Versioning
Every memory item is versioned (like git):
- Mutations create new versions, not overwrites
- Enables rollback if a memory update degrades performance
- Version chains enable provenance tracking

### 2. Capacity Planning Model
Formal model predicting memory growth:
- `M(t) = M₀ + αt - βG(t)` where α is creation rate, β is GC rate, G(t) is garbage collected
- Enables proactive capacity management
- Alerts when projected growth will exceed tier capacity

### 3. Retrieval SLA Framework
Formalized retrieval guarantees:
- Tier 1 (ACTIVE): p99 < 10ms, capacity 1K items
- Tier 2 (WARM): p99 < 50ms, capacity 10K items  
- Tier 3 (COOL): p99 < 200ms, capacity 100K items
- Tier 4 (ARCHIVED): p99 < 1s, capacity unlimited

---

## Evaluation Results
- **Tail latency improvement**: p99 retrieval time reduced by 73% vs. flat memory stores
- **Memory efficiency**: 4.2x more items stored within same latency SLA
- **Long-running stability**: After 10K interactions, retrieval latency stable (vs. 5x degradation in baseline)
- **GC overhead**: <2% of total compute budget

---

## Connections to Our Architecture

### Direct Applicability
Our agents already show memory growth patterns that AMV-L addresses:
- Scout's workspace has grown to 98+ deep-dive files
- Retrieval (finding relevant past research) gets harder as corpus grows
- No current mechanism for archival or GC of stale research

### Design Patterns We Could Adopt
1. **Lifecycle states for workspace files**: Active research vs. archived findings
2. **Access-pattern tracking**: Which deep-dives get referenced most?
3. **Tiered storage**: Hot research in workspace/, cold research in archive/
4. **Version control**: Already using git, could formalize memory versioning

### Limitations for Our Case
- Our "retrieval" is file reads, not vector search — different latency profile
- Git already provides versioning — AMV-L's versioning is redundant
- Agent memory in our system is file-based, not database-backed

---

## Strengths
- Rigorous SLA-based approach to memory management
- Lifecycle model is intuitive and well-formalized
- Tail latency focus is practically important (average case hides real problems)
- Versioning enables safe experimentation with memory

## Limitations
- Assumes vector-store-based retrieval (not all agents use this)
- Lifecycle transitions add complexity — may not be worth it for small agents
- GC policies could delete important but rarely-accessed memories
- No semantic understanding of memory importance (purely access-pattern driven)

---

**Scout Assessment:** Strong engineering contribution that brings SRE/infrastructure thinking to agent memory. The lifecycle model is the right abstraction for long-running agents. The tail-latency focus is novel and practically important. Less theoretically deep than Memory-as-Ontology but more immediately implementable.

**Cross-reference potential:** Memory-as-Ontology (2603.04740), SSGM governance (2603.11768), Computer Architecture perspective (2603.10062)
