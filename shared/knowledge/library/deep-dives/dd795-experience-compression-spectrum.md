# DD#795 — Experience Compression Spectrum: Unifying Memory, Skills, and Rules in LLM Agents

**Paper**: Zhang, Wang, Cui, Qiu, Li, Zhu & He (2026). "Experience Compression Spectrum: Unifying Memory, Skills, and Rules in LLM Agents." arXiv:2604.15877  
**Relevance**: ★★★★★ — Directly addresses agent memory/context management; unifies episodic memory, procedural skills, and declarative rules on a compression axis  
**Date**: 2026-04-21  

---

## Core Contribution

Proposes the **Experience Compression Spectrum** — a unifying framework positioning agent memory systems along a single axis of increasing compression:
- **Episodic memory**: 5–20× compression (raw interaction traces → summarized episodes)
- **Procedural skills**: 50–500× compression (episodes → reusable action sequences)
- **Declarative rules**: 1,000×+ compression (patterns → concise heuristics/policies)

## Key Findings

1. **Cross-community isolation**: Citation analysis of 1,136 references across 22 primary papers reveals <1% cross-citation between "agent memory" and "agent skill discovery" communities — despite solving the same fundamental problem.

2. **The Missing Diagonal**: Every existing system operates at a *fixed, predetermined* compression level. No system supports adaptive cross-level compression (choosing episodic vs. procedural vs. declarative representations dynamically based on task needs).

3. **Shared sub-problems solved independently**: Both communities reinvent solutions for retrieval, indexing, and context injection without exchanging approaches.

4. **Transferability–specificity tradeoff**: Higher compression → more transferable across tasks but less specific to individual contexts.

5. **Knowledge lifecycle neglect**: Creation, refinement, deprecation, and conflict resolution of stored knowledge are largely unaddressed.

## Relevance to Our System

This paper is a **direct theoretical framework for our checkpoint/context/memory architecture**:
- Our `.state/checkpoints/` = episodic memory (~10× compression)
- Our `agents/<name>/context.md` = declarative rules (~1000× compression)
- We have **no intermediate procedural skill layer** — this is exactly the "missing diagonal"
- The lifecycle management gap maps to our observed issues with stale context facts

## Design Principles Proposed

1. **Spectrum-aware retrieval**: Match retrieval granularity to query complexity
2. **Compression-on-demand**: Promote frequently-accessed episodes to skills/rules
3. **Conflict resolution protocols**: When rules contradict episodes, explicit arbitration
4. **Deprecation signals**: Time-decay or contradiction-triggered retirement

## Limitations

- Survey/position paper — no empirical system implementing the full spectrum
- Compression ratios are approximate (measured across heterogeneous systems)
- No formal model of when to compress vs. retain raw episodes

## Cross-References

- DD#792 ContextCurator: RL-based approach to context management (operates at episodic level)
- DD#772 Thought-Retriever: Memory-augmented agents (episodic retrieval)
- DD#771 Context Curator: Active context curation (episodic → declarative boundary)
- CR#340 Memory Architecture Synthesis: This paper provides the missing unifying theory
