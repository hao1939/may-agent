# Deep-Dive #380: RelayCaching — Accelerating LLM Collaboration via Decoding KV Cache Reuse

**Source:** arXiv:2603.13289v1, 28 Feb 2026
**Authors:** Yingsheng Geng, Yuchong Gao, Weihong Wu, Guyue Liu, Jiang Liu
**Rating:** ★★★★★ CRITICAL
**Portfolio connections:** DD#379 (Orla), DD#357 (ARL-Tangram), DD#355 (AgentServe), CR#203 (Agentic Compute Lifecycle), DD#282 (Structured Distillation), IndexCache DD#(deep-dive-arxiv-2603-12201)

## TL;DR

RelayCaching is a **training-free** inference method that directly reuses **decoding-phase KV caches** from upstream agents in downstream agents' **prefill phases**. The key empirical finding: despite different prefixes, KV caches for identical content are **highly consistent** across phases, with deviations concentrated in a **sparse set of middle-layer tokens**. By selectively recomputing only these tokens (~20% of entries), RelayCaching achieves **80%+ KV cache reuse**, up to **4.7× TTFT reduction**, with **negligible accuracy degradation** across math, code, and knowledge tasks.

## The Cascading Redundancy Problem

In multi-agent pipelines, each agent's output becomes the next agent's input context. A 3-agent pipeline forces Agent 3 to re-prefill the accumulated history from Agents 1 and 2 — **O(M²) cumulative prefill cost** where M is the number of interaction turns.

Existing solutions fail:
- **Prefix caching** (vLLM/SGLang): requires strict positional alignment — fails when reused content appears at non-prefix positions (always the case in MAS)
- **Pre-computed caching** (Prompt Cache, CacheBlend): assumes static, offline-encodable content — violated by dynamically generated agent outputs
- **KVCOMM**: retrieval-based anchor pools, but reuse rates decline from 88% to 70% as context diversity grows

## Three Key Empirical Observations

### 1. Macro-Level Alignment is High
Despite prefix variation between decoding and prefill phases, decoding KV caches maintain **high cosine similarity** with full-prefill counterparts. Value cosine similarity is the primary deviation indicator (keys align well in both direction and magnitude; values show directional perturbations while preserving magnitude).

Critical control: **Independent KV** (encoding summary tokens alone without prefix) shows substantially different norm patterns — pre-computation schemes that independently encode KV caches are **incompatible** with decode-to-prefill reuse.

### 2. U-Shaped Layer-Wise Similarity Profile
- **Shallow layers**: high similarity, need no rectification
- **Middle layers**: minimum similarity, dominate downstream generation errors
- **Deep layers**: partial recovery, diminishing returns from rectification

Oracle experiment confirms: substituting decoding KV with full-prefill KV in middle layers captures **most of the accuracy recovery**, while shallow/deep layer substitution adds little.

### 3. Sparse, Correlated Token-Wise Deviations
- Only a **small subset of token positions** exhibit large deviations
- High-deviation positions are **inter-layer correlated** (Spearman rank correlation rapidly plateaus)
- Once a deviation pattern emerges, it **persists across subsequent layers**
- Implication: detect once at a stabilization layer, propagate selection through remaining layers

## The RelayCaching Architecture

### Layer-Range Profiler (offline)
1. Compute layer-wise value cosine similarity profile
2. Set **L_start**: deepest shallow layer with similarity ≥ τ_st (starting point — load cached hidden states)
3. Set **L_end**: first layer entering the stable deep regime (diminishing returns boundary)
4. Set **L_det**: detection layer where inter-layer correlation has stabilized (via second-order difference of Spearman correlation)

### Token Selection Module (runtime)
Two complementary criteria:
1. **Deviation-based**: select tokens with d_{j,L_det} ≥ τ_dev · μ_dev (large directional mismatch)
2. **Influence-based**: select tokens receiving high cumulative attention weights across all decoding steps + suffix-aware correction (last K_suf trailing tokens)

Final rectification set: **I_final = I_dev ∪ I_inf**

### Inference Flow
1. Layers outside [L_start, L_end]: **direct reuse** of decoding KV (no cost)
2. Layers [L_start, L_det): **full recompute** from cached hidden states (needed for deviation detection)
3. Layers [L_det, L_end]: **sparse rectification** — recompute only selected tokens

## Quantitative Results

### Accuracy (vs. Full Prefill baseline)

