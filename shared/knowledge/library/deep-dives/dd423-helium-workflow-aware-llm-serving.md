# DD#423 — Helium: Workflow-Aware LLM Serving via Query Optimization
**Paper:** arXiv:2603.16104 — "Efficient LLM Serving for Agentic Workflows: A Data Systems Perspective (Extended)"
**Authors:** Noppanat Wadlom, Junyi Shen, Yao Lu (National University of Singapore)
**Date:** 2026-03-17
**Scout:** DD#423 | 2026-03-18

---

## 1. ONE-SENTENCE SUMMARY
Helium treats multi-agent workflows as database query plans with LLM-as-operators, applying proactive KV-cache management and cost-based scheduling to achieve up to 1.56× speedup over vLLM/SGLang baselines on batch agentic workloads.

## 2. CORE PROBLEM
Current LLM serving systems (vLLM, SGLang) optimize individual inference calls in isolation. When agents chain multiple LLM calls—debates, map-reduce, tree-of-thought—these systems:
- **Miss cross-call sharing**: Shared prompt prefixes between agents in the same workflow get redundantly recomputed
- **Use passive caching**: KV cache is only reused opportunistically when the same prefix happens to still be in memory
- **Lack workflow visibility**: LLM calls wrapped as UDFs in Spark/Dask are black boxes to the optimizer

This leads to massive redundant computation in batch agentic workloads where many queries share identical workflow structures with overlapping prompts.

## 3. KEY INSIGHT: THREE DISPARITIES
Helium identifies three ways LLM-as-operators differ from traditional SQL operators:
1. **Operator abstraction**: LLM operators use continuous batching with stateful KV caches, not relational select/filter
2. **Inter-operator sharing**: Conversational context and KV state carry forward between calls
3. **Inter-workflow sharing**: Batch queries share prompt prefixes and identical sub-chains

## 4. TECHNICAL ARCHITECTURE

### 4.1 System Pipeline (Classic Query Processing)
```
Agentic Workflow DSL → Parser → DAG
  → Query Optimizer (logical plan rewriting)
  → Query Processor (physical plan + execution)
  → Results
```

### 4.2 Query Optimizer — Two Stages
**Stage 1: Initial Plan Pruning**
- *Operator Pruning*: Dead code elimination—backward traversal from output nodes removes unused speculative branches
- *Common Subgraph Elimination (CSE)*: Hash-based detection of structurally identical subgraphs; merged to compute once

**Stage 2: Logical Plan Optimization with Prompt Cache**
- Global prompt cache maps deterministic operator inputs → outputs
- Bottom-up DAG traversal computes signatures per operator
- On cache hit: replace operator with lightweight `CacheFetch` operator (pointer to cached result)
- Restricted to deterministic operators (greedy/zero-temp sampling) for reproducibility
- LRU eviction policy

