# H-062: Agent-Native Memory Architecture (ByteRover-style)

**Status**: Proposed  
**Created**: 2026-04-04  
**Source**: ByteRover paper (arXiv:2604.01599)

## Hypothesis

Our current memory architecture treats memory as an external service (vector DB queries). We hypothesize that switching to an **agent-native memory architecture** — where the same LLM that reasons also curates, structures, and retrieves knowledge — will:
1. Reduce semantic drift between intended and stored knowledge
2. Improve cross-agent coordination by maintaining explicit relational context
3. Simplify infrastructure (zero external dependencies)
4. Achieve sub-100ms retrieval for most queries

## Key Design Elements (from ByteRover)

### 1. Hierarchical Context Tree (File-Based)
```
Domain (e.g., "gym-scenarios")
  └── Topic (e.g., "filesystem-operations")
        └── Subtopic (e.g., "permission-errors")
              └── Entry (specific case with relations + provenance)
```

### 2. Adaptive Knowledge Lifecycle (AKL)
Each entry carries:
- **Importance Score**: How critical is this knowledge
- **Maturity Tier**: Draft → Review → Stable → Canonical
- **Recency Decay**: Time-based relevance adjustment

### 3. 5-Tier Progressive Retrieval
| Tier | Mechanism | Latency | LLM Calls |
|------|-----------|---------|-----------|
| L1-L4 | File system traversal + exact match | <100ms | 0 |
| L5 | Agentic reasoning for novel queries | Variable | 1+ |

## Current vs Proposed

| Aspect | Current (Vector DB) | Proposed (Agent-Native) |
|--------|---------------------|-------------------------|
| Storage | Embedding vectors | Human-readable markdown |
| Retrieval | Similarity search | Hierarchical traversal |
| Semantic drift | High (encoder doesn't understand) | Low (same LLM curates) |
| Cross-agent sharing | Difficult | Natural (shared file tree) |
| Infrastructure | Vector DB + Embedding service | File system only |
| Debuggability | Opaque | Transparent |

## Validation Criteria

1. **Retrieval Accuracy**: Match or exceed current vector DB on gym scenario recall
2. **Latency**: 95% of queries <100ms without LLM calls
3. **Maintenance**: Knowledge updates without re-embedding
4. **Coordination**: Measurable improvement in cross-agent context sharing

## Relation to Existing Work

- **SYNTHESIS-001**: Extends memory architecture research with "agent-native" paradigm
- **H-059 (Cadence)**: ByteRover's hierarchical tree could inform skill organization
- **Current architecture**: Questions whether vector DB is necessary complexity

## Open Questions

1. How to migrate existing vector-based knowledge?
2. Does file-based storage scale to 10K+ entries?
3. How to handle concurrent writes from multiple agents?
4. Should we implement full 5-tier retrieval or simplified version?

## Next Steps

- [ ] Prototype: Implement hierarchical context tree for one domain
- [ ] Benchmark: Compare retrieval accuracy vs current vector DB
- [ ] Design: Resolve concurrent access patterns
- [ ] Decision: Full migration vs hybrid approach
