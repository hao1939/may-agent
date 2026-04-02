# Cross-Reference #223: The Agent Serving Stack — Why Workflow-Level Infrastructure Changes Everything

**Rating:** ★★★★★ CRITICAL
**Primary Sources:** DD#379 (Orla), DD#380 (RelayCaching)
**Supporting Sources:** DD#355 (AgentServe), DD#271 (AgentRM), DD#357 (ARL-Tangram), CR#203 (Agentic Compute Lifecycle), DD#268 (LLM Teams as Distributed Systems), CR#139 (Agent Systems Engineering Trifecta), DD#369 (MASEval), DD#282 (Structured Distillation), IndexCache

## Thesis

Two independent papers from March 2026 — Orla (Harvard) and RelayCaching — converge on a single architectural insight: **the critical bottleneck in multi-agent LLM systems is not individual model quality but the serving infrastructure between models**. Orla addresses this at the workflow-scheduling level (which model runs which stage, how stages coordinate, when cache is preserved or flushed). RelayCaching addresses it at the KV-cache level (how to reuse computation across agents with different prefixes). Together with DD#357 (ARL-Tangram's GPU resource management) and DD#271 (AgentRM's OS-level abstractions), they form a **complete 4-layer Agent Serving Stack** that was invisible to the field 6 months ago.

## The Agent Serving Stack

### Layer 1: GPU Resource Management (ARL-Tangram, DD#357)
**What it manages:** Physical GPU allocation, memory scheduling, action-level compute budgets.
**Abstraction:** Resources per action step.
**Key metric:** GPU utilization, memory efficiency.
**Status:** Deployed at Xiaomi for MiMo training.

### Layer 2: KV Cache Lifecycle (RelayCaching, DD#380)
**What it manages:** Cross-agent KV cache reuse, selective rectification, decode-to-prefill transfer.
**Abstraction:** Cache entries per token per layer.
**Key metric:** Reuse rate (80%+), TTFT reduction (4.7×).
**Status:** Research prototype, training-free, immediately deployable.

### Layer 3: Workflow Orchestration (Orla, DD#379)
**What it manages:** Stage-to-model mapping, DAG scheduling, context propagation, cache lifecycle policies.
**Abstraction:** Stages per workflow.
**Key metric:** Wall-clock time (-38%), cost (-35%).
**Status:** Open-source library, demonstrated on SWE-bench Lite.

### Layer 4: System Evaluation (MASEval, DD#369)
**What it manages:** Framework-agnostic evaluation of MAS as systems, not just models.
**Abstraction:** System configurations per task.
**Key metric:** Framework contribution to variance (~47%).
**Status:** Benchmark framework.

## Why This Stack Matters

### 1. The Adjacent Layer Composition Effect

Each layer alone provides moderate improvement. But they compose **multiplicatively**:
- Orla's stage mapping saves 35% cost by routing to cheaper models
- RelayCaching saves 80%+ compute by reusing KV cache across stages  
- ARL-Tangram optimizes the remaining GPU operations at action level

**Estimated combined savings**: If Orla saves 35% at workflow level, RelayCaching saves 60-80% of remaining prefill compute, and ARL-Tangram saves another 20-30% at GPU level, the compound improvement could be **5-10× total efficiency** over naive serving.

### 2. The Missing Middle Problem

Before Orla and RelayCaching, the MAS infrastructure landscape had two well-studied layers and a gap:

```
Application Layer:  AutoGen, MetaGPT, LangGraph    [well-studied]
                         ⬇ GAP ⬇
Request Layer:      vLLM, SGLang, TensorRT-LLM     [well-studied]
```

Orla fills the gap with workflow-level coordination. RelayCaching fills the gap with inter-agent cache reuse. This is the **middleware layer** that CR#139 (Agent Systems Engineering Trifecta, 2026-03-16) predicted would emerge within 6 months. It emerged within 3 days of that prediction.

### 3. The Quadratic-to-Linear Transition

The most consequential finding is RelayCaching's demonstration that multi-agent prefill cost scales **O(M²)** without cache reuse but **O(M)** with it. This has profound implications:

- **Without RelayCaching**: Adding agents 6-10 to a pipeline makes prefill cost dominant, creating an economic ceiling on agent count
- **With RelayCaching**: Prefill scales linearly, so the coordination cost limit identified in DD#268 (Amdahl's Law) becomes the binding constraint rather than raw compute

This shifts the **bottleneck from compute to coordination** — exactly what the theoretical literature (PoD, DAC, SDec-POMDP) predicted but couldn't quantify.

## Three Novel Insights from Composition

### Insight 1: The Cache-Coordination Duality

Orla's workflow orchestrator decides WHEN to preserve/flush cache. RelayCaching decides HOW to reuse cache across prefix boundaries. These are two faces of the same coin:

