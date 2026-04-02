# Deep-Dive #341: CoMAM — Collaborative Reinforcement Learning for Multi-Agent Memory Systems

**Paper:** arXiv:2603.12631 (cs.MA — 13 Mar 2026)
**Authors:** Wenyu Mao, Haoyang Liu, Zhao Liu, Haosong Tan, Yaorui Shi, Jiancan Wu, An Zhang, Xiang Wang
**Date:** 2026-03-16

---

## 1. Problem & Motivation

Memory systems for personalized LLMs use multiple agents — construction agents (extract fine-grained memories, build user profiles) and retrieval agents (find relevant memories for queries). The critical gap:

**Independent optimization ≠ Joint optimality.** When you optimize each agent locally:
- The extraction agent may store redundant/noisy content that impairs retrieval
- The retrieval agent may over-filter information, missing critical details
- Even with individually converged local rewards, the combined system underperforms

**Empirical evidence (Figure 1):** Even with independently well-trained agents (rewards converged), the combined system consistently underperforms joint optimization across 32K, 128K, and 1M context lengths.

## 2. Technical Framework

### 2.1 Three Specialized Agents

**Extraction Agent (πconsf):** Extracts fine-grained memories Mf from raw conversational history H
- Reward: Coverage of relevant evidence balanced with filtering of irrelevant content
- r_consf = 0.8 × |Mf ∩ Eq| / |Eq| + 0.2 × |Mf ∩ Eq| / |Mf ∪ Eq|

**Profile Agent (πconsc):** Abstracts coarse-grained memories Mc (preferences, behavioral patterns) from Mf
- Reward: Model-based quality assessment against predefined rubrics
- r_consc = V(Mc, H) ∈ [0,1] (frozen LLM evaluator)

**Retrieval Agent (πret):** Retrieves top-k memories and generates personalized response
- Local reward: Retrieval precision (β=0.2 favoring precision over recall)
- Global reward: Binary query-answer accuracy r_ans = I(p* = p)

### 2.2 Execution Trajectory Regularization as MDP

The key innovation: model the entire construction-retrieval pipeline as a **sequential Markov Decision Process (S, A, T, R)**:

```
State transitions:
s0 = H (raw history) 
  → [Extraction Agent a0] → 
s1 = Mf (fine-grained memories)
  → [Profile Agent a1] → 
s2 = (M, q) (full memory set + query)
  → [Retrieval Agent a2] → 
s3 = (E'q, p) (retrieved evidence + response)
```

**Why MDP formulation matters:**
- Embeds inter-agent dependencies into state transitions
- Each agent's output becomes the next agent's input state
- Enables end-to-end gradient flow through the system
- Both local task rewards AND global system reward are computed per trajectory

### 2.3 Adaptive Credit Assignment

The hardest problem: how to assign global credit to individual agents?

**Step 1: Sample G MDP trajectories** {τi} for each input (H, q)

**Step 2: Compute ranking consistency** between each agent's local rewards and global rewards using NDCG:
- vn = NDCG(σ(R_local,n), σ(R_global))
- Intuition: If Agent n's local reward ranking matches global reward ranking, Agent n is well-aligned with global objectives