| Dataset | Method | 2 Agents | 3 Agents | 4 Agents |
|---------|--------|----------|----------|----------|
| GSM8K | Full Prefill | 85.97 | 84.69 | 84.69 |
| GSM8K | Zero Reuse | 40.33 | 40.03 | 53.68 |
| GSM8K | CacheBlend | 76.72 | 77.56 | 74.73 |
| GSM8K | KVCOMM | 84.23 | 82.34 | 84.91 |
| GSM8K | **RelayCaching** | **84.84** | **85.50** | **85.17** |
| MMLU | Full Prefill | 71.24 | 73.20 | 66.67 |
| MMLU | **RelayCaching** | **69.28** | **71.90** | **67.97** |
| HumanEval | Full Prefill | 82.61 | 85.71 | 87.58 |
| HumanEval | **RelayCaching** | **82.61** | **85.09** | **87.58** |

**Key**: RelayCaching matches Full Prefill within ~1% across all tasks. Zero Reuse (no rectification) catastrophically fails on GSM8K (40% vs 85%).

### Efficiency

| Metric | Full Prefill | RelayCaching | Speedup |
|--------|-------------|-------------|---------|
| Agent 2 TTFT | 85.2ms | 40.6ms | 2.1× |
| Agent 3 TTFT | 180.2ms | 54.3ms | 3.3× |
| Agent 4 TTFT | 321.5ms | 74.7ms | 4.3× |
| Agent 5 TTFT | 493.9ms | 104.8ms | 4.7× |
| KV Cache Reuse Rate | 0% | 80%+ | — |
| Scaling factor | 5.8× (Agent 2→5) | 2.6× (Agent 2→5) | — |

**Critical result**: RelayCaching's latency scales **sub-linearly** (2.6×) while Full Prefill scales **quadratically** (5.8×) from Agent 2 to Agent 5. The gap widens with more agents.

### Layer-range profiler is task-agnostic
Calibrated on 2WikiMQA but **generalizes across all tasks without per-task tuning**. This is remarkable and suggests the U-shaped deviation profile is a property of transformer architecture, not task content.

## Why This Matters for Multi-Agent Infrastructure

### 1. The O(M²) → O(M) Breakthrough
Multi-agent pipelines have an inherent quadratic scaling problem with context accumulation. RelayCaching converts this to near-linear by making cache reuse the default rather than recomputation. For a 5-agent pipeline, this is already a 4.7× speedup — and the gap grows with more agents.

### 2. The Decode-to-Prefill Paradigm Shift
All prior caching approaches assumed either (a) strict prefix alignment or (b) static content. RelayCaching demonstrates a third path: **same content, different prefix, targeted rectification**. This paradigm is specific to multi-agent workflows and unavailable to single-agent systems.

### 3. Training-Free = Immediately Deployable
No fine-tuning, no architectural changes. Works with existing models (Llama-3.1, Qwen2.5, Qwen3). The layer-range profiler runs offline once and generalizes. This can be integrated into existing serving infrastructure today.

## Portfolio Integration

### Validates
- **DD#379 (Orla)**: Orla identified workflow-level cache management as critical but implemented simple preserve/flush policies. RelayCaching provides the **actual cache reuse mechanism** — Orla's memory manager + RelayCaching's decode-to-prefill reuse = complete solution.
- **CR#203 (Agentic Compute Lifecycle)**: RelayCaching addresses the "infrastructure gap" at the serving layer — exactly where CR#203 identified the deepest inefficiency.
- **DD#357 (ARL-Tangram)**: ARL-Tangram manages GPU resources at action level; RelayCaching manages KV cache state across workflow boundaries. Adjacent layers, complementary approaches.

### Novel Contributions to Portfolio
- **Mechanism 38: Cascading Prefill Redundancy** — In multi-agent pipelines, each agent recomputes the full accumulated context, creating O(M²) scaling that dominates latency as pipelines grow. This is a *systemic* property of agent collaboration, not a per-agent problem.
- **Observation: U-shaped deviation is architectural, not task-specific** — The transformer architecture imposes a predictable layer-wise deviation structure that can be exploited once and reused forever. This is a free lunch.

### Extends
- **IndexCache (DD deep-dive-arxiv-2603-12201)**: IndexCache accelerates sparse attention; RelayCaching accelerates cross-agent prefill. They're complementary optimizations at different points in the inference pipeline.
- **DD#282 (Structured Distillation)**: RelayCaching operates at the KV cache level; Structured Distillation operates at the semantic level. Both reduce redundancy in inter-agent communication, but at different abstraction layers.

## Predictions

1. **P-380-1**: RelayCaching (or equivalent decode-to-prefill techniques) will be integrated into major serving frameworks (vLLM, SGLang) within 6 months as multi-agent workloads grow.
2. **P-380-2**: The U-shaped layer-wise profile will be confirmed across all major transformer families (GPT, Claude, Gemini), enabling universal application.
3. **P-380-3**: Combined with Orla-style workflow-level scheduling, total MAS serving efficiency will improve 5-10× over current best practice, making larger agent teams economically viable.

---
*Deep-dive #380 | Scout | Session s_1773714026884_1148 | 2026-03-17*
