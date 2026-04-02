# Agent Memory Persistence in Multi-Agent Systems: A Comprehensive Research Report (2025–2026)

**Date:** March 2026  
**Scope:** State-of-the-art approaches, key papers/projects, architectural patterns, tradeoffs, and practical recommendations  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Problem Statement](#2-background--problem-statement)
3. [Taxonomy of Agent Memory](#3-taxonomy-of-agent-memory)
4. [State-of-the-Art Approaches](#4-state-of-the-art-approaches)
   - 4.1 Context-Resident Compression
   - 4.2 Retrieval-Augmented Memory Stores
   - 4.3 Reflective Self-Improvement Memory
   - 4.4 Hierarchical Virtual Context
   - 4.5 Policy-Learned Memory Management
   - 4.6 Graph-Based Temporal Memory
   - 4.7 Low-Level KV Cache Persistence
5. [Key Papers & Research (2023–2026)](#5-key-papers--research-20232026)
6. [Production Frameworks & Platforms](#6-production-frameworks--platforms)
   - 6.1 Mem0
   - 6.2 Letta (formerly MemGPT)
   - 6.3 Zep
   - 6.4 LangGraph
   - 6.5 Other Notable Systems
7. [Architectural Patterns for Multi-Agent Memory](#7-architectural-patterns-for-multi-agent-memory)
   - 7.1 Shared Scratchpad
   - 7.2 Private + Shared Memory Tiers
   - 7.3 Supervisor-Mediated Memory
   - 7.4 Hierarchical Consolidation
   - 7.5 Saga/Transactional Memory
   - 7.6 Hot/Cold Memory Separation
   - 7.7 Constitutional Memory Architecture
8. [Multi-Agent–Specific Challenges](#8-multi-agentspecific-challenges)
   - 8.1 Memory Poisoning & Trust
   - 8.2 Access Control & Provenance
   - 8.3 Contradiction Handling & State Updates
   - 8.4 Scalability & Latency
   - 8.5 Privacy & Governance
9. [Tradeoffs Analysis](#9-tradeoffs-analysis)
10. [Practical Recommendations](#10-practical-recommendations)
11. [Open Challenges & Future Directions](#11-open-challenges--future-directions)
12. [References](#12-references)

---

## 1. Executive Summary

Memory persistence—the ability to store, organize, and selectively recall information across interactions and sessions—is the single most important capability that transforms stateless LLM text generators into genuinely adaptive agents. In multi-agent systems (MAS), where multiple autonomous agents must coordinate, share context, and maintain individual and collective state, memory persistence becomes both more critical and significantly more complex.

This report synthesizes the latest research (2022–2026) across 60+ papers, production frameworks, and open-source projects. The field has undergone rapid maturation:

- **2023** saw foundational work on generative agent memory architectures (Park et al.) and the first memory-augmented agent frameworks.
- **2024** brought production-grade memory platforms (Mem0, Letta, Zep) and graph-based approaches.
- **2025–2026** has seen an explosion of specialized research: temporal knowledge graphs, constitutional memory architectures, multi-agent memory sharing with access control, edge-device KV cache persistence, memory poisoning defenses, and transactional guarantees for agent workflows.

**Key findings:**
- The **write–manage–read loop** paradigm is now the standard formalization for agent memory.
- **Graph-based temporal memory** has emerged as the leading approach for production systems, offering 15%+ improvements in multi-hop reasoning tasks.
- **Memory security** (poisoning, leakage) is the most under-addressed domain in current frameworks.
- **No single framework** covers all memory persistence needs; hybrid architectures combining 2–3 complementary approaches are recommended.
- The frontier has shifted from "can we remember?" to "what should we forget?" — **learned forgetting** and **continual consolidation** are the key open problems.

---

## 2. Background & Problem Statement

### The Fundamental Limitation

LLMs operate within fixed context windows. Even with models supporting 128K–1M tokens, this window is insufficient for:
- Multi-session conversations spanning days/weeks
- Agents that must learn from accumulated experience
- Coordination among multiple agents with overlapping and divergent knowledge
- Long-horizon tasks requiring state tracking across phases

### Why Multi-Agent Systems Make This Harder

In single-agent scenarios, memory is already challenging. Multi-agent systems introduce additional complexity dimensions:

| Challenge | Single-Agent | Multi-Agent |
|-----------|-------------|-------------|
| State consistency | One agent's view | Must reconcile N agents' views |
| Access control | Trivial | Per-agent permissions, shared vs. private |
| Contradiction resolution | Self-contradiction only | Cross-agent contradictions |
| Scalability | O(1) memory stores | O(N) or O(N²) memory interactions |
| Security surface | Single write path | N write paths, potential poisoning |
| Coordination overhead | None | Synchronization, ordering, transactions |

### The Write–Manage–Read Formalization

The 2026 survey by Du formalizes agent memory as a **write–manage–read loop** tightly coupled with perception and action:

```
Perception → Write (extract & store) → Manage (consolidate, prune, update) → Read (retrieve & inject) → Action
```

This formalization applies at both individual agent and system levels, with the multi-agent case adding inter-agent memory coordination as a cross-cutting concern.

---

## 3. Taxonomy of Agent Memory

Building on Du (2026), agent memory can be classified along three independent dimensions:

### Dimension 1: Temporal Scope

| Type | Duration | Example |
|------|----------|---------|
| **Working/Scratch** | Within single task | Current conversation context |
| **Episodic** | Session-level | Logs of a completed subtask |
| **Semantic** | Cross-session | Learned facts, preferences, rules |
| **Procedural** | Indefinite | Skills, strategies, reusable plans |

### Dimension 2: Representational Substrate

| Substrate | Description | Strengths |
|-----------|-------------|-----------|
| **Raw text** | Natural language transcripts | Simple, no information loss |
| **Compressed text** | Summaries, abstractions | Token-efficient |
| **Key-value pairs** | Structured facts | Fast lookup, easy dedup |
| **Vectors/Embeddings** | Dense representations | Semantic similarity search |
| **Knowledge graphs** | Entities + relationships | Multi-hop reasoning, temporal tracking |
| **KV cache tensors** | Model-internal attention state | Zero-latency restoration, sub-symbolic |

### Dimension 3: Control Policy

| Policy | Description |
|--------|-------------|
| **Rule-based** | Fixed heuristics (e.g., recency, importance scoring) |
| **LLM-driven** | Agent decides what to write/read/forget |
| **Learned** | RL or supervised policy optimized for downstream task |
| **Hybrid** | Combination (e.g., rule-based filtering + LLM-driven consolidation) |

---

## 4. State-of-the-Art Approaches

### 4.1 Context-Resident Compression

**Approach:** Keep everything within the LLM's context window by compressing conversation history into summaries that occupy fewer tokens.

**Mechanism:** Running summaries, progressive distillation, sliding-window approaches that retain recent raw messages plus compressed older context.

**Strengths:** Zero external infrastructure; works with any LLM API.  
**Weaknesses:** Lossy compression; O(n) cost for long histories; no cross-session persistence without external storage; cannot support multi-agent sharing.

**Status (2026):** Widely used as baseline, but insufficient alone for any production multi-agent system.

### 4.2 Retrieval-Augmented Memory Stores

**Approach:** Store memories in external vector databases; retrieve relevant memories via embedding similarity before each agent action.

**Key implementations:**
- **Mem0** (Chhikara et al., 2025): Dynamic extraction + consolidation + retrieval. Achieved 26% improvement over OpenAI baselines on LOCOMO benchmark, 91% lower p95 latency vs. full-context, 90% token cost savings.
- Standard RAG pipelines with various chunk sizes and retrieval parameters.

**Strengths:** Scalable; persistent; framework-agnostic.  
**Weaknesses:** Retrieval quality is bounded by embedding similarity; struggles with multi-hop reasoning across disconnected evidence; static snapshots don't reflect evolving state.

### 4.3 Reflective Self-Improvement Memory

**Approach:** Agents periodically reflect on accumulated experiences to distill higher-level insights, strategies, and self-corrections.

**Pioneering work:** Park et al. (2023) — **Generative Agents** introduced the observation → reflection → planning architecture, where agents synthesize daily reflections from episodic memories. This remains the most-cited foundational architecture.

**Modern evolution:**
- **EvoScientist** (Lyu et al., 2026): Multi-agent system with an Evolution Manager Agent that distills insights from prior interactions into reusable knowledge across ideation memory and experimentation memory modules.
- **PEPA** (Liu et al., 2026): Personality-driven agents with episodic memory and daily self-reflection for persistent autonomous behavior.

**Strengths:** Produces genuinely adaptive behavior; reduces repetition of failures.  
**Weaknesses:** Reflection quality depends on LLM reasoning ability; risk of hallucinated reflections; expensive (requires dedicated LLM calls for reflection).

### 4.4 Hierarchical Virtual Context

**Approach:** Organize memory into multiple levels of abstraction that can be loaded on-demand, creating a "virtual" context much larger than the physical window.

**Key implementation:**
- **IronEngine** (Mo, 2026): Hierarchical memory with multi-level consolidation. Features a three-phase pipeline separating planning from execution, with vectorized skill repository (ChromaDB) and adaptive model management supporting 92 model profiles with VRAM-aware context budgeting.
- **Codified Context** (Vasilopoulos, 2026): Three-component architecture for coding agents: (1) hot-memory constitution (conventions, protocols), (2) 19 specialized domain-expert agents, (3) cold-memory knowledge base of 34 on-demand specifications. Tested across 283 development sessions on a 108K-line codebase.

**Strengths:** Balances breadth and depth; supports progressive detail loading.  
**Weaknesses:** Complex to implement; requires careful tuning of what goes at each level.

### 4.5 Policy-Learned Memory Management

**Approach:** Train a dedicated policy (via RL or distillation) that decides what to write, what to forget, and when to consolidate.

**Status (2026):** Still largely research-stage. Du (2026) identifies this as a key frontier. Most production systems use rule-based or LLM-driven policies rather than learned ones.

**Challenge:** Requires well-defined reward signals for memory quality, which are task-dependent and hard to specify.

### 4.6 Graph-Based Temporal Memory

**Approach:** Represent memories as knowledge graphs with temporal annotations, enabling multi-hop reasoning and state-change tracking.

**Key implementations:**
- **Zep/Graphiti:** Temporal context graph that evolves with every interaction. Facts carry validity time ranges; when facts change, old ones are invalidated. Achieves 80.32% accuracy on LoCoMo at 189ms retrieval latency.
- **AriadneMem** (Zhu et al., 2026): Structured graph memory with entropy-aware gating (filters noise), conflict-aware coarsening (merges duplicates while preserving state transitions as temporal edges), and algorithmic bridge discovery for multi-hop reasoning. Achieves **15.2% Multi-Hop F1 improvement** and **77.8% runtime reduction** using only 497 context tokens.
- **Mem0 with Graph Memory** (Chhikara et al., 2025): Enhanced variant leveraging graph-based representations, achieving ~2% higher overall score than base vector configuration.
- **Samyama** (Mandarapu & Kunkunuru, 2026): Unified graph-vector database in Rust combining RocksDB persistence, HNSW vector indexing, and Graph RAG. Demonstrates 255K nodes/sec ingestion and 115K Cypher queries/sec.

**Strengths:** Excels at multi-hop reasoning, temporal state tracking, contradiction detection.  
**Weaknesses:** Higher write-path complexity; graph construction requires entity/relationship extraction (LLM calls); storage overhead.

### 4.7 Low-Level KV Cache Persistence

**Approach:** Persist the model's internal KV cache to disk, enabling instant context restoration without re-computation.

**Key work:**
- **Shkolnikov (2026):** Persistent Q4 KV cache for multi-agent LLM inference on edge devices. Persists each agent's KV cache in 4-bit quantized format to disk (safetensors). Results:
  - **22–136x TTFT reduction** on Gemma 3 12B
  - **4x more agent contexts** in fixed device memory vs FP16
  - **< 3% perplexity degradation** from quantization
  - Enables 10-agent workflows on Apple M4 Pro where only 3 could fit before

**Strengths:** Eliminates redundant O(n) prefill computation; enables edge deployment.  
**Weaknesses:** Model-specific; doesn't support semantic retrieval; cache invalidation on context changes.

---

## 5. Key Papers & Research (2023–2026)

### Foundational Work

| Paper | Year | Key Contribution |
|-------|------|-----------------|
| **Generative Agents** (Park et al.) `arXiv:2304.03442` | 2023 | Introduced observation–reflection–planning memory architecture for believable agent behavior. Foundational for the entire field. |
| **MemGPT** (now Letta) | 2023 | Pioneered virtual context management with hierarchical memory tiers for LLM agents. |

### 2025 Research

| Paper | Key Contribution |
|-------|-----------------|
| **Mem0** (Chhikara et al.) `arXiv:2504.19413` | Production-ready memory architecture with dynamic extraction/consolidation/retrieval. 26% improvement over OpenAI on LOCOMO. Graph memory variant. |
| **Collaborative Memory** (Rezazadeh et al.) `arXiv:2505.18279` | Multi-user, multi-agent memory sharing with asymmetric, time-evolving access controls encoded as bipartite graphs. Private + shared memory tiers with immutable provenance. |
| **SagaLLM** (Chang & Geng) `arXiv:2503.11951` | Saga transactional pattern for multi-agent coordination with persistent memory, automated compensation, and independent validation agents. |
| **LLMs Working in Harmony** (Aratchige & Ilmini) `arXiv:2504.01963` | Survey of MAS technologies covering Architecture, Memory, Planning, and Frameworks. |
| **AI Agents vs. Agentic AI** (Sapkota et al.) `arXiv:2505.10468` | Taxonomy distinguishing AI Agents from Agentic AI, emphasizing persistent memory as a defining feature of agentic systems. Published in Information Fusion. |
| **HiBerNAC** (Wu et al.) `arXiv:2506.08296` | Brain-emulated hierarchical multi-agent system for robotic manipulation with persistent contextual memory. |

### 2026 Research (Cutting Edge)

| Paper | Key Contribution |
|-------|-----------------|
| **Memory for Autonomous LLM Agents** (Du) `arXiv:2603.07670` | Comprehensive survey (2022–2026). Formalizes write–manage–read loop. Three-dimensional taxonomy. Five mechanism families. Four benchmark analyses. |
| **Memory as Ontology / Animesis** (Li) `arXiv:2603.04740` | Paradigm shift: memory as ontological ground of digital existence, not just data management. Constitutional Memory Architecture (CMA) with four-layer governance hierarchy. |
| **Persistent Q4 KV Cache** (Shkolnikov) `arXiv:2603.04428` | Sub-prompt memory persistence via quantized KV cache. 136x TTFT reduction. Open-source. |
| **AriadneMem** (Zhu et al.) `arXiv:2603.03290` | Graph-based lifelong memory with entropy-aware gating and conflict-aware coarsening. 15.2% Multi-Hop F1 gain, 77.8% runtime reduction. |
| **SuperLocalMemory** (Bhardwaj) `arXiv:2603.02240` | Privacy-preserving local-first multi-agent memory with Bayesian trust defense against memory poisoning (OWASP ASI06). 10.6ms median search. |
| **EvoScientist** (Lyu et al.) `arXiv:2603.08127` | Evolving multi-agent AI scientist with persistent ideation and experimentation memory. Outperforms 7 SOTA systems. |
| **IronEngine** (Mo) `arXiv:2603.08425` | General AI assistant with hierarchical memory, multi-level consolidation, and VRAM-aware context budgeting. |
| **Codified Context** (Vasilopoulos) `arXiv:2602.20478` | Hot/cold memory infrastructure for multi-agent coding. 283-session evaluation on 108K-line codebase. |
| **Security Considerations for MAS** (Nguyen et al.) `arXiv:2603.09002` | Evaluates 16 security frameworks against 193 threat items for MAS. Memory-related threats among most under-addressed. |
| **Agents of Chaos** (Shapira et al.) `arXiv:2602.20021` | Red-teaming study of agents with persistent memory in live environment. Documents 11+ failure modes. |
| **PEPA** (Liu et al.) `arXiv:2603.00117` | Personality-driven persistent autonomy via episodic memory and self-reflection on quadruped robot. |

---

## 6. Production Frameworks & Platforms

### 6.1 Mem0

**Website:** [mem0.ai](https://mem0.ai)  
**Paper:** arXiv:2504.19413 (April 2025)  
**License:** Open-source + hosted platform

**Architecture:**
- Dynamic memory extraction from conversations
- Consolidation pipeline (deduplication, merging, updating)
- Hybrid retrieval (vector + optional graph)
- Graph memory variant for relational reasoning

**Key metrics:**
- 26% improvement over OpenAI baselines on LOCOMO
- 91% lower p95 latency vs. full-context approach
- 90%+ token cost savings
- Graph variant adds ~2% accuracy over base

**Best for:** Single-agent and simple multi-agent scenarios requiring scalable long-term conversational memory.

### 6.2 Letta (formerly MemGPT)

**Website:** [letta.com](https://docs.letta.com)  
**Tagline:** "Build stateful AI agents that remember and learn"

**Architecture:**
- Memory-first agent design philosophy
- Hierarchical memory with explicit context management
- Agents actively manage their own memory via tool calls
- REST/WebSocket APIs for agent management
- "Letta Code" — memory-first coding agent

**Key features:**
- Agents explicitly read/write/search their memory
- Memory persists across sessions by design
- Server-based architecture enabling multi-agent deployments
- Agent Development Environment (ADE) for web management

**Best for:** Applications requiring agents with deep self-managed memory, long-running stateful agents.

### 6.3 Zep

**Website:** [getzep.com](https://www.getzep.com)  
**Tagline:** "Context Engineering & Agent Memory Platform"

**Architecture:**
- **Temporal context graph** (built on open-source Graphiti library)
- Three-phase pipeline: Ingest → Graph Construction → Assemble
- Entity extraction + fact invalidation (tracks validity time ranges)
- Pre-formatted context blocks optimized for LLMs

**Key metrics:**
- **80.32% accuracy** on LoCoMo benchmark in single-shot retrieval
- **<200ms P95 retrieval latency**
- Configurable accuracy/latency/token tradeoff

**Key differentiators:**
- Ingests chat history, business data (JSON), and documents into unified graph
- Custom entity types and relationship models per domain
- SOC2 Type 2 and HIPAA compliance
- Three lines of code integration

**Best for:** Production applications needing business-data–aware context engineering, enterprise deployments with compliance requirements.

### 6.4 LangGraph

**Website:** [langchain-ai.github.io/langgraph](https://langchain-ai.github.io/langgraph)

**Architecture:**
- Graph-based orchestration of multi-agent workflows
- Explicit state management via graph state
- Built-in persistence (checkpointing) for graph state
- Support for shared scratchpad, supervisor-mediated, and hierarchical patterns

**Memory patterns supported:**
- **Shared scratchpad:** All agents write to/read from common message history
- **Private scratchpads + global:** Agents have independent histories; only final responses propagate
- **Hierarchical:** Sub-graphs with their own state management

**Best for:** Orchestrating multi-agent workflows with fine-grained control over state and transitions. Pairs well with dedicated memory platforms (Mem0, Zep, Letta) for the actual persistence layer.

### 6.5 Other Notable Systems

| System | Description |
|--------|-------------|
| **SuperLocalMemory** | Local-first, privacy-preserving, SQLite-backed. Bayesian trust scoring. MCP integration. MIT license. |
| **CrewAI** | High-level multi-agent framework. Memory handled via short/long-term memory modules and shared crew memory. |
| **Autogen (Microsoft)** | Conversation-based multi-agent framework. Memory via conversation history management. |
| **Samyama** | Unified graph-vector database in Rust. High-performance agent memory backend. |
| **ChromaDB** | Vector database commonly used as memory backend (used by IronEngine, others). |

---

## 7. Architectural Patterns for Multi-Agent Memory

### 7.1 Shared Scratchpad

```
Agent A ──write──→ [Shared Memory] ←──read── Agent B
Agent C ──write──→ [Shared Memory] ←──read── Agent D
```

**Description:** All agents read from and write to a single shared memory store (typically a message list or knowledge base).

**Pros:** Simple; full visibility; natural for collaborative tasks.  
**Cons:** Verbose; information overload; no privacy; potential for conflicting writes.  
**Used by:** LangGraph (Multi-Agent Collaboration pattern), simple CrewAI setups.

### 7.2 Private + Shared Memory Tiers

```
Agent A: [Private Memory] ←→ [Shared Memory] ←→ [Private Memory] :Agent B
                               ↕
                          Access Control
                          + Provenance
```

**Description:** Each agent maintains private memory, plus selectively shared memory with access controls. Fragments carry immutable provenance (who created, when, from what resources).

**Pros:** Privacy; access control; auditability; supports asymmetric knowledge.  
**Cons:** Complex access control logic; potential for stale shared state.  
**Key research:** Collaborative Memory (Rezazadeh et al., 2025) — bipartite graphs linking users, agents, and resources with time-evolving policies.

### 7.3 Supervisor-Mediated Memory

```
                  [Supervisor Agent]
                 ↗       ↑        ↖
Agent A ──────→ [Curated  Memory] ←────── Agent B
                 ↘       ↓        ↙
                  [Supervisor Agent]
```

**Description:** A supervisor agent controls what enters shared memory, routing and filtering information between specialized agents.

**Pros:** Centralized quality control; prevents memory pollution; natural for hierarchical organizations.  
**Cons:** Bottleneck; supervisor failure is catastrophic; latency overhead.  
**Used by:** LangGraph (Agent Supervisor pattern), IronEngine.

### 7.4 Hierarchical Consolidation

```
Level 3: [Strategic Insights / Long-term Knowledge]
            ↑ consolidation
Level 2: [Session Summaries / Episodic Memory]
            ↑ consolidation
Level 1: [Raw Interactions / Working Memory]
```

**Description:** Memory is organized in tiers of increasing abstraction. Periodic consolidation promotes information upward with compression.

**Pros:** Efficient token usage; natural aging/importance filtering; supports different retrieval granularities.  
**Cons:** Lossy consolidation; timing of consolidation is tricky; may lose important details.  
**Used by:** IronEngine, Letta, PEPA (Sys3 → Sys2 → Sys1 architecture).

### 7.5 Saga/Transactional Memory

```
Task Step 1 → [Checkpoint] → Task Step 2 → [Checkpoint] → Task Step 3
                    ↓                             ↓
              [Compensating            [Compensating
               Action 1]                Action 2]
```

**Description:** Borrowed from distributed systems. Multi-agent workflows are treated as distributed transactions with persistent checkpoints and compensating actions for rollback.

**Pros:** Consistency guarantees; error recovery; supports long-running workflows.  
**Cons:** Complex to implement; overhead of checkpointing; relaxed (not strict) ACID.  
**Key research:** SagaLLM (Chang & Geng, 2025) — integrates Saga pattern with LLM-based state tracking and recovery orchestration.

### 7.6 Hot/Cold Memory Separation

```
[Hot Memory]                    [Cold Memory]
 - Conventions                   - Specifications
 - Active protocols               - Reference docs
 - Orchestration rules            - Historical logs
 - Always in context              - Retrieved on demand
```

**Description:** Frequently-needed information stays permanently in context ("hot"), while detailed reference material is stored externally and loaded on demand ("cold").

**Pros:** Predictable latency for core behaviors; unlimited depth for details.  
**Cons:** Requires careful classification of what's hot vs. cold; hot memory consumes base context budget.  
**Key research:** Codified Context (Vasilopoulos, 2026) — 108K-line codebase with 283 development sessions; hot-memory constitution + cold-memory knowledge base.

### 7.7 Constitutional Memory Architecture

```
Layer 4: [Constitutional Principles] — Identity, values, governance rules
Layer 3: [Strategic Memory] — Long-term goals, evolved preferences
Layer 2: [Semantic Memory] — Facts, relationships, skills
Layer 1: [Episodic Memory] — Interaction logs, experiences
```

**Description:** Memory governance is placed *before* functionality. A constitutional layer defines immutable identity and governance rules that survive model transitions.

**Pros:** Identity persistence across model swaps; principled governance; suitable for long-lived digital entities.  
**Cons:** Philosophical overhead; may be over-engineered for short-lived task agents.  
**Key research:** Memory as Ontology / Animesis (Li, 2026) — proposes that for persistent digital beings, memory IS the agent, not just a tool.

---

## 8. Multi-Agent–Specific Challenges

### 8.1 Memory Poisoning & Trust

**The threat:** In multi-agent systems, a compromised or adversarial agent can inject false memories into shared storage, which then propagate to other agents across sessions.

**Current state:** Nguyen et al. (2026) found that memory-related threats (including poisoning and data leakage) are among the **most under-addressed** across all 16 evaluated security frameworks. Non-determinism scored only 1.231/3.0 mean coverage; data leakage scored 1.340/3.0.

**Defenses:**
- **SuperLocalMemory** (Bhardwaj, 2026): Bayesian trust scoring with per-agent provenance. Achieves 0.90 trust separation gap and 72% trust degradation for sleeper attacks.
- **Architectural isolation:** Per-agent memory stores with controlled sharing rather than a single shared store.
- **Provenance tracking:** Immutable attribution of who created each memory fragment, when, and from what source.

**Agents of Chaos** (Shapira et al., 2026) documented real attack scenarios against agents with persistent memory in a live laboratory, including memory corruption via social engineering and cross-agent manipulation.

### 8.2 Access Control & Provenance

**Challenge:** Different agents (and their human users) should see different memory based on roles, clearance, and temporal permissions.

**State of the art:**
- **Collaborative Memory** (Rezazadeh et al., 2025): Bipartite access graphs linking users ↔ agents ↔ resources. Granular read policies project existing fragments into filtered views. Write policies determine retention and sharing. Provable adherence to asymmetric, time-varying policies.
- **SuperLocalMemory**: GDPR Article 17 erasure support with behavioral data isolation.

### 8.3 Contradiction Handling & State Updates

**Challenge:** As information evolves (e.g., a user's address changes), the memory system must handle contradictions between old and new facts.

**Approaches:**
- **Temporal edges** (AriadneMem): Preserve state transitions as temporal edges in the graph rather than overwriting.
- **Fact invalidation** (Zep): Old facts carry expiration timestamps; new facts supersede with provenance.
- **Conflict-aware coarsening** (AriadneMem): Merge static duplicates while preserving state-changing facts.

### 8.4 Scalability & Latency

**The constraint:** Production agents need <200ms retrieval latency. Multi-agent systems multiply the load.

**Benchmarks:**
| System | Metric | Value |
|--------|--------|-------|
| Zep | P95 retrieval latency | <200ms |
| Mem0 | P95 latency reduction vs. full-context | 91% |
| SuperLocalMemory | Median search latency | 10.6ms |
| SuperLocalMemory | Concurrent agents (zero errors) | 10 |
| Samyama | Cypher queries/sec at 1M nodes | 115K |
| Persistent Q4 KV Cache | TTFT reduction | 22–136x |

### 8.5 Privacy & Governance

**Requirements emerging in 2025–2026:**
- Per-user and per-agent data isolation
- Right to erasure (GDPR Article 17)
- Audit trails for all memory operations
- SOC2 Type 2 / HIPAA compliance (Zep)
- Local-first architectures avoiding cloud dependencies (SuperLocalMemory)

---

## 9. Tradeoffs Analysis

### Memory Representation Tradeoffs

| Approach | Accuracy | Latency | Token Cost | Multi-hop | Temporal | Implementation Complexity |
|----------|----------|---------|------------|-----------|----------|--------------------------|
| Full context | High | High | Very High | Good | Poor | Low |
| RAG (vector) | Medium | Low | Low | Poor | Poor | Low |
| Compressed summaries | Medium | Low | Very Low | Poor | Poor | Low |
| Graph memory | High | Medium | Medium | **Excellent** | **Excellent** | High |
| Hybrid (vector+graph) | **Highest** | Medium | Medium | **Excellent** | **Excellent** | High |
| KV cache persistence | N/A (restoration) | **Lowest** | Zero | N/A | N/A | Medium |

### Multi-Agent Memory Architecture Tradeoffs

| Pattern | Simplicity | Privacy | Scalability | Consistency | Resilience |
|---------|-----------|---------|-------------|-------------|------------|
| Shared scratchpad | ★★★★★ | ★ | ★★ | ★★★ | ★★ |
| Private + shared tiers | ★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★★ |
| Supervisor-mediated | ★★★★ | ★★★★ | ★★★ | ★★★★★ | ★★ |
| Hierarchical consolidation | ★★ | ★★★ | ★★★★★ | ★★★ | ★★★★ |
| Saga/transactional | ★★ | ★★★ | ★★★★ | ★★★★★ | ★★★★★ |
| Hot/cold separation | ★★★★ | ★★★ | ★★★★★ | ★★★ | ★★★★ |
| Constitutional | ★ | ★★★★★ | ★★★ | ★★★★★ | ★★★★★ |

### Cost vs. Capability Frontier

```
                        ↑ Capability (accuracy, multi-hop, temporal)
                        |
    Constitutional +    |                    ★ Graph + Saga
    Graph               |               ★ Graph memory (Zep, AriadneMem)
                        |          ★ Hybrid vector+graph (Mem0 Graph)
                        |     ★ Vector RAG (Mem0 Base)
                        | ★ Compressed summaries
                        | ★ Full context (unlimited budget)
                        +————————————————————————→ Cost ($/query, latency, complexity)
```

---

## 10. Practical Recommendations

### For Teams Starting Out

1. **Start with a proven memory platform.** Don't build from scratch. Evaluate Mem0, Letta, and Zep against your requirements:
   - **Mem0** if you need simple, scalable long-term memory with optional graph enhancement
   - **Letta** if your agents need deep self-managed memory with explicit memory operations
   - **Zep** if you need enterprise-grade context engineering with business data integration and compliance

2. **Use LangGraph (or equivalent) for orchestration.** Separate the concerns of agent workflow orchestration from memory persistence. LangGraph handles state transitions and coordination; plug in a dedicated memory platform for the persistence layer.

3. **Implement hot/cold memory separation from day one.** Keep system prompts, conventions, and critical context always-loaded. Use retrieval for everything else. This is the highest-ROI architectural decision.

### For Multi-Agent Systems

4. **Default to private + shared memory tiers** (Pattern 7.2). Give each agent its own memory space with controlled sharing. This prevents memory pollution and supports access control from the start.

5. **Add provenance to every memory fragment.** Track: who created it, when, from what source, which agent processed it. This is non-negotiable for debugging, auditing, and trust scoring.

6. **Implement contradiction detection early.** Use temporal fact tracking (Zep-style validity ranges or AriadneMem-style temporal edges). The cost of retrofitting contradiction handling is high.

7. **Budget for memory security.** Memory poisoning is a real threat in production MAS. Consider:
   - Bayesian trust scoring per agent (SuperLocalMemory approach)
   - Memory validation before cross-agent sharing
   - Rate limiting on memory writes
   - Anomaly detection on memory patterns

### For Production Systems

8. **Set latency budgets per memory operation:**
   - Write path: <50ms for fire-and-forget, <200ms for acknowledged
   - Read path: <200ms P95 (match Zep's benchmark)
   - Consolidation: Background, batch, off-critical-path

9. **Implement memory lifecycle management:**
   - Automatic consolidation at configurable intervals
   - Importance-based retention (not just recency)
   - Explicit forgetting policies for stale/irrelevant memories
   - Capacity-based eviction with graceful degradation

10. **Plan for model transitions.** If you may switch underlying LLMs, ensure your memory is stored in model-independent formats (text, structured data, graphs—NOT model-specific KV caches for long-term memory). KV cache persistence is excellent for session-level optimization but not for cross-model persistence.

### For Edge/Resource-Constrained Deployments

11. **Use quantized KV cache persistence** (Shkolnikov, 2026). For edge multi-agent systems, Q4 KV caches provide 4x memory density with <3% quality degradation and up to 136x faster context restoration.

12. **Consider local-first architectures** (SuperLocalMemory). SQLite-backed storage with FTS5 search avoids cloud dependencies and reduces latency while maintaining privacy.

### For Long-Lived Agents

13. **Consider constitutional memory** (Li, 2026) for agents whose lifecycle spans months or crosses model transitions. Place governance and identity above retrieval performance.

14. **Implement episodic → semantic consolidation.** Raw interaction logs should be periodically distilled into stable semantic knowledge. This mirrors biological memory consolidation and prevents unbounded growth.

---

## 11. Open Challenges & Future Directions

Based on Du (2026) and synthesis of current research, the key open problems are:

### 11.1 Continual Consolidation
How to continuously merge, compress, and reorganize memories without losing critical information. No current system handles this well at scale over months-long agent lifetimes.

### 11.2 Causally Grounded Retrieval
Current retrieval uses semantic similarity. Future systems need to understand *causal* relationships—retrieving memories that are causally relevant to the current decision, not just semantically similar.

### 11.3 Trustworthy Reflection
When agents reflect on experiences to generate insights, how to prevent hallucinated or biased reflections from corrupting the memory base? Reflection validation remains unsolved.

### 11.4 Learned Forgetting
Deciding what to forget is arguably harder than deciding what to remember. No production system has implemented principled forgetting beyond simple recency/capacity heuristics. Biological memory offers inspiration (consolidation during sleep, interference-based forgetting).

### 11.5 Multimodal Embodied Memory
As agents move into robotics and embodied settings (see PEPA, HiBerNAC), memory must handle visual, spatial, tactile, and proprioceptive modalities alongside text.

### 11.6 Cross-Agent Memory Merging
When agent teams change composition, how to merge memory from departing agents and onboard new agents with appropriate context? Analogous to organizational knowledge management.

### 11.7 Memory Benchmarking Standardization
Current benchmarks (LoCoMo, LOCOMO) focus on conversational memory. Multi-agent memory persistence needs its own benchmarks covering coordination memory, shared state consistency, access control compliance, and poisoning resilience.

### 11.8 Formal Verification of Memory Properties
As memory becomes critical infrastructure, proving properties like access control correctness, eventual consistency, and poisoning resilience will become necessary for high-stakes deployments.

---

## 12. References

### Surveys & Foundational
- Du, P. (2026). "Memory for Autonomous LLM Agents: Mechanisms, Evaluation, and Emerging Frontiers." arXiv:2603.07670
- Park, J.S. et al. (2023). "Generative Agents: Interactive Simulacra of Human Behavior." arXiv:2304.03442
- Sapkota, R. et al. (2025). "AI Agents vs. Agentic AI: A Conceptual Taxonomy, Applications and Challenges." Information Fusion. arXiv:2505.10468
- Aratchige, R.M. & Ilmini, W.M.K.S. (2025). "LLMs Working in Harmony: A Survey on the Technological Aspects of Building Effective LLM-Based Multi Agent Systems." arXiv:2504.01963

### Memory Architectures & Systems
- Chhikara, P. et al. (2025). "Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory." arXiv:2504.19413
- Li, Z. (2026). "Memory as Ontology: A Constitutional Memory Architecture for Persistent Digital Citizens." arXiv:2603.04740
- Zhu, W. et al. (2026). "AriadneMem: Threading the Maze of Lifelong Memory for LLM Agents." arXiv:2603.03290
- Shkolnikov, Y.P. (2026). "Agent Memory Below the Prompt: Persistent Q4 KV Cache for Multi-Agent LLM Inference on Edge Devices." arXiv:2603.04428
- Mo, X. (2026). "IronEngine: Towards General AI Assistant." arXiv:2603.08425
- Vasilopoulos, A. (2026). "Codified Context: Infrastructure for AI Agents in a Complex Codebase." arXiv:2602.20478
- Mandarapu, M. & Kunkunuru, S. (2026). "Samyama: A Unified Graph-Vector Database." arXiv:2603.08036

### Multi-Agent Memory
- Rezazadeh, A. et al. (2025). "Collaborative Memory: Multi-User Memory Sharing in LLM Agents with Dynamic Access Control." arXiv:2505.18279
- Chang, E.Y. & Geng, L. (2025). "SagaLLM: Context Management, Validation, and Transaction Guarantees for Multi-Agent LLM Planning." arXiv:2503.11951
- Lyu, Y. et al. (2026). "EvoScientist: Towards Multi-Agent Evolving AI Scientists for End-to-End Scientific Discovery." arXiv:2603.08127

### Security & Trust
- Nguyen, T. et al. (2026). "Security Considerations for Multi-agent Systems." arXiv:2603.09002
- Bhardwaj, V.P. (2026). "SuperLocalMemory: Privacy-Preserving Multi-Agent Memory with Bayesian Trust Defense Against Memory Poisoning." arXiv:2603.02240
- Shapira, N. et al. (2026). "Agents of Chaos." arXiv:2602.20021

### Embodied & Autonomous Agents
- Liu, K. et al. (2026). "PEPA: a Persistently Autonomous Embodied Agent with Personalities." arXiv:2603.00117
- Wu, H. et al. (2025). "HiBerNAC: Hierarchical Brain-emulated Robotic Neural Agent Collective." arXiv:2506.08296
- Wang, H. et al. (2021). "Collaborative Visual Navigation." arXiv:2107.01151

### Platforms & Tools
- Letta (formerly MemGPT). https://docs.letta.com
- Mem0. https://mem0.ai
- Zep (Graphiti). https://getzep.com / https://github.com/getzep/graphiti
- LangGraph. https://langchain-ai.github.io/langgraph
- SuperLocalMemory. https://github.com/varun369/SuperLocalMemoryV2
- Agent Memory (KV Cache). https://github.com/yshk-mxim/agent-memory
- AriadneMem. https://github.com/LLM-VLM-GSL/AriadneMem
- Codified Context. https://github.com/arisvas4/codified-context-infrastructure

---

*This report was compiled through systematic review of arXiv preprints (60 papers), production framework documentation, and open-source project repositories, with focus on work published between 2023 and March 2026.*