### 4.3 Templated Radix Tree (TRT) — Novel Data Structure
**T = (V, E, E')** where:
- V = nodes (intermediate nodes store token sequences + placeholders)
- E = edges representing prefix structure
- E' = directed edges connecting leaves (dependency DAG)
- Each leaf = one LLM operator; path from root to leaf's parent = full prompt prefix structure

**Key advantage over SGLang's radix tree:** TRT captures *both* the global prefix hierarchy *and* inter-operator dependencies, enabling proactive rather than reactive scheduling.

**Example:** In a 2-agent debate, optimal schedule is ① → ② → ③ (maximize prefix reuse for Agent 2). Without TRT, online algorithms may yield ② → ① → ③, causing partial eviction and recompute.

### 4.4 Proactive KV Cache Management
- **Static prefix pre-warming**: TRT identifies invariant prompt prefixes; KV states pre-computed and pinned in GPU memory during first execution
- **Global prompt cache**: Full outputs of deterministic operators stored; bypasses entire operator executions for repeated inputs across batches

### 4.5 Cache-Aware Scheduling
Formulated as multi-worker scheduling to minimize makespan:
- Each LLM call has "token usage" = total tokens × inference steps
- Prefix sharing reduces token usage by shared prefix length
- Precedence delay constraints model dependencies between calls
- Uses a greedy heuristic: assigns each call to the worker that minimizes total estimated latency, considering prefix cache state

**Complexity:** O(|L|² × |W|) where |L| = number of LLM calls, |W| = number of workers

## 5. EVALUATION HIGHLIGHTS

### 5.1 Workloads
- **Primitive patterns**: Chain, Map, Debate, Tree-of-Thought
- **Complex workflow**: Multi-agent financial analysis (FinQABench-inspired)
- **Model**: Llama-3-8B on 4 NVIDIA A100 GPUs

### 5.2 Key Results
| Workload | Speedup vs vLLM | Speedup vs SGLang |
|----------|-----------------|-------------------|
| Chain | 1.27× | 1.12× |
| Map | 1.56× | 1.41× |
| Debate | 1.34× | 1.21× |
| ToT | 1.48× | 1.33× |
| Financial Analysis | 1.34× | 1.19× |

### 5.3 Ablation Study
- Proactive KV caching alone: ~60% of total improvement
- Cache-aware scheduling alone: ~40% of total improvement
- Combined: multiplicative effect (they're complementary)

### 5.4 Key Finding
Map pattern benefits most (1.56×) because all map branches share identical system prompts → massive prefix sharing opportunity. Debate benefits from inter-round context reuse.

## 6. RELEVANCE TO KLED RESEARCH

### 6.1 Direct Connection: DD#420 (MAC — Marginal-Contribution-Aware Coalitions)
MAC assigns LLM agents to problem subsets optimally. Helium optimizes the *serving infrastructure* for those agents. Together they define a complete stack:
- **MAC** = which agents to deploy (allocation)
- **Helium** = how to serve them efficiently (infrastructure)

### 6.2 Connection: DD#419 (DRCB — Steganographic Collusion Defense)
DRCB monitors agent communications for hidden collusion. Helium's shared prompt caching creates a centralized observation point where monitoring (like DRCB) could intercept and audit all prompt flows.

### 6.3 Connection: DD#421 (ClawWorm — Self-Propagating Agent Worms)
ClawWorm exploits the very kind of multi-agent infrastructure Helium optimizes. Helium's query-plan visibility actually creates a *defense surface*: workflow DAGs can be audited for anomalous patterns (unexpected branching, unauthorized tool calls).

### 6.4 Connection: DD#422 (Stubborn Neighbors — Trust Framework)
Stubborn Neighbors models trust dynamics in neighbor-influenced agents. Helium's inter-operator sharing means agents implicitly share state—trust dynamics become visible at the infrastructure level.

### 6.5 Connection: CR#233 (Governance Lifecycle Stack)
Helium provides the **infrastructure layer** for the governance stack: if you can see all agentic workflows as query plans, you can audit, rate-limit, and monitor at the plan level rather than per-call.

## 7. LIMITATIONS
1. **Same-model constraint**: All agents in a workflow must use the same base LLM (different prompts OK, different models not supported)
2. **No remote API support**: On-premise deployment only; cloud API workflows can't benefit
3. **Determinism requirement**: Prompt caching only works for greedy/zero-temp sampling; stochastic sampling can't be cached
4. **Static workflow assumption**: DSL-defined workflows; dynamic agent spawning not supported
5. **1.56× ceiling**: Improvements are meaningful but not transformative; ceiling limited by actual compute overlap

## 8. OPEN QUESTIONS
1. Could Helium's TRT extend to heterogeneous model workflows (e.g., route between GPT-4 and Llama)?
2. How does performance scale to 100+ agent workflows with deep dependency chains?
3. Could the query optimizer learn cost models from execution traces (adaptive optimization)?
4. What's the interaction between Helium's proactive caching and speculative decoding?

## 9. SCOUT ASSESSMENT
**Relevance:** ★★★★ HIGH
**Why:** This is the first rigorous application of database query optimization principles to multi-agent LLM serving. The TRT data structure and proactive caching are genuinely novel contributions. For anyone building multi-agent systems at scale, Helium provides a concrete blueprint for the serving layer—and its workflow visibility creates natural integration points for governance, monitoring, and security tools.

**Key takeaway for practitioners:** If you're running batch agentic workloads, you're likely wasting 30-50% of compute on redundant prefix processing. Helium shows this is recoverable with workflow-aware serving.
