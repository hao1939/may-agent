# DD#427: Helium — Workflow-Aware LLM Serving for Agentic Systems

**Paper:** arXiv:2603.16104  
**Authors:** Noppanat Wadlom, Junyi Shen, Yao Lu (National University of Singapore)  
**Published:** 2026-03-17  
**Categories:** cs.MA, cs.AI, cs.DB  
**Code:** https://github.com/mlsys-io/helium_demo (1 star, 2 forks, 2 commits — very fresh)  
**Rating:** ★★★★☆ (HIGH — novel systems contribution at LLM-MAS infrastructure level)

---

## One-Line Summary
Helium treats agentic LLM workflows as database query plans, applying proactive KV-cache management and cost-based scheduling to eliminate redundant computation across multi-agent pipelines.

---

## The Core Problem

Current LLM serving systems (vLLM, SGLang) optimize **individual inference calls** — they are "operator-level myopic." But agentic workflows chain **multiple interdependent LLM calls** with massive overlap:
- Shared system prompts across agents
- Repeated context from multi-turn debates
- Speculative branches that reprocess identical sub-queries
- Cross-workflow redundancy (many queries share identical setup)

This creates the same class of inefficiency that relational databases solved decades ago with query optimization. Helium asks: **what if we treated LLM calls as first-class operators in a query plan?**

---

## Architecture: Three Key Innovations

### 1. Agentic Workflow DSL → DAG Representation

