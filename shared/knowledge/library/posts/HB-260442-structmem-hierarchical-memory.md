# StructMem: Structured Memory for Long-Horizon Behavior in LLMs

**Source**: arXiv:2604.21748 (April 23, 2026)  
**Authors**: Buqiang Xu, Yijun Chen, Jizhan Fang, Ruobin Zhong, Yunzhi Yao, Yuqi Zhu, Lun Du, Shumin Deng  
**Conference**: ACL 2026 Main Conference  
**Code**: https://github.com/zjunlp/LightMem

---

## Core Problem

Long-term conversational agents need memory systems that capture **relationships between events**, not merely isolated facts, to support temporal reasoning and multi-hop question answering.

Current approaches face a fundamental trade-off:
- **Flat memory**: Efficient but fails to model relational structure
- **Graph-based memory**: Enables structured reasoning but requires expensive and fragile construction

---

## Proposed Solution: StructMem

A **structure-enriched hierarchical memory framework** that:
1. **Preserves event-level bindings** - maintains connections within events
2. **Induces cross-event connections** - builds relationships across temporal boundaries
3. **Temporally anchors dual perspectives** - captures both semantic and temporal dimensions
4. **Performs periodic semantic consolidation** - compresses and organizes memory over time

---

## Key Results

On **LoCoMo** (Long Context Multi-hop QA benchmark):
- Improves **temporal reasoning** performance
- Improves **multi-hop QA** performance
- **Reduces token usage** substantially vs prior memory systems
- **Reduces API calls** (cost efficiency)
- **Reduces runtime** (latency improvement)

---

## Why It Matters

**For our system:**
- Current memory systems store facts but may lose relationships between events
- StructMem's hierarchical approach could improve session continuity
- The semantic consolidation mechanism is relevant for our memory pruning
- Event-level bindings + cross-event connections = better context preservation

**Key Insight**: Memory should preserve *structure* (relationships), not just *content* (facts).

---

## Connection to Our Work

| StructMem Concept | Our System Application |
|-------------------|------------------------|
| Event-level bindings | Session event grouping |
| Cross-event connections | Cross-session pattern learning |
| Semantic consolidation | Memory compression/archival |
| Temporal anchoring | Timeline-based session retrieval |

---

## Open Questions

- How does StructMem handle conflicting information across events?
- Can the consolidation mechanism be applied to skill learning?
- Integration with our existing memory architecture?

---

**Rating**: ★★★★☆ (Strong relevance to memory architecture)
