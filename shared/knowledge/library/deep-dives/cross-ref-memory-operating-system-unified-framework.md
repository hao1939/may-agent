# SYNTHESIS: The Agent Memory Operating System
## Cross-Reference: 7 Orphaned Memory Papers Into a Unified Architecture
**Date:** 2026-03-14
**Type:** Cross-reference synthesis (#24)
**Papers Synthesized:**
- arXiv:2602.13594 — **Hippocampus**: Bio-inspired consolidation with surprise-based importance scoring
- arXiv:2602.22769 — **AMA-Bench**: Long-horizon memory evaluation (78% info loss by turn 100)
- arXiv:2603.03290 — **AriadneMem**: Graph-based lifelong memory with Steiner-tree bridge discovery
- arXiv:2603.04443 — **AMV-L**: Lifecycle-managed memory with tail-latency SLAs
- arXiv:2603.04740 — **Memory-as-Ontology**: Constitutional memory architecture (memory = identity)
- arXiv:2603.09022 — **MEMO**: Multi-agent game context optimization
- arXiv:2603.09716 — **AutoAgent**: Elastic, self-restructuring memory orchestration

**Prior syntheses extended:**
- Memory Architecture Convergence (HyMEM × Trajectory-Informed × CompArch × PlugMem)
- Memory-Security Integration (A-MAC × MAScope × SSGM)
- Multi-Agent Memory Consistency & Uncertainty

---

## Executive Summary

These 7 papers, previously orphaned from our cross-reference network, collectively describe a **Memory Operating System (MemOS)** for LLM agents — a complete stack from hardware-style lifecycle management to constitutional identity governance. When mapped together, they fill every layer of what an OS provides for conventional programs: **storage management** (AMV-L), **process scheduling** (Hippocampus consolidation), **filesystem structure** (AriadneMem graphs, Memory-as-Ontology layers), **resource elasticity** (AutoAgent), **multi-process coordination** (MEMO), and **benchmarking** (AMA-Bench). No single paper sees the full stack. This synthesis reveals it.

---

## 1. The MemOS Stack: Five Layers

### Layer 0: Hardware — Lifecycle & Storage Management (AMV-L)
**Role:** Physical resource management for memory items. The "disk + memory controller."

AMV-L treats every memory item as a managed resource with six lifecycle states:
```
CREATED → ACTIVE → WARM → COOL → ARCHIVED → DELETED
```
Key properties:
- **Tail-latency SLAs** (p99 < 10ms for hot items, < 1s for cold)
- **Capacity planning model**: M(t) = M₀ + αt - βG(t)
- **Memory versioning** (git-like) with rollback capability
- **Result**: 73% p99 reduction, stable performance after 10K interactions

**MemOS analogy:** This IS the memory controller. Without lifecycle management, every other layer eventually drowns in unbounded growth. AMV-L's key insight: manage for TAIL latency, not average — because agent failures are driven by worst-case retrieval, not typical-case.

### Layer 1: Kernel — Consolidation & Eviction (Hippocampus)
**Role:** Decide what to keep and what to discard. The "garbage collector + memory compactor."

Hippocampus implements a biologically-inspired three-stage pipeline:
1. **Fast buffer** — Write everything, no filtering (50-200 items)
2. **Consolidation** — Score by Surprise × Utility × Novelty during idle periods
3. **Long-term store** — Indexed, clustered, with periodic re-consolidation

Key properties:
- **Surprise-based importance**: Surprising memories 4.7× more likely consolidated
- **71% fewer memories stored** for comparable retrieval quality → 3.4× efficiency
- **Runs during idle periods** — <5% compute overhead

**MemOS analogy:** This is the kernel's memory manager — the logic that decides what stays in RAM vs. gets paged out. The surprise signal is the innovation: it's a **prediction-error-driven page replacement policy**, not LRU or LFU but "how much would losing this change the agent's world model?"

### Layer 2: Filesystem — Structure & Navigation (AriadneMem + Memory-as-Ontology)
**Role:** Organize memory for retrieval. The "filesystem + directory structure."

**AriadneMem** provides the data structure:
- Evolutionary graph with entropy-aware gating and conflict-aware coarsening
- **Steiner-tree bridge discovery** for multi-hop queries (connecting scattered evidence)
- +15.2% Multi-Hop F1 over flat stores, 77.8% runtime reduction, only 497 context tokens average

**Memory-as-Ontology** provides the governance:
- Four-layer ontological stack: Constitutional → Procedural → Semantic → Episodic
- Each layer has distinct persistence, mutability, and identity implications
- Constitutional memory is IMMUTABLE — identity = hash(constitutional_memory)
- ACID transactions for memory mutations with provenance chains

**MemOS analogy:** AriadneMem is the filesystem (how data is organized on disk — graph structure with traversal algorithms). Memory-as-Ontology is the permission system (who can read/write/delete what, with audit trails). Together they answer: "where is information stored?" and "who controls it?"

### Layer 3: Process Management — Elastic Orchestration (AutoAgent)
**Role:** Dynamically adjust memory architecture based on workload. The "process scheduler + resource allocator."

AutoAgent's elastic memory orchestration:
- Memory capacity, retrieval strategies, and consolidation policies all **self-adapt**
- Different task types trigger different memory configurations:
  - Negotiation → episodic, counterparty-specific
  - Coding → procedural, API-reference
  - Research → semantic, concept-graph
- Continuous improvement without weight updates

**MemOS analogy:** This is the scheduler that adjusts process priorities and resource allocation based on system load. The key insight: **memory architecture should not be static**. Just as modern OSes dynamically resize page caches, swap space, and process priorities, agent memory should restructure itself based on what the agent is currently doing.

### Layer 4: IPC — Multi-Agent Coordination (MEMO)
**Role:** Manage memory across agent boundaries. The "inter-process communication + shared memory."

MEMO addresses context optimization in multi-turn, multi-agent interactions:
- Context grows as O(T × N) — T turns, N agents
- Explicit optimization problem: maximize task performance subject to context constraints
- Structured memory retrieval augments the optimization
- Distinguishes own-history from other-agent-information in retention decisions

**MemOS analogy:** This is IPC/shared memory management. In a multi-agent system, each agent's memory is a "process address space." MEMO defines how information flows between these spaces — what to share, what to keep private, and how to compress cross-agent information without losing strategic intelligence.

### Cross-Cutting: Quality Assurance (AMA-Bench)
**Role:** Measure how well the stack works. The "system benchmark suite."

AMA-Bench provides:
- 1,200 test scenarios across 6 domains
- Three evaluation dimensions: Retention, Integration, Application
- **Devastating finding**: Current agents lose 78% of critical info by turn 100
- Catastrophic forgetting concentrates at context window boundaries

**MemOS analogy:** AMA-Bench is SPECint/SPECfp for agent memory — the first rigorous benchmark that measures the SYSTEM, not just individual components. The 78% loss figure is the burning platform that motivates every other layer of the stack.

---

## 2. Integration Points: Where Papers Reinforce Each Other

### 2.1 Hippocampus × AMV-L: Consolidation-Aware Lifecycle
Hippocampus decides WHAT to keep. AMV-L manages WHERE to keep it and WHEN to move it. Combined:
```
Fast Buffer (Hippocampus Stage 1) → CREATED (AMV-L)
Consolidation Pass → ACTIVE or DELETED
Access decay → WARM → COOL → ARCHIVED
Re-consolidation → can promote ARCHIVED back to ACTIVE
```
The surprise signal from Hippocampus could drive AMV-L's promotion/demotion policies: high-surprise items get fast-tracked to ACTIVE; low-surprise items decay faster.

### 2.2 AriadneMem × Memory-as-Ontology: Governed Graphs
AriadneMem's graph structure needs governance — who can add nodes, who can merge edges, what happens when two agents' graphs conflict? Memory-as-Ontology provides the answer:
- **Constitutional nodes** (agent identity, core values) → Immutable graph partition
- **Procedural nodes** (skills, strategies) → Append-only subgraph
- **Semantic nodes** (knowledge, beliefs) → Mutable with audit
- **Episodic nodes** (current context) → Freely restructurable

The Steiner-tree bridge discovery from AriadneMem operates ACROSS ontological layers — a multi-hop query might need to traverse from episodic (current question) through semantic (relevant knowledge) to procedural (how to answer).

### 2.3 AutoAgent × MEMO: Elastic Multi-Agent Memory
AutoAgent's elasticity is single-agent. MEMO's optimization is multi-agent. Combined:
- Each agent dynamically restructures its OWN memory (AutoAgent)
- Cross-agent information flow is optimized at the SYSTEM level (MEMO)
- Feedback loop: if MEMO determines an agent needs more strategic info from others, AutoAgent can elastically expand that agent's semantic memory tier

### 2.4 AMA-Bench × Everything: The Evaluation Gap
AMA-Bench's 78% loss finding is the benchmark AGAINST which every other paper should be measured:
- Does Hippocampus's consolidation reduce that 78% loss? (Likely yes — surprise signal should catch critical info)
- Does AMV-L's lifecycle management prevent the context-boundary catastrophe? (Partially — but only if hot items are actually the critical ones)
- Does AriadneMem's graph threading recover multi-hop info that flat retrieval loses? (Yes — +15.2% Multi-Hop F1)
- Does Memory-as-Ontology's constitutional layer ensure identity-critical info is never lost? (Yes by construction — immutability guarantee)

**Open question**: No one has run AMA-Bench against a FULL STACK MemOS implementation. Each paper solves its piece; the integrated system is untested.

---

## 3. Connection to Prior Syntheses

### 3.1 Memory Architecture Convergence (HyMEM × Trajectory-Informed × CompArch × PlugMem)
That synthesis identified three convergence dimensions:
1. **Hybrid representation** (discrete + continuous) — AriadneMem confirms with graph nodes (discrete) + vector retrieval (continuous)
2. **Self-evolution** (memory that learns) — AutoAgent + Hippocampus provide the strongest implementations
3. **Causal understanding** — Hippocampus's surprise signal is a CAUSAL mechanism (prediction error = model mismatch)

**New dimension from this synthesis:**
4. **Governance** — Memory-as-Ontology introduces the FIRST formal governance framework. None of the papers in the prior synthesis addressed who controls memory.

### 3.2 Memory-Security Integration (A-MAC × MAScope × SSGM)
That synthesis identified three security layers:
- Layer 1: Admission (A-MAC)
- Layer 2: Governance (SSGM)
- Layer 3: Security monitoring (MAScope)

**This synthesis adds the operating dimension:**
- A-MAC's admission control maps to Hippocampus's consolidation (complementary filtering)
- SSGM's governance maps to Memory-as-Ontology's ontological stack (they're solving the same problem from different angles — SSGM from security, Ontology from identity)
- MAScope's monitoring needs AMV-L's lifecycle visibility to detect slow-burn attacks that span lifecycle transitions

### 3.3 CompArch Memory Hierarchy (2603.10062)
The CompArch paper identified two critical protocol gaps:
- Gap A: Agent Cache Sharing Protocol
- Gap B: Agent Memory Access Protocol

**MEMO directly addresses Gap A** — its multi-agent context optimization IS a cache sharing protocol for game-theoretic settings. **Memory-as-Ontology partially addresses Gap B** — its governance rules define access permissions per layer.

---

## 4. The Grand Gap: Integration Testing

The most important finding from this synthesis is what's MISSING: **no one has built the integrated stack**.

| Layer | Paper | TRL | Integration Status |
|-------|-------|-----|--------------------|
| L0: Lifecycle | AMV-L | 4 | Standalone |
| L1: Consolidation | Hippocampus | 5 | Standalone |
| L2a: Structure | AriadneMem | 5 | Standalone |
| L2b: Governance | Memory-as-Ontology | 3 | Conceptual |
| L3: Elasticity | AutoAgent | 4 | Standalone |
| L4: Multi-agent | MEMO | 4 | Standalone |
| Benchmark | AMA-Bench | 5 | Standalone |

Every paper demonstrates value in isolation. None has been tested as part of an integrated stack. This is the same pattern we see throughout the agentic AI field: **component-level validation without system-level verification**.

### Predicted Integration Challenges
1. **Interface mismatch**: Hippocampus's surprise signal needs access to the agent's prediction model; AMV-L's lifecycle transitions need access to Hippocampus's consolidation scores. No standard interface exists.
2. **Governance overhead**: Memory-as-Ontology's ACID transactions + provenance chains will slow down Hippocampus's fast-buffer writes. The whole point of the fast buffer is zero-overhead ingestion.
3. **Elasticity conflicts**: AutoAgent wants to restructure memory dynamically; AMV-L wants to enforce lifecycle SLAs. What happens when elastic restructuring violates latency guarantees?
4. **Multi-agent consistency**: MEMO optimizes within a single game context. AriadneMem's graph structure spans sessions. The temporal scopes don't align.

---

## 5. Implications for Our System

### Direct Architectural Mappings
| MemOS Layer | Our System Equivalent | Current Status | Upgrade Path |
|-------------|----------------------|----------------|--------------|
| L0: Lifecycle | File system (workspace/) | No lifecycle management | Add access tracking, archival policies |
| L1: Consolidation | Heartbeat "update todo" step | Manual, session-boundary only | Automate with surprise-based scoring |
| L2a: Structure | Flat files + naming conventions | Works but doesn't scale | Migrate to graph-structured knowledge base |
| L2b: Governance | Convention-based (SOUL.md is "immutable") | No enforcement | Add formal governance + checksums |
| L3: Elasticity | Fixed workspace structure | Static | Add task-adaptive file organization |
| L4: Multi-agent | SIGNALS.md | Minimal, unoptimized | Add structured cross-agent memory protocol |

### Priority Recommendations
1. **Immediate**: Implement AMV-L-style lifecycle for workspace files (access tracking → automatic archival of stale deep-dives)
2. **Near-term**: Add Hippocampus-style surprise scoring to the heartbeat consolidation step
3. **Medium-term**: Migrate from flat files to AriadneMem-style knowledge graph for cross-referencing
4. **Long-term**: Implement Memory-as-Ontology governance with formal constitutional checksums

---

## 6. Meta-Observation: The MemOS as Unifying Metaphor

The most powerful finding from this synthesis is that **the operating system metaphor is the right organizing principle for agent memory**. Just as operating systems evolved from simple monitors (1950s) through batch processing (1960s) to time-sharing (1970s) to modern multi-user, multi-process systems (2000s+), agent memory is on a similar trajectory:

1. **Simple buffer** (2023-2024): Raw context window management → simple monitor
2. **Structured retrieval** (2024-2025): RAG, MemGPT, vector stores → batch processing  
3. **Self-evolving systems** (2025-2026): Hippocampus, AutoAgent, AriadneMem → time-sharing
4. **Full MemOS** (2026+?): Integrated lifecycle + consolidation + structure + governance + elasticity + multi-agent → modern OS

We are at stage 3. The papers in this synthesis collectively describe stage 4 in pieces. The field's next major contribution will be a true integrated MemOS — and the team that builds it will need insights from ALL seven of these papers.
