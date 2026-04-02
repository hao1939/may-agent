# HB#1594 — AMRO-S: Ant Colony Optimization for Multi-Agent LLM Routing

**Source**: arXiv:2603.12933 [cs.AI] (Kyung Hee UESTC/Tongji)
**Date**: 2026-03-16
**Status**: IEEE TAI Submitted

---

## Core Thesis

> "How can we balance quality, cost, and latency in semantic-aware, path-level routing under time-varying system conditions and mixed user intents?"

**AMRO-S** models MAS routing as **semantic-conditioned path selection on a layered directed graph**, inspired by Ant Colony Optimization (ACO) biological principles.

---

## Three Key Mechanisms

### 1. SLM-Based Semantic Task Router
- **Small Language Model** (Llama-3.2-1B SFT) for intent inference
- Maps query to task-mixture distribution: `w(q) = (w_t1(q), ..., w_tk(q))`
- Low-overhead semantic interface vs. expensive LLM-based selectors

### 2. Task-Specific Pheromone Specialists
- **Independent pheromone matrix τ^t** per task type (not global)
- Query-conditioned fusion: `τ_ij(q) = Σ_t w_t(q) · τ_ij^t`
- Reduces cross-task interference under mixed workloads

### 3. Quality-Gated Asynchronous Evolution
- **Offline warm-up**: Supervised training on labeled data
- **Online bypass**: Decouple inference from learning
- LLM-Judge quality gating (g ∈ {0,1}) for background pheromone reinforcement

---

## Problem Formulation

**Layered Directed Graph**: G = (V, E)
- N processing stages (layers)
- Each layer l contains n heterogeneous agent nodes
- Node = (backbone model × reasoning policy/role prompt) pair

**Optimization Goal**:
```
P* = argmax_P U(P;q), where U(P;q) = R(P;q) - λ·C(P;q)
```

**Cost Decomposition**:
```
C(P;q) = ω_tok·Tok(P;q) + ω_lat·Lat(P;q) + ω_load·Load(P;q)
```

---

## Transition Probability

```
p_ij(q) = [τ_ij(q)]^α · [η_j(q)]^β / Σ_k [τ_ik(q)]^α · [η_k(q)]^β
```

Where:
- `τ_ij(q)`: Fused pheromone strength
- `η_j(q)`: Query-conditioned heuristic = Σ_t w_t(q) · η_j(t)
- `η_j(t) = λ_A·Ability[j][t] + λ_L·(1/(Load[j]+ε)) + λ_R·(1/(RT[j]+ε))`

**Exploration Safeguard**: With probability γ, sample uniformly (prevent premature convergence)

---

## Experimental Results

### Main Results (Table 1)
| Benchmark | AMRO-S | MasRouter (SOTA) | Δ |
|-----------|--------|------------------|---|
| MMLU | 87.20% | 86.40% | +0.80 |
| GSM8K | 96.15% | 94.85% | +1.30 |
| MATH | 78.15% | 75.42% | +2.73 |
| HumanEval | 92.00% | 89.80% | +2.20 |
| MBPP | 86.30% | 84.00% | +2.30 |
| **Average** | **87.83** | **85.93** | **+1.90** |

### High-Concurrency Stress Tests
- **Up to 4.7× speedup** under 1000 concurrent processes
- Maintains stable latency under load
- Lower inference cost than baselines (better quality-cost trade-off)

### Ablation Study (Table 3)
| Setting | Router | GSM8K | MATH | Avg |
|---------|--------|-------|------|-----|
| (E) Random | None | 92.90 | 69.10 | 79.64 |
| (F) w/o SFT | Llama-3.2-1B | 94.50 | 73.20 | 83.42 |
| (G) w/o SFT | GPT-4o-mini | 95.80 | 76.50 | 86.48 |
| (H) w/ SFT | Qwen2.5-1.5B | 96.20 | 77.90 | 87.63 |
| **(I) AMRO-S** | **Llama-3.2-1B SFT** | **96.36** | **78.15** | **87.83** |

**Key Insight**: Small model (1B) with SFT outperforms large model (GPT-4o-mini) without SFT — **routing expertise > model scale**

---

## OpenClaw Mapping

| AMRO-S Component | OpenClaw Equivalent |
|------------------|---------------------|
| SLM Task Router | L3 Intent Recognition → Skill Selection |
| Pheromone Specialists τ^t | Error Log pattern weights per task type |
| Layered Graph G=(V,E) | AGENTS.md role hierarchy |
| Quality-Gated Updates | L1/L2/L3 validation success tracking |
| Task Mixture w(q) | Skill confidence scoring |
| η_j(t) Heuristic | load balancing + capability matching |

### Design Validation

1. **Small Model for Routing**: AMRO-S uses 1B parameter SLM → validates OpenClaw's L3 lightweight intent detection approach

2. **Task-Isolated Memory**: Independent pheromone matrices per task → validates OpenClaw's Skill-specific Error Log isolation

3. **Inference-Learning Decoupling**: Async quality-gated updates → validates OpenClaw's offline compilation + runtime frozen model stance

4. **Interpretability via Pheromone Patterns**: Structured routing evidence → aligns with OpenClaw's SIGNALS.md audit trail

---

## Critical Insights

### 1. Static vs Dynamic Routing
> "Static rule-based allocation adapts poorly to load fluctuations... full-context broadcasting incurs significant redundancy"

→ Validates OpenClaw's **compiled-time Skill selection** + **runtime load-aware dispatch**

### 2. Black-Box Limitation
> "Routing decisions buried in black-box inference limit transparency in high-stakes domains"

→ Validates OpenClaw's **explicit SIGNALS.md handoff protocol** and **read_by tracking**

### 3. Cross-Task Interference
> "Standard ACO exhibits 'averaging' behavior under mixed task streams"

→ Validates OpenClaw's **Skill isolation** and **task-specific AGENTS.md profiles**

---

## Relevance to OpenClaw

**For Tech-Lead**:
- Task-specific pheromone specialists → Implement Skill-specific success rate tracking
- Quality-gated async updates → Batch-process Error Log learning offline
- SLM router → Consider lightweight intent classifier for L3

**For Bob**:
- Biological inspiration (ACO) → Design principle: emergent optimization via local rules
- Layered graph abstraction → AGENTS.md as semantic topology
- Interpretability through pheromone patterns → SIGNALS.md as "human-readable routing trace"

---

## Citations

```bibtex
@article{wang2026amros,
  title={Efficient and Interpretable Multi-Agent LLM Routing via Ant Colony Optimization},
  author={Wang, Xudong and Zhang, Chaoning and Zhang, Jiaquan and Li, Chenghao and Sun, Qigan and Bae, Sung-Ho and Wang, Peng and Xie, Ning and Zou, Jie and Yang, Yang and Shen, Hengtao},
  journal={arXiv preprint arXiv:2603.12933},
  year={2026}
}
```

---

**Tags**: #multi-agent-routing #ant-colony-optimization #SLM #interpretability #quality-cost-tradeoff #L3-routing #pheromone-learning

**L3 Flags**: #1195 (Task-specific routing memory), #1196 (SLM-based intent inference), #1197 (Async quality-gated learning)
