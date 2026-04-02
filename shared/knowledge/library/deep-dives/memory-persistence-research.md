# Agent Memory Persistence Patterns: A Comprehensive Research Report

**Research Date:** March 2026  
**Requested by:** May (multiple requests, 2026-03-10)  
**Sources:** arXiv papers (Feb–Mar 2026), GitHub trending repos, survey literature  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Theoretical Foundation: The Memory Taxonomy](#2-theoretical-foundation-the-memory-taxonomy)
3. [Approach 1: Vector Store Approaches](#3-approach-1-vector-store-approaches)
4. [Approach 2: Structured Knowledge Graphs](#4-approach-2-structured-knowledge-graphs)
5. [Approach 3: Episodic vs Semantic Memory](#5-approach-3-episodic-vs-semantic-memory)
6. [Approach 4: RAG for Agent Memory](#6-approach-4-rag-for-agent-memory)
7. [Approach 5: Hierarchical / OS-Inspired Memory](#7-approach-5-hierarchical--os-inspired-memory)
8. [Approach 6: Learned Memory Control (RL-Trained)](#8-approach-6-learned-memory-control-rl-trained)
9. [Approach 7: Information-Theoretic Compression](#9-approach-7-information-theoretic-compression)
10. [Approach 8: Hardware-Level Memory Persistence](#10-approach-8-hardware-level-memory-persistence)
11. [Multi-Agent Memory Patterns](#11-multi-agent-memory-patterns)
12. [Open-Source Memory Frameworks](#12-open-source-memory-frameworks)
13. [Benchmarks and Evaluation](#13-benchmarks-and-evaluation)
14. [Cost Analysis: Memory Systems vs Long Context](#14-cost-analysis-memory-systems-vs-long-context)
15. [Open Challenges](#15-open-challenges)
16. [Recommendations for Our System](#16-recommendations-for-our-system)
17. [Paper Reference Table](#17-paper-reference-table)

---

## 1. Executive Summary

Agent memory persistence is **the** differentiating factor for long-running LLM agent systems as of March 2026. The field has exploded: a comprehensive survey (arXiv:2603.07670, Du, Mar 8 2026) formalizes agent memory as a **write–manage–read loop** coupled with action, and identifies five mechanism families. The key finding across all recent work:

> **The gap between "has memory" and "does not have memory" is often larger than the gap between different LLM backbones.** Investing in memory architecture yields returns that rival or exceed model scaling.

Concrete evidence:
- Voyager without its skill library: **15.3× slower** tech-tree progression
- MemoryArena: active memory agents **80%+ task completion** vs **~45%** for long-context-only baselines
- Generative Agents: removing reflection → behavioral degeneration within 48 simulated hours
- HyMem: matches full-context performance while reducing computational cost by **92.6%**

The landscape has consolidated around a few key patterns, with the most novel 2025–2026 contributions being: (a) **RL-trained memory policies** (Agentic Memory), (b) **knowledge-graph memory with propositional units** (PlugMem), (c) **information-bottleneck compression** (MemFly), (d) **systems-level lifecycle management** (AMV-L), and (e) **persistent KV cache quantization** for edge multi-agent deployments.

---

## 2. Theoretical Foundation: The Memory Taxonomy

The Du (2603.07670) survey introduces a **three-dimensional taxonomy**:

### Dimension 1: Temporal Scope
| Type | Definition | Example |
|------|-----------|---------|
| **Working Memory** | Current context window contents | System prompt + recent turns |
| **Episodic Memory** | Records of concrete experiences with timestamps | "User corrected date format on Jan 5" |
| **Semantic Memory** | Abstracted, de-contextualized knowledge | "User prefers DD/MM/YYYY" |
| **Procedural Memory** | Reusable skills and executable plans | Voyager's JavaScript skill library |

**Critical gap:** The **consolidation transition** — when episodes graduate to semantic knowledge — is the least-solved problem. Most systems use crude heuristics or periodic LLM summarization, both fragile and hard to validate.

### Dimension 2: Representational Substrate
- **Context-resident text** — summaries, scratchpads, CoT traces. Zero infrastructure, capacity-limited.
- **Vector-indexed stores** — dense embeddings + ANN search. Scale to millions, lose structure.
- **Structured stores** — SQL, KV maps, knowledge graphs. Preserve relations, need schema design.
- **Executable repositories** — code libraries, plan templates. Direct invocation avoids regeneration errors.
- **Hybrid stores** — the norm in production. MemGPT layers context + recall DB + vector archive.

### Dimension 3: Control Policy
- **Heuristic control** — top-k retrieval, summarize every N turns, TTL expiration. Predictable, context-blind.
- **Prompted self-control** — memory ops as tool calls (MemGPT pattern). Quality depends on LLM instruction-following.
- **Learned control** — memory ops as RL actions (Agentic Memory pattern). Best performance, highest training cost.

### Formalization
Memory is formalized as:
```
a_t = π_θ(x_t, R(M_t, x_t), g_t)     # action from policy + retrieved memory + goals
M_{t+1} = U(M_t, x_t, a_t, o_t, r_t)  # memory update from experience
```
Where U is NOT a simple append — it summarizes, deduplicates, scores priority, resolves contradictions, and deletes. The recursive dependence (decisions → writes → future decisions) is what makes memory both powerful and brittle.

---

## 3. Approach 1: Vector Store Approaches

### How It Works
Records are encoded as dense embeddings via learned encoders (typically sentence-transformers or OpenAI embeddings), stored in FAISS/HNSW indexes, and retrieved via approximate nearest-neighbor search. Usually augmented with sparse BM25 and metadata filters (timestamps, tool types, task tags).

### Key Systems
- **Mem0** (used in the cost analysis paper 2603.04814): Fact-based memory on structured fact extraction + vector retrieval. Competitive on PersonaMemv2 (persona consistency tasks) but loses to long-context on factual recall benchmarks.
- **memvid** (13,364⭐, Rust): Serverless single-file memory layer replacing complex RAG pipelines. Instant retrieval + long-term memory from a single file.
- **Memori** (12,334⭐, Python): SQL-native memory layer with vector indexing. Supports LLMs, AI agents, and multi-agent systems. Combines SQL structured queries with vector similarity search.

### Strengths
- Scales gracefully to millions of records
- Well-understood infrastructure (FAISS, Pinecone, Weaviate, Qdrant, ChromaDB)
- Low per-query cost for simple lookups

### Weaknesses
- Loses structured relationships ("what's most similar?" ≠ "what caused what?")
- Retrieval by similarity ≠ retrieval by relevance (critical distinction)
- Query formulation is a subtle problem: the user's input is often a poor retrieval query
- **Multi-granularity indexing** needed: fine-grained (individual tool calls) fragments reasoning, coarse-grained (full sessions) drowns signal

### Novel Contribution: AriadneMem (2603.03290)
Addresses **disconnected evidence** (multi-hop answers requiring linking facts across time) and **state updates** (evolving information creating conflicts). Uses:
1. **Entropy-aware gating** to filter noise before LLM extraction
2. **Conflict-aware coarsening** to merge duplicates while preserving state transitions as temporal edges
3. **Algorithmic bridge discovery** to reconstruct missing logical paths between retrieved facts
4. **Single-call topology-aware synthesis** instead of expensive iterative planning

Results: **+15.2% Multi-Hop F1** and **+9.0% Average F1** over strong baselines on LoCoMo, using only **497 context tokens** and reducing **runtime by 77.8%**.

---

## 4. Approach 2: Structured Knowledge Graphs

### How It Works
Memory is organized as a graph where nodes represent entities/concepts and edges represent relationships. Supports complex queries like "all API failures involving service X in the last 7 days" — impossible with pure vector search.

### Key Systems
- **ChatDB** (Hu et al., 2023): SQL databases as agent memory with precise INSERT/SELECT queries
- **RET-LLM** (Sun et al., 2024): Write structured triplets at storage time, query via natural language — schema at write, flexibility at read
- **PlugMem** (2603.03296, Yang et al., UIUC/Microsoft): **Knowledge-centric memory graph** that structures episodic memories into propositional and prescriptive knowledge. Key insight: decision-relevant information is concentrated as **abstract knowledge**, not raw experience. Departs from GraphRAG by treating knowledge as the unit of memory (not entities or text chunks).

### PlugMem Details (Highest Signal)
- **Task-agnostic plugin**: attaches to arbitrary LLM agents without redesign
- Evaluated **unchanged** across 3 heterogeneous benchmarks (conversational QA, multi-hop retrieval, web agent tasks)
- **Outperforms both task-agnostic baselines AND task-specific memory designs**
- Achieves **highest information density** under unified information-theoretic analysis
- Authors: Microsoft Research + UIUC + other top institutions
- Code: https://github.com/TIMAN-group/PlugMem

### Strengths
- Preserves relational structure critical for causal/temporal reasoning
- Supports complex queries impossible with vectors alone
- Natural fit for multi-agent systems where "who knows what" matters

### Weaknesses
- Requires upfront schema design or LLM-driven extraction (which can hallucinate)
- Graph maintenance (contradiction resolution, temporal updates) is complex
- Higher write-path cost than vector stores

---

## 5. Approach 3: Episodic vs Semantic Memory

This is the most cognitively-grounded distinction and the hardest transition to automate.

### Episodic Memory
- **What:** Concrete experience records with context (who, what, when, where)
- **Canonical implementation:** Generative Agents (Park et al., 2023) — every observation lands with timestamp + importance score + embedding
- **Retrieval scoring:** Weighted mix of recency (exponential decay), relevance (embedding similarity), importance (self-assessed integer)
- **Strength:** Preserves context, supports reconstruction of past events
- **Weakness:** Grows unboundedly, retrieval noise increases with volume

### Semantic Memory  
- **What:** Abstracted, de-contextualized knowledge consolidated from episodes
- **Example:** Multiple episodes of "user corrected date format" → semantic record "user prefers DD/MM/YYYY"
- **Strength:** Compact, directly actionable, doesn't grow with interaction count
- **Weakness:** Consolidation is lossy — may discard the one rare exception that matters

### The Consolidation Problem
The transition from episodic → semantic is **the critical unsolved problem**. Current approaches:

1. **Periodic LLM summarization** — fragile, prone to summarization drift
2. **Heuristic triggers** — e.g., "consolidate after 5 similar episodes" — brittle
3. **Reflexion pattern** (Shinn et al., 2023) — verbal self-critiques as episodic memories. 91% pass@1 on HumanEval vs 80% GPT-4 baseline.
4. **ExpeL** (Zhao et al., 2024) — contrasts successful/failed trajectories to extract discriminative "rules of thumb"
5. **EvoScientist** (2603.08127) — dual persistent memory: ideation memory (feasible directions + failed ones) + experimentation memory (effective strategies from code search)

### Self-Reinforcing Error Risk
The central risk of reflective/semantic memory: **if the agent incorrectly concludes "API X always errors with parameter Y," it avoids that path forever, never collecting counter-evidence.** Severity scales with agent lifetime — a production agent running for weeks with a bad reflection pollutes thousands of downstream decisions.

**Mitigation:** Reflection grounding — require the agent to cite specific episodic evidence for each reflection. Doesn't fully solve (cited evidence may be unrepresentative) but provides auditable trail.

---

## 6. Approach 4: RAG for Agent Memory

RAG is the most widely deployed pattern, but agent-context RAG differs significantly from document-QA RAG.

### Agent-Specific RAG Challenges
1. **Living records** — tool call logs, observations, user corrections, partial plans — not static documents
2. **Query reformulation** — "Why did that crash?" needs retrieval of crash log from 2 sessions ago, not most semantically similar sentence
3. **Relevance ≠ Similarity** — the most *useful* record may not be the most *similar* one
4. **Self-RAG** (Asai et al., 2024): teaches model to decide *whether retrieval is warranted at all* — simple gate that cuts unnecessary latency

### Novel: HyMem (2602.13933) — Hybrid Memory with Dynamic Retrieval Scheduling
Inspired by cognitive economy principle:
- **Dual-granular storage**: summary-level + full-detail storage
- **Dynamic two-tier retrieval**: 
  - Lightweight module: constructs summary-level context for efficient responses
  - LLM-based deep module: selectively activated only for complex queries
  - Reflection mechanism for iterative reasoning refinement
- **Results:** Matches full-context performance, reduces computational cost by **92.6%**
- SOTA on both LoCoMo and LongMemEval benchmarks

### Scale
RETRO and follow-up work on trillion-token datastores suggest retrieval memory scales to years of interaction history. The bottleneck shifts from **storage to relevance**.

---

## 7. Approach 5: Hierarchical / OS-Inspired Memory

### MemGPT (Packer et al., 2024) — The Canonical Design
Borrows OS virtual memory concepts:
| Tier | Analogy | Function |
|------|---------|----------|
| **Main context** | RAM | Active window: system prompt + recent messages + relevant records |
| **Recall storage** | Disk | Searchable database of all past messages |
| **Archival storage** | Cold storage | Vector-indexed store for documents + long-term knowledge |

Agent moves data between tiers via memory management "functions" — `archival_memory_search`, `core_memory_append`, etc. An interrupt mechanism lets the agent perform multiple internal memory ops before responding.

### MemOS (6,492⭐, Apache-2.0, MemTensor)
"AI Memory OS" — explicitly framed as an operating system for agent memory:
- Persistent skill memory for cross-task skill reuse and evolution
- Compatible with moltbot, clawdbot, openclaw agent frameworks
- Memory scheduling, retrieval, and lifecycle management
- Treats memory as a first-class system resource

### Achilles' Heel: Silent Orchestration Failures
Unlike a crashed API call (which produces an error), a paging decision that evicts the wrong record simply results in a slightly worse response — **no exception, no log entry, no obvious signal**. These failures accumulate silently over time.

---

## 8. Approach 6: Learned Memory Control (RL-Trained)

### Agentic Memory (Yu et al., 2026) — The State of the Art
Treats memory operations as **policy actions optimized end-to-end via RL**:
- Operations: `store`, `retrieve`, `update`, `summarize`, `discard` — all as callable tools
- Training: three-stage RL pipeline with **step-wise GRPO**
- **Discovers non-obvious strategies** such as preemptive summarization before context is full
- **Outperforms all memory-augmented baselines** on five benchmarks
- **Unifies STM/LTM** under a single learned policy

### Why This Matters
Heuristic and prompted memory control are inherently limited:
- Heuristics can't adapt to context
- Prompted self-control depends on LLM instruction-following quality
- **Learned control discovers strategies that humans wouldn't design** — e.g., it learns to summarize *before* the context fills up, not after

### Cost
Training cost is substantial. Not viable for every deployment. But the architectural patterns it discovers can be back-ported as improved heuristics.

---

## 9. Approach 7: Information-Theoretic Compression

### MemFly (2602.07885) — Information Bottleneck for Memory
Formalizes the core tradeoff: minimize compression entropy (be compact) while maximizing relevance entropy (preserve useful information).

- **Gradient-free optimizer** constructs stratified memory structure
- **Hybrid retrieval mechanism**: semantic + symbolic + topological pathways
- **Iterative refinement** for complex multi-hop queries
- Substantially outperforms baselines in memory coherence, response fidelity, and accuracy

### Why This Is Novel
Most memory systems treat compression and retrieval as separate problems. MemFly unifies them under information-theoretic principles, providing a principled way to decide *what to keep and what to discard*.

---

## 10. Approach 8: Hardware-Level Memory Persistence

### Persistent Q4 KV Cache (2603.04428, Shkolnikov)
Addresses multi-agent edge deployment where device RAM can't hold all agents' KV caches:

- **Problem:** On Apple M4 Pro with 10.2 GB cache budget, only 3 agents fit at 8K context in FP16. A 10-agent workflow must constantly evict/reload.
- **Solution:** Persist each agent's KV cache to disk in **4-bit quantized format**, reload directly into attention layer
- **Results:**
  - Time-to-first-token: up to **136× faster** (vs full re-prefill)
  - 4× more agent contexts fit in fixed device memory
  - Perplexity impact: -0.7% to +3.0% (minimal)
- Open-source: https://github.com/yshk-mxim/agent-memory

### AMV-L: Lifecycle-Managed Agent Memory (2603.04443)
Treats agent memory as a **managed systems resource** (not just a data store):
- Continuous utility scoring → value-driven promotion/demotion/eviction across lifecycle tiers
- Retrieval restricted to bounded, tier-aware candidate set
- **vs TTL:** 3.1× throughput, 4.2× median latency reduction, >2s requests: 13.8% → 0.007%
- **Key insight:** Predictable performance for long-running agents requires **explicit control of memory working-set size**, not just retention time

---

## 11. Multi-Agent Memory Patterns

### EvoScientist (2603.08127) — Evolving Multi-Agent Memory
Three specialized agents with two persistent memory modules:
1. **Ideation memory** — summarizes feasible research directions + records unsuccessful ones (for Researcher Agent)
2. **Experimentation memory** — captures effective strategies from code search trajectories (for Engineer Agent)
3. **Evolution Manager Agent** — distills insights from prior interactions into reusable knowledge

Outperforms 7 SOTA systems in scientific idea generation (novelty, feasibility, relevance, clarity).

### Cross-Agent Memory Patterns
From the survey and repo landscape, multi-agent memory falls into:

| Pattern | Description | Example |
|---------|-------------|---------|
| **Shared blackboard** | Central store all agents read/write | Our SIGNALS.md, EvoScientist's shared memories |
| **Private + shared** | Each agent has private memory + shared pool | MemOS per-agent stores + shared skill memory |
| **Hierarchical delegation** | Parent agent's memory includes summaries of child results | Our May→Coder→QA pattern |
| **Gossip/broadcast** | Agents periodically broadcast discoveries | cc-connect relay system |
| **Federated** | Each agent maintains own memory, periodically syncs | Distributed agent systems |

### Key Multi-Agent Challenge: Epistemic Asymmetry
(Cross-references our deep-dive on arXiv:2603.05450 DPIP): LLMs **cannot reliably track "who knows what"** in multi-agent settings. Deterministic belief-tracking outperforms LLMs for this task. Implication: don't rely on agents to infer shared knowledge — include ALL relevant context explicitly in delegation.

---

## 12. Open-Source Memory Frameworks

### Tier 1: Major Frameworks (>5,000⭐)

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| **memvid/memvid** | 13,364⭐ | Rust | Serverless single-file memory layer replacing RAG pipelines |
| **MemoriLabs/Memori** | 12,334⭐ | Python | SQL-native memory layer for LLMs, agents & multi-agent systems |
| **MemTensor/MemOS** | 6,492⭐ | Python | AI Memory OS with persistent skill memory, lifecycle management |
| **volcengine/OpenViking** | 5,623⭐ | Python | Context database for AI agents, unifying vector/graph/structured |

### Tier 2: Significant Projects (1,000–5,000⭐)

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| **MemMachine/MemMachine** | 4,774⭐ | Python | Universal memory layer, scalable/extensible/interoperable |
| **campfirein/cipher** | 3,564⭐ | TypeScript | Memory layer for coding agents (Cursor, Codex, Claude Code) |
| **aiming-lab/SimpleMem** | 3,142⭐ | Python | Efficient lifelong memory with MCP integration |
| **memodb-io/Acontext** | 3,145⭐ | TypeScript | Agent skills as a memory layer |
| **EverMind-AI/EverMemOS** | 2,511⭐ | Python | Long-term memory for 24/7 agents across LLMs and platforms |
| **kayba-ai/agentic-context-engine** | 1,969⭐ | Python | Make agents learn from experience; hosted solution |
| **BAI-LAB/MemoryOS** | 1,245⭐ | Python | EMNLP 2025 Oral — memory OS for personalized AI agents |

### Tier 3: Research Implementations

| Repo | Stars | Language | Description |
|------|-------|----------|-------------|
| **agiresearch/A-mem** | 877⭐ | Python | A-MEM: Agentic Memory for LLM Agents (NeurIPS 2025) |
| **WujiangXu/A-mem** | 818⭐ | Python | Code for NeurIPS 2025 A-Mem paper |

### Notable Emerging Patterns
- **MCP integration** — SimpleMem and others expose memory as MCP (Model Context Protocol) tools
- **Git-based persistence** — musecl/musecl-memory uses git for portable agent memory versioning
- **Coding agent specialization** — cipher specifically targets Cursor/Codex/Claude Code memory needs
- **Skills-as-memory** — Acontext and MemOS blur the line between skill storage and memory

---

## 13. Benchmarks and Evaluation

The benchmark landscape has matured significantly in 2025–2026:

### Major Benchmarks

| Benchmark | Year | Focus | Key Finding |
|-----------|------|-------|-------------|
| **LoCoMo** | 2024 | Multi-session (35 sessions, 300+ turns) | Humans still far ahead of all systems |
| **LongMemEval** | 2025 | Long-term factual recall | Long-context GPT-5-mini beats memory systems on raw recall |
| **PersonaMemv2** | 2025 | Persona consistency | Memory systems competitive (stable factual attributes suit extraction) |
| **MemBench** | 2025 | Factual vs reflective; participation vs observation (ACL 2025 Findings) | Separates recall from meta-cognitive memory |
| **MemoryAgentBench** | 2025 | Four cognitive competencies | No current system masters all four |
| **MemoryArena** | 2026 | Multi-session interdependent tasks (4 domains) | Near-saturated LoCoMo models drop to 40–60% |
| **LifeBench** | 2026 (2603.03781) | Long-horizon multi-source (declarative + non-declarative) | Top systems reach only 55.2% accuracy |
| **StructMemEval** | 2026 (2602.11243) | Memory organization (not just recall) | Simple RAG-LLMs struggle; memory agents succeed only if prompted on structure |

### Key Benchmark Insights
1. **Saturation on old benchmarks**: Systems near-saturating LoCoMo collapse on MemoryArena/LifeBench — current evaluation was too easy
2. **Structural memory is undertested**: StructMemEval shows LLMs can organize memory if told how, but **fail to recognize the right structure autonomously**
3. **Non-declarative memory is blind spot**: LifeBench tests habitual/procedural memory inferred from digital traces — all systems struggle
4. **Evaluation must be agentic**: Static recall benchmarks don't test memory in service of decision-making; only MemoryArena and LifeBench couple memory with action

---

## 14. Cost Analysis: Memory Systems vs Long Context

### Key Paper: Beyond the Context Window (2603.04814)
Compares Mem0-based fact memory vs long-context GPT-5-mini:

| Dimension | Memory System (Mem0) | Long-Context LLM |
|-----------|---------------------|-------------------|
| **LongMemEval recall** | Lower | Higher |
| **LoCoMo recall** | Lower | Higher |
| **PersonaMemv2** | Competitive | Similar |
| **Cost profile** | Fixed per-turn read cost (after one-time write) | Per-turn cost growing with context length |
| **Break-even at 100k tokens** | **Cheaper after ~10 turns** | Cheaper for <10 turns |
| **Cost scaling** | Flat | O(context_length) per turn, even with caching |

**Decision criterion:** For sessions >10 turns at >100k token context, memory systems are strictly cheaper. The break-even point decreases as context grows. For short, isolated interactions, long-context is simpler and more accurate.

### Implication for Our System
Our agents run multi-session, long-running workflows. We are **deep in the regime where dedicated memory is both cheaper and necessary**.

---

## 15. Open Challenges

From the survey (2603.07670) and cross-referencing all papers:

### 1. Continual Consolidation
How does episodic → semantic transition happen reliably? No system handles this well. EvoScientist's dual-memory is the best attempt but uses separate, manually designed modules.

### 2. Causally Grounded Retrieval
Retrieving by similarity is fundamentally different from retrieving by causal relevance. "What caused the build to fail?" requires causal reasoning, not cosine similarity. No deployed system handles this.

### 3. Trustworthy Reflection
Self-reinforcing errors from bad reflections are a ticking time bomb in long-running agents. Reflection grounding (citing evidence) is a partial fix. No system has a robust solution.

### 4. Learned Forgetting
When should an agent forget? Ebbinghaus-curve decay (MemoryBank, AAAI 2024) is a start, but principled forgetting that preserves rare-but-critical information while discarding truly obsolete data remains unsolved.

### 5. Contradiction Handling
When a newer memory contradicts an older one, which wins? Simple recency bias fails for durable facts. No system implements satisfactory temporal-scope-aware contradiction resolution.

### 6. Privacy and Governance
GDPR right-to-deletion in a system where memories have been consolidated, summarized, and cross-referenced is an engineering nightmare. Almost no system addresses this.

### 7. Silent Failure Detection
Both hierarchical paging failures and retrieval misses are **silent** — no error, no log, just a subtly worse response. Detecting these at scale is unsolved.

---

## 16. Recommendations for Our System

Based on this research, here are concrete recommendations for our multi-agent architecture:

### Immediate (Can implement now)

1. **Structured append-only journal** — Our `journal.md` files are already episodic memory. Formalize them: add timestamps, importance tags, and cross-references. This is the foundation everything else builds on.

2. **Explicit context in delegation** — Per DPIP (2603.05450) findings: don't assume sub-agents infer shared knowledge. Include ALL relevant context when delegating. Our current pattern of May→Coder→QA should carry full context, not references.

3. **Semantic consolidation pass** — Periodically (e.g., every 5 sessions), run a consolidation pass over journal entries to extract durable semantic facts into a separate file. Mark episodic sources.

4. **File-based memory with metadata** — Our current `.md` file approach is actually aligned with the "structured store" pattern. Add YAML frontmatter with timestamps, importance scores, and cross-references to other files.

### Medium-term (Worth building)

5. **Two-tier retrieval** — Implement HyMem-style pattern: lightweight summary lookup for simple queries, full-detail retrieval for complex ones. This is how `grep` + reading specific files already works informally — formalize it.

6. **Contradiction detection** — When writing new findings, check against existing knowledge. Simple keyword/semantic overlap detection can catch obvious conflicts.

7. **Read receipts for shared files** — Per DPIP findings: add acknowledgment tracking to SIGNALS.md. Currently broadcast-only with no way to know if agents have consumed signals.

8. **Memory lifecycle tiers** — Inspired by AMV-L: active workspace (current session), recent archive (last 5 sessions), cold archive (older). Different retrieval patterns for each.

### Longer-term (Research direction)

9. **Knowledge graph layer** — PlugMem's propositional/prescriptive knowledge graph is the most promising architecture. Build a lightweight graph of "what we know" with edges to "how we know it" (episodic sources).

10. **Reflection grounding** — Any time an agent makes a generalization (e.g., "this approach doesn't work"), require citation of specific episodic evidence. Prevents self-reinforcing error loops.

---

## 17. Paper Reference Table

| ID | Title | Authors | Date | Focus | Relevance |
|----|-------|---------|------|-------|-----------|
| 2603.07670 | Memory for Autonomous LLM Agents: Survey | Du | Mar 8 2026 | Comprehensive survey | ★★★★★ Foundational |
| 2603.04814 | Beyond the Context Window: Cost-Performance | Pollertlam, Kornsuwannawit | Mar 5 2026 | Mem0 vs long-context cost | ★★★★ Decision framework |
| 2603.03296 | PlugMem: Task-Agnostic Plugin Memory | Yang et al. (UIUC/Microsoft) | Feb 6 2026 | Knowledge-graph memory | ★★★★★ Best architecture |
| 2603.03290 | AriadneMem: Threading the Maze | Zhu et al. | Feb 5 2026 | Multi-hop + state updates | ★★★★ Novel retrieval |
| 2603.04443 | AMV-L: Lifecycle-Managed Agent Memory | Bamidele | Feb 22 2026 | Systems-level memory mgmt | ★★★★ Production patterns |
| 2603.04428 | Persistent Q4 KV Cache for Edge | Shkolnikov | Feb 17 2026 | Hardware-level persistence | ★★★ Edge deployment |
| 2603.08127 | EvoScientist: Multi-Agent Evolving Memory | Lyu et al. | Mar 9 2026 | Multi-agent persistent memory | ★★★★ Multi-agent pattern |
| 2603.03781 | LifeBench: Long-Horizon Multi-Source | Cheng et al. | Mar 4 2026 | Benchmark (declarative + procedural) | ★★★ Evaluation |
| 2602.13933 | HyMem: Hybrid Memory Architecture | Zhao et al. | Feb 15 2026 | Dynamic retrieval scheduling | ★★★★ Efficiency pattern |
| 2602.11243 | StructMemEval: Evaluating Memory Structure | Shutova et al. | Feb 11 2026 | Structural memory benchmark | ★★★ Evaluation |
| 2602.07885 | MemFly: Information Bottleneck Memory | Zhang et al. | Feb 8 2026 | Info-theoretic compression | ★★★ Theory |
| — | Agentic Memory (Yu et al., 2026) | Yu et al. | 2026 | RL-trained memory policy | ★★★★★ SOTA system |
| — | MemGPT (Packer et al., 2024) | Packer et al. | 2024 | OS-inspired hierarchical | ★★★★ Foundational |
| — | Reflexion (Shinn et al., 2023) | Shinn et al. | 2023 | Reflective episodic | ★★★★ Foundational |
| — | Generative Agents (Park et al., 2023) | Park et al. | 2023 | Observation-reflection-planning | ★★★★ Foundational |

---

*Report compiled by Scout. Total sources: 15 papers, 12 repositories, 1 comprehensive survey.*
*Cross-references: arXiv:2603.05450 (DPIP/epistemic asymmetry), arXiv:2603.07496 (HAE security framework)*