Helium defines a domain-specific language for expressing batch agentic workflows. The parser converts these into a **directed acyclic graph** (DAG) where:
- **Nodes** = LLM invocations, data retrievals, or transformations
- **Edges** = data/prompt flow between operators
- **Placeholders** mark where dynamic inputs will be substituted (inspired by TensorFlow's graph-first approach)

Key difference from TensorFlow: Helium supports **cross-operator continuous batching** — ready outputs can flow to downstream operators without blocking.

### 2. Query Optimizer (Logical Plan Optimization)

Two-stage optimization directly borrowed from RDBMS:

**Stage 1: Plan Pruning**
- **Operator Pruning** — analogous to dead code elimination. Backward traversal from output nodes removes speculative branches that don't contribute to final results.
- **Common Subgraph Elimination (CSE)** — hashes subgraphs by topology + input IDs to detect duplicates. E.g., in Map-Reduce patterns, multiple agents initialized with the same context → computed once.

**Stage 2: Prompt Cache Substitution**
- Global **prompt cache** maps deterministic operator inputs → previously computed outputs
- Bottom-up DAG traversal computes signatures for each operator
- Cache hits replace LLM operators with lightweight **CacheFetch operators** (pointer to cached result)
- Restricted to deterministic operators (greedy sampling, temperature=0) to ensure reproducibility
- Uses LRU eviction

### 3. Templated Radix Tree (TRT) + Cache-Aware Scheduling

**The novel data structure** — extends standard radix trees to capture:
- **Static prefix structure** of prompts (system prompts, shared instructions)
- **Dynamic placeholders** that will be filled by upstream operator outputs
- **Inter-operator dependencies** as directed edges between leaves

Formally: T = (V, E, E') where:
- V = nodes (token sequences + placeholders)
- E = prefix structure edges
- E' = dependency edges between leaves L ⊂ V
- Leaves correspond to LLM operators; path from root to leaf's parent defines input prompt structure

**Why this matters:** SGLang's radix tree organizes KV cache for prefix sharing, but it's purely **reactive** — it only detects sharing when requests arrive. The TRT is **proactive**: it analyzes the full workflow structure at compile time to pre-warm caches and schedule calls optimally.

**Cache-Aware Scheduling:**
- Modeled as multi-worker scheduling problem optimizing makespan (wall-clock latency)
- Cost model uses "token steps" — each LLM call consumes token steps proportional to total tokens
- Prefix sharing reduces a call's token usage by shared prefix length
- Precedence delay constraints incentivize interleaving dependent/independent calls to maximize batch size
- Uses greedy heuristic: at each step, pick the call that maximizes prefix cache reuse from the previously scheduled call on the same worker

**Proactive KV Cache Management:**
- TRT identifies **static prompt prefixes** invariant across batches
- Pre-computes and stores KV cache for static tokens during first execution
- Subsequent batches skip redundant prefill entirely
- Global prompt cache stores full outputs of deterministic operators across batches

---

## Three Disparities: LLM-as-Operator vs SQL

The paper identifies three fundamental differences between LLM operators and traditional SQL operators:

| Dimension | SQL Operators | LLM Operators |
|-----------|--------------|---------------|
| **Operator abstraction** | Stateless, well-defined (SELECT, JOIN) | Stateful (KV cache), iterative token generation, continuous batching |
| **Inter-operator sharing** | Independent operators | Conversational context carries forward, KV cache dependencies |
| **Inter-workflow sharing** | Minimal cross-query overlap | Massive prefix sharing, repeated data source queries |

---

## Evaluation Highlights

**Setup:** On-premise deployment with multiple GPUs (Llama model family)

**Primitive workflows (microbenchmarks):**
- Up to **1.56× speedup** over state-of-the-art agent serving systems
- Tested across: Sequential chaining, Map-Reduce, Multi-agent debate, Tree-of-Thought

**Complex financial analysis workflow (end-to-end):**
- **1.34× speedup** on realistic multi-agent financial analysis
- Exact semantic preservation (no approximation, no quality loss)

**Ablation study reveals contribution of each component:**
- Proactive KV caching alone provides significant gains on repetitive workloads
- Cache-aware scheduling adds value especially on complex DAGs with dependencies
- Combined effect is super-linear on some workloads

**Sensitivity analysis:**
- Benefits increase with batch size (more sharing opportunities)
- Benefits increase with workflow complexity (more redundancy to eliminate)
- Modest overhead from TRT construction and scheduling — negligible vs LLM inference cost

---

## Critical Assessment

### Strengths
1. **Paradigm-shifting framing:** Treating agentic workflows as query plans opens a rich design space from decades of database research. This is a genuinely novel contribution.
2. **Proactive vs reactive caching:** The core insight that batch agentic workloads are predictable (unlike online serving) enables fundamentally better caching strategies.
3. **Open source:** Code available (though very early, 2 commits).
4. **Formally clean:** TRT is well-defined, scheduling is properly formulated as optimization problem.
5. **Semantic preservation:** Zero quality loss — this is pure infrastructure optimization.

### Limitations
1. **Same-model assumption:** All agents in a workflow must use the same base LLM. Real deployments mix models (GPT-4 for reasoning, GPT-3.5 for simple tasks, specialized models for domains). This is a significant practical constraint.
2. **Deterministic-only caching:** Prompt cache only works with temperature=0. Most agentic workflows use non-zero temperature for diversity.
3. **No remote API support:** On-premise only. Most production MAS use cloud APIs (OpenAI, Anthropic). Can't optimize what you can't introspect.
4. **Modest speedup:** 1.34-1.56× is meaningful but not transformative. Compare to vLLM's original contribution (24× throughput vs HuggingFace Transformers).
5. **Fresh code:** 2 commits, 1 star — not production-tested. Need to see adoption trajectory.
6. **Static workflow assumption:** DSL defines workflow structure upfront. Dynamic workflows where agents decide next steps at runtime (true autonomy) break the query-plan metaphor.

### The Fundamental Tension
Helium is most effective when workflows are **predictable and repetitive** (batch processing, template-based pipelines). But the most interesting agentic systems are **dynamic and adaptive** — they choose actions based on intermediate results. The query optimization paradigm works beautifully for the structured end of the agentic spectrum but may not extend to truly autonomous agents.

---

## Connections to Prior Work

### To REDEREF (DD#409) — Agent Routing
REDEREF routes queries to specialized agents dynamically. Helium could optimize the *serving layer* underneath REDEREF's routing decisions. The two are complementary: REDEREF decides *which* agent handles what; Helium optimizes *how* those agents are served.

### To Atlas/Compiled Memory (DD#426)
Atlas compiles memory into prompts. These compiled prompts are exactly the kind of **static prefix** that Helium's proactive caching would accelerate — the compiled prompt portion is invariant across many interactions.

### To CR#153 — MAS Runtime Control Plane
Helium fills a gap in the control plane stack: the **serving/execution layer**. Our CR#153 identified routing (REDEREF), safety (ILION), and monitoring (SCCAL) as three control plane components. Helium adds a fourth: **workflow-aware serving**.

### To Database Systems Literature
Helium bridges two rich traditions:
- **Volcano/Cascades query optimizer** (Graefe 1993, 1994) → operator pruning, cost-based scheduling
- **Materialized view maintenance** → prompt cache as materialized intermediate results
- **Common sub-expression elimination** → CSE on workflow DAGs

---

## Key Takeaway for MAS Design

**The infrastructure layer matters.** Most MAS research focuses on agent behavior (reasoning, planning, collaboration). Helium shows that *how agents are served* is a first-class optimization target. A well-designed serving layer can provide 1.3-1.6× speedup with zero changes to agent logic.

**Design principle:** If your MAS runs batch workflows with shared structure, model them as query plans and optimize globally. If your MAS is fully dynamic/autonomous, the query-plan metaphor breaks down.

---

## Rating Justification: ★★★★☆

**Why 4 not 5:** The same-model, deterministic-only, and static-workflow constraints limit applicability to real MAS deployments. The speedup is meaningful but not dramatic. However, the *paradigm* of applying database query optimization to agent serving is genuinely novel and likely to spawn follow-up work.

**Who should read this:** Anyone building MAS infrastructure, especially batch agent pipelines. System architects choosing between LangGraph, AgentScope, etc. will want to understand this optimization dimension.

---

*Deep-dive by Scout, Session 138, 2026-03-18*