- **Orla without RelayCaching**: Cache is flushed on every backend switch — wastes compute
- **RelayCaching without Orla**: Cache is reused between adjacent agents — but no workflow-level scheduling optimizes which agents run when
- **Orla + RelayCaching**: The orchestrator schedules stages to maximize cache reuse windows, while RelayCaching handles the actual reuse mechanics

**Principle 80 (Cache-Coordination Coupling)**: Efficient multi-agent serving requires joint optimization of workflow scheduling and cache lifecycle management. Neither alone captures the full efficiency opportunity.

### Insight 2: The Architecture-Agnostic Invariant

RelayCaching's U-shaped layer-wise deviation profile was calibrated on one dataset (2WikiMQA) with one model (Mistral-7B) but generalized across all tasks and both model families tested (Llama-3.1, Qwen2.5). This suggests the U-shaped profile is a **property of the transformer attention architecture**, not of any specific model or task.

If true, this means:
- Layer-range profiling is a **one-time cost** per architecture family
- New models from the same architecture can reuse profiling results
- The approach scales effortlessly to new tasks and domains

This parallels the architecture-agnostic finding from DD#376 (ORC curvature anomalies precede content failures across models) — transformer architecture imposes structural regularities that infrastructure can exploit.

### Insight 3: The Heterogeneity Dividend

Orla's stage mapping + RelayCaching's cache reuse + MASEval's framework contribution finding (47% of system variance from framework choice) converge on a single principle:

**Law 33 (Infrastructure Dominance)**: In deployed multi-agent systems, infrastructure design choices (model routing, cache management, scheduling policy, framework selection) account for more performance variance than model quality improvements.

Evidence:
- Orla: 35-60% improvement from routing, not model upgrades
- RelayCaching: 4.7× speedup from cache reuse, not faster models
- MASEval: ~47% variance from framework, not model
- ARL-Tangram: deployed at Xiaomi for infrastructure, not model optimization

## Integration with GUS Framework

### Validates
- **GUS Principle 38 (Cheap Signal Dominance)**: Orla's stage mapping routes cheap tasks to cheap models — direct implementation
- **GUS Law 30 (Infrastructure Gap)**: Both Orla and RelayCaching demonstrate that the infrastructure gap is the binding constraint on MAS efficiency
- **CR#139 Prediction (Agent Middleware Stack in 6 months)**: Confirmed within 3 days

### Extends
- **Architecture Stack 9: Agent Serving Stack** (new)
  - L1: GPU Resource Management (ARL-Tangram)
  - L2: KV Cache Lifecycle (RelayCaching)
  - L3: Workflow Orchestration (Orla)
  - L4: System Evaluation (MASEval)

### Proposes
- **Law 33 (Infrastructure Dominance)**: Infrastructure design choices account for more performance variance than model quality in deployed MAS
- **Principle 80 (Cache-Coordination Coupling)**: Joint optimization of workflow scheduling and cache lifecycle management is required for efficient MAS serving
- **Mechanism 38 (Cascading Prefill Redundancy)**: Multi-agent pipelines create O(M²) prefill cost that dominates serving latency without architectural intervention

## Testable Predictions

1. **P-223-1** (6 months): vLLM or SGLang will add native workflow-level cache management APIs, breaking the request-level abstraction boundary.
2. **P-223-2** (12 months): The Agent Serving Stack will consolidate into 2-3 integrated platforms, each covering Layers 1-3. The middleware gap will close.
3. **P-223-3** (6 months): Multi-agent pipelines with >5 agents will become economically viable, enabled by O(M²)→O(M) prefill cost reduction, increasing mean pipeline depth from current ~3 to ~7-10.
4. **P-223-4** (18 months): Infrastructure-aware agent systems will outperform model-quality-focused systems on production benchmarks, confirming Law 33.

## Relevance to Our System

Our file-based multi-agent system has no serving stack at all:
- No stage mapping (May manually dispatches to agents)
- No cache reuse (each agent session starts fresh)
- No workflow-level scheduling (first-come-first-served via heartbeats)
- No KV cache management (context windows are rebuilt per session)

**Most impactful gap**: The lack of persistent state across agent sessions. Every time Scout wakes up, it rebuilds context from scratch by reading todo.md, journal.md, etc. An Orla-style memory manager that preserved relevant context across sessions would dramatically reduce the "cold start" penalty.

**Immediate action**: Consider treating agent session results as "KV cache" equivalents. Instead of full-context rebuilds, maintain compressed summaries of recent session outputs that can be "relayed" to the next session — the semantic equivalent of RelayCaching's decode-to-prefill reuse.

---
*Cross-Reference #223 | Scout | Session s_1773714026884_1148 | 2026-03-17*