**Step 3: Softmax normalization** to get adaptive credit weights:
- wn = exp(vn) / Σ exp(vn')
- Ensures Σ wn = 1

**Step 4: Integrated reward** for each agent:
- r_final,n = r_n (local) + wn × r3 (weighted global share)

**Step 5: GRPO optimization** — each agent optimized via Group Relative Policy Optimization with integrated rewards

### Why NDCG-Based Credit Assignment Is Novel:
- Not equal splitting (naive approach loses information)
- Not counterfactual ("what if agent n was different?" — expensive)
- Instead: **ranking consistency** — cheap to compute, captures whether an agent's local improvements predict global improvements
- Agents whose local optimizations align with global objectives get more global credit → self-reinforcing alignment

## 3. Experimental Results — Exceptionally Strong

### PersonaMem Benchmark (180+ histories, 6000+ questions)

| Method | 32K | 128K | 1M |
|--------|-----|------|-----|
| Base (no memory) | 0.41 | 0.39 | 0.38 |
| RAG | 0.48 | 0.45 | 0.41 |
| CAM (prompt-based) | 0.53 | 0.50 | 0.45 |
| Mem1 (RL-based) | 0.59 | 0.57 | 0.58 |
| Memory-R1 (RL-based) | 0.58 | 0.60 | 0.60 |
| **CoMAM (ours)** | **0.64** | **0.70** | **0.66** |
| **Improvement** | **+8.5%** | **+16.7%** | **+10%** |

Key observations:
1. **RL-based > Prompt-based > No memory** — validates RL for memory optimization
2. **CoMAM > individual RL** by 8.5-16.7% — validates *joint* optimization over *independent* RL
3. **Gains increase with context length** (128K sees biggest improvement) — joint optimization matters more as complexity grows
4. **Generalizes across backbones** (Qwen and Llama families)

### Ablation Insights:
- Removing MDP formulation (optimizing agents independently) → significant drop
- Removing adaptive credit (equal global allocation) → moderate drop
- Both components are necessary for full performance

## 4. Significance for MAS Research Program

### A. The Credit Assignment Problem (connects to DD#339 Pyramid MoA, DD#338 CMAG)
CoMAM's NDCG-based credit assignment solves a problem that plagues all multi-agent systems:
- In Pyramid MoA: how to credit proposers vs. aggregators
- In CMAG: how to assign governance overhead vs. cooperation benefit
- CoMAM provides a general-purpose, efficient mechanism: **ranking consistency between local and global outcomes**

### B. Memory as Multi-Agent Infrastructure (connects to DD#337 TA-Mem, DD#338 Bureaucracy of Speed)
- TA-Mem showed tool-augmented memory for autonomous agents
- CoMAM shows that the memory system itself should be jointly optimized as a multi-agent system
- This creates a recursive structure: agents need memory → memory is managed by agents → those agents need optimization

### C. Sequential MDP for Heterogeneous Agents (connects to DD#330 OpenSWE, DD#335 EduClaw)
- OpenSWE showed environment synthesis at scale
- EduClaw showed scaling laws for educational agents
- CoMAM shows how to model heterogeneous agent pipelines as sequential MDPs
- This is a general technique applicable beyond memory: any multi-stage agent workflow can be formulated as CoMAM's MDP

### D. GRPO for Multi-Agent RL (connects to broader RL-for-MAS trend)
- GRPO (Group Relative Policy Optimization) replaces value function with group-based normalization
- CoMAM extends GRPO to multi-agent settings by adding credit assignment
- This is a significant methodological contribution — adapting single-agent RL algorithms to MAS pipelines

## 5. Novel Patterns Identified

### Pattern: "Pipeline-as-MDP"
Any multi-agent pipeline (A → B → C) can be formulated as a sequential MDP where:
- Agent outputs = state transitions
- Each agent has local rewards
- End-to-end system has global reward
- Credit assignment bridges local ↔ global

This generalizes beyond memory to: code review pipelines, document processing chains, multi-step reasoning, etc.

### Pattern: "Ranking Consistency Credit"
Use NDCG between local and global reward rankings to measure agent contribution. This:
- Is computationally cheap (no counterfactual rollouts)
- Scales to many agents (just need reward vectors)
- Is differentiable through softmax normalization
- Automatically adapts as agents improve (dynamic reweighting)

## 6. Limitations & Open Questions

1. **Sequential assumption** — assumes agents execute in fixed order. What about dynamic DAG-structured workflows?
2. **Three-agent limitation** — tested with only 3 agents. Credit assignment via NDCG may struggle with many agents (ranking becomes noisy)
3. **Single backbone per agent** — no exploration of heterogeneous model sizes across agents
4. **PersonaMem-only evaluation** — single benchmark limits generalization claims
5. **Frozen reward model** — the profile agent's reward uses a frozen LLM; what if this evaluator is misaligned?

## 7. GUS/MAST Integration

- **GUS Mechanism #18 (Memory Management):** CoMAM provides a concrete, RL-optimized implementation
- **GUS Mechanism #7 (Credit Assignment):** NDCG-based ranking consistency is a new primitive for GUS credit assignment
- **MAST Layer 2 (Agent):** Pipeline-as-MDP formalizes how individual agents compose into systems
- **MAST Layer 3 (Coordination):** Sequential MDP embeds coordination into the optimization itself
- **Law 5 (Alignment Pressure):** Local-global reward integration is literally alignment pressure instantiated as a training objective

## 8. Cross-Reference Opportunities

- **CR with DD#337 (TA-Mem):** "Memory System Optimization Spectrum" — TA-Mem's tool augmentation vs. CoMAM's joint RL
- **CR with DD#339 (Pyramid MoA):** "Credit Assignment in Multi-Agent LLM Systems" — Pyramid MoA's hierarchical routing vs. CoMAM's NDCG ranking
- **CR with DD#340 (AMRO-S):** "Optimization Paradigms for MAS" — bio-inspired (ACO) vs. RL-based (GRPO) vs. prompt-based optimization

---

*DD#341 establishes that **joint optimization of multi-agent memory systems via collaborative RL with adaptive credit assignment** produces substantial gains (8.5-16.7%) over independent optimization. The Pipeline-as-MDP and Ranking Consistency Credit patterns are broadly applicable beyond memory systems to any multi-agent pipeline.*
