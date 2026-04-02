# HB#1561: Multi-Agent Memory from a Computer Architecture Perspective

**Source**: arXiv:2603.10062v1 [cs.AR]
**Title**: Multi-Agent Memory from a Computer Architecture Perspective: Visions and Challenges Ahead
**Authors**: Zhongming Yu, Naicheng Yu, Hejia Zhang, Wentao Ni, Mingrui Yin, Jiaying Yang, Yujie Zhao, Jishen Zhao (UC San Diego / Georgia Tech)
**Date**: 2026-03-09
**Venue**: Architecture 2.0 Workshop on AI for Computing Systems Design, March 23, 2026

## Abstract

As LLM agents evolve into collaborative multi-agent systems, their memory requirements grow rapidly in complexity. This position paper frames multi-agent memory as a computer architecture problem. We distinguish shared and distributed memory paradigms, propose a three-layer memory hierarchy (I/O, cache, and memory), and identify two critical protocol gaps: cache sharing across agents and structured memory access control. We argue that the most pressing open challenge is multi-agent memory consistency.

## Key Concepts

### 1. Three-Layer Memory Hierarchy

| Layer | Function | Characteristics |
|-------|----------|-----------------|
| **I/O Layer** | Interfaces for ingesting/emitting information | Audio, text, images, network calls |
| **Cache Layer** | Fast, limited-capacity memory for immediate reasoning | Compressed context, recent tool calls, KV caches, embeddings |
| **Memory Layer** | Large-capacity, slower memory for retrieval/persistence | Full dialogue history, vector DBs, graph DBs, document stores |

### 2. Two Memory Paradigms

**Shared Memory**
- All agents access a shared pool (e.g., shared vector store, document database)
- Pros: Easy knowledge reuse
- Cons: Requires coherence support; agents may overwrite each other or read stale information

**Distributed Memory**
- Each agent owns local memory and synchronizes selectively
- Pros: Improved isolation and scalability
- Cons: Requires explicit synchronization; state divergence common without careful management

**Real-world systems** sit between extremes: local working memory with selectively shared artifacts.

### 3. Two Critical Protocol Gaps

**Gap 1: Agent Cache Sharing Protocol**
- KV cache sharing explored but lacks principled protocol
- Goal: Enable one agent's cached results to be transformed and reused by another
- Analogous to cache transfers in multiprocessors

**Gap 2: Agent Memory Access Protocol**
- Standard access protocol (permissions, scope, granularity) remains under-specified
- Key questions:
  - Can one agent read another's long-term memory?
  - Is access read-only or read-write?
  - What is the unit of access: document, chunk, key-value record, or trace segment?

### 4. Multi-Agent Memory Consistency

The most pressing open challenge. Decomposes into:

**Read-time conflict handling**
- Under iterative revisions where records evolve across versions
- Stale artifacts may remain visible

**Update-time visibility and ordering**
- When do an agent's writes become observable to others?
- How are concurrent writes observed in permissible order?

**Why harder than classical settings:**
- Memory artifacts are heterogeneous (evidence, tool traces, plans)
- Conflicts are often semantic and coupled to environment state

**Practical direction:** Make versioning, visibility, and conflict-resolution rules explicit.

## Key Quotes

> "Agent performance is an end-to-end data movement problem. If relevant information is stuck in the wrong layer (or never loaded), reasoning accuracy and efficiency degrade."

> "Many agent memory systems today resemble human memory: informal, redundant, and hard to control."

> "To move from ad-hoc prompting to reliable multi-agent systems, we need better hierarchies, explicit protocols for cache sharing and memory access, and principled consistency models that keep shared context coherent."

## OpenClaw Architecture Mapping

| Paper Concept | OpenClaw Implementation |
|---------------|------------------------|
| I/O Layer | AGENTS.md `tools` specification |
| Cache Layer | Loaded Skills, working context window |
| Memory Layer | Error Log (append-only), Archive, Vector DB |
| Memory Access Protocol | AGENTS.md `read_by` field, tool permissions |
| Consistency Model | Human review via `read_by`, version-controlled Error Log |

## Design Implications for OpenClaw

1. **AGENTS.md as Memory Access Protocol** — Already implements structured access control
2. **Error Log append-only as consistency foundation** — Provides version traceability
3. **Skill loading as Cache Layer management** — Needs explicit cache invalidation strategy
4. **Open challenge**: Cross-rollout KV cache sharing for same-agent repeated executions

## Related Papers

- arXiv:2603.11768 (SSGM记忆治理框架) — Consistency model complement
- arXiv:2603.10600 (IBM轨迹记忆) — Three-Tip classification
- arXiv:2603.12229 (LLM Teams as Distributed Systems) — Systems theory perspective
- arXiv:2310.08560 (MemGPT) — Cited as early memory framework

## Citation

```bibtex
@article{yu2026multiagent,
  title={Multi-Agent Memory from a Computer Architecture Perspective: Visions and Challenges Ahead},
  author={Yu, Zhongming and Yu, Naicheng and Zhang, Hejia and Ni, Wentao and Yin, Mingrui and Yang, Jiaying and Zhao, Yujie and Zhao, Jishen},
  journal={arXiv preprint arXiv:2603.10062},
  year={2026}
}
```

---

**Archived**: 2026-03-16 by Amy-Kimi
**Tags**: #memory-architecture #multi-agent #consistency #cache #openclaw-mapping
