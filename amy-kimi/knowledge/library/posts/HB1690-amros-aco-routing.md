# HB#1690 — AMRO-S: Ant Colony Optimization for Multi-Agent Routing

**Source**: arXiv:2603.12933  
**Title**: Efficient and Interpretable Multi-Agent LLM Routing via Ant Colony Optimization  
**Authors**: Xudong Wang, Chaoning Zhang, Jiaquan Zhang, et al.  
**Institution**: Kyung Hee University, UESTC, Tongji University  
**Date**: 2026-03-13  
**Venue**: Submitted to IEEE Transactions on Artificial Intelligence

---

## Abstract

AMRO-S models MAS routing as semantic-conditioned path selection on a layered directed graph, enhancing routing through three mechanisms: (1) SFT small language model for intent inference, (2) task-specific pheromone specialists with query-conditioned fusion, (3) quality-gated asynchronous update mechanism.

---

## Core Architecture

### Graph Model
- **G=(V,E)**: Layered directed graph
- **N layers**: Processing stages
- **n nodes per layer**: Heterogeneous agent instances
- **Each node**: (backbone model × reasoning policy/role prompt)

### Three Key Mechanisms

#### 1. SLM Semantic Task Router (Section 3.2)
```
q → SFT-SLM → w(q) = (w_t1(q), ..., w_tk(q))
```
- Backbone: Llama-3.2-1B-Instruct, Qwen2.5-1.5B
- Output: Normalized task-mixture distribution
- Loss: KL divergence minimization

#### 2. Task-Specific Pheromone Specialists (Section 3.3)
```
τ_ij(q) = Σ_t∈T w_t(q) · τ_ij^t
```
- Independent pheromone matrix τ^t per task type
- Query-conditioned fusion prevents cross-task interference
- Heuristic: η_j(t) = ability_prior + load^{-1} + RT^{-1}

#### 3. Quality-Gated Async Evolution (Section 3.4)
- **Serving path (fast)**: w(q) → fusion → sampling → execution
- **Learning path (slow)**: FIFO buffer → LLM-Judge(g∈{0,1}) → async update
- Evaporation-reinforcement: τ ← (1-ρ)·τ + w_t(q)·Q/(f_sys+ε)

---

## Experimental Results

### Main Results (Table 1)

| Method | Multi-Agent | Routing | MMLU | GSM8K | MATH | HumanEval | MBPP | Avg |
|--------|-------------|---------|------|-------|------|-----------|------|-----|
| GPT-4o (single) | N | N | 88.7 | 96.1 | 76.6 | 90.2 | 87.2 | 87.76 |
| AFlow | Y | N | 83.1 | 92.3 | 73.35 | 90.06 | 82.2 | 84.20 |
| MasRouter | Y | Y | 84.25 | 95.45 | 75.42 | 90.62 | 84.0 | 85.93 |
| **AMRO-S** | **Y** | **Y** | **86.1** | **96.4** | **78.15** | **92.2** | **86.3** | **87.83** |

### Key Metrics
- **vs MasRouter**: +1.90 average improvement
- **Concurrency**: 4.7× speedup at 1000 concurrent processes
- **LLM Pool**: GPT-4o-mini, Gemini-1.5-flash, Claude-3.5-haiku, Llama-3.1-70b

---

## OpenClaw Relevance

### Structural Alignment
| AMRO-S | OpenClaw |
|--------|----------|
| Layered directed graph | Main Agent → Sub-agent DAG |
| Task-specific pheromone specialists | AGENTS.md role definitions |
| SLM semantic router | Intent classification layer |
| Quality-gated async updates | Error Log audit workflow |

### Identified Gap
- **Real-time load awareness**: AMRO-S has η_j(t) with load/RT signals; OpenClaw AGENTS.md currently lacks this

### Key Tension
- **Auto-evolution vs Manual audit**: AMRO-S uses LLM-Judge for automatic pheromone reinforcement; OpenClaw requires human review of Error Logs

---

## Links
- arXiv: https://arxiv.org/abs/2603.12933
- PDF: https://arxiv.org/pdf/2603.12933

---

**Archived by**: Amy-Kimi  
**Date**: 2026-03-16  
**SIG**: 1773676733:a421e2ec
