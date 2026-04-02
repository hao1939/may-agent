# Deep Dive #276: CoMAM — Collaborative Multi-Agent Optimization for Personalized Memory

**Paper:** arXiv:2603.12631 — "Collaborative Multi-Agent Optimization for Personalized Memory System"
**Authors:** Wenyu Mao, Haoyang Liu, Zhao Liu, Haosong Tan, Yaorui Shi, Jiancan Wu, An Zhang, Xiang Wang
**Date:** March 13, 2026
**Relevance:** ★★★★★ — Cracks the joint optimization problem for heterogeneous multi-agent systems via RL

## Core Problem

Memory systems for personalized LLMs use multiple specialized agents (extraction, profile, retrieval), but existing approaches optimize each agent independently. This creates a critical failure mode: independently optimized agents whose strategies **conflict when composed**. Examples:
- Extraction agent stores redundant/noisy content → impairs retrieval
- Retrieval agent over-filters → misses critical details from construction
- Even with converged local rewards, combined system consistently underperforms joint optimization

**Key insight:** Independent optimization treats the system as a "collection of experts" rather than a "collaborative team" — and the team always wins.

## CoMAM Framework: Three Innovations

### 1. Sequential MDP Formulation (Execution Trajectory Regularization)
Regularizes the heterogeneous, asynchronous execution of 3 agents as a sequential MDP:

| Step n | Agent | State s_n | Action a_n | Local Reward r_n |
|---|---|---|---|---|
| 0 | Extraction | Raw history H | Extract fine-grained memories | Coverage + F1 (α=0.8) |
| 1 | Profile | Fine-grained memories M_f | Abstract coarse-grained profiles | LLM-judged quality ∈[0,1] |
| 2 | Retrieval | (Memories M, query q) | Retrieve top-k + generate answer | Precision + F1 (β=0.2) |
| 3 | (Global) | (Retrieved info, response p) | — | Exact match accuracy |

**Why this matters:** By embedding inter-agent dependencies into state transitions (output of agent n = input state of agent n+1), it creates end-to-end differentiable optimization despite heterogeneous agent architectures.

### 2. Adaptive Credit Assignment via NDCG Ranking Consistency
- For each input, sample G MDP trajectories → collect local rewards R_local,n and global rewards R_global
- Compute ranking consistency: v_n = NDCG(σ(R_local,n), σ(R_global))
- Normalize to weights: w_n = exp(v_n) / Σ exp(v_n')
- **Intuition:** If agent n's local reward ranking closely predicts the global reward ranking, that agent has high contribution → gets more global credit
- **Key advantage over equal division:** Prevents credit assignment ambiguity that causes high variance and unstable convergence

### 3. GRPO-Based Joint Optimization
Each agent optimized with combined signal:
```
r_final,n = r_local,n + w_n × r_global
```
Uses GRPO (no separate critic needed), with group-relative normalization for advantages.

## Results

Evaluated on LongMemEval benchmark (long-term personalized conversation):
- **CoMAM significantly outperforms all leading memory systems** including MemAgent, Mem-α, Mem1
- **Joint optimization >> independent optimization** across all conversation history lengths
- Ablation confirms both MDP regularization and adaptive credit assignment are essential
- Removing either component degrades to near-independent-optimization levels

## Two Critical Insights

### Insight 1: Credit Assignment Matters More Than Architecture
Equal global reward distribution performs poorly — it introduces ambiguity. The NDCG-based adaptive weighting provides agents with clear optimization signals proportional to their actual system contribution.

### Insight 2: MDP Formulation Enables Inter-Agent Dependency Learning
Without the MDP structure, agents learn in isolation. With it, the extraction agent learns that its output quality directly affects retrieval performance, and adjusts accordingly. This is implicit curriculum learning through structured state transitions.

## Cross-References to Our Portfolio

| Connection | Paper | Relationship |
|---|---|---|
| Multi-agent optimization | DD#254 41-87% failure | CoMAM directly addresses inter-agent coordination failures |
| GRPO for agents | DD#271 AgentRM | Both use GRPO variants; CoMAM extends to multi-agent joint optimization |
| Memory systems | DD#158 MemoryBank | CoMAM provides the optimization framework that memory architectures need |
| Credit assignment | DD#245 MARL credit | CoMAM's NDCG-based mechanism is novel — most MARL uses Shapley values or VDN |
| Agent self-evolution | DD#272 Steve | Both use RL for agent improvement; CoMAM does it jointly across agents |
| Collaborative MAS | Synthesis #16 | CoMAM validates that collaboration > independent optimization |
| Reward design | DD#262 Reward shaping | The local+global reward combination with adaptive weights is a practical reward design pattern |

## Significance for P82

**Very high.** CoMAM provides a **general recipe for jointly optimizing any multi-agent system:**
1. Frame heterogeneous agent execution as sequential MDP
2. Define local task rewards per agent + global system reward
3. Use ranking consistency to adaptively assign global credit
4. Optimize all agents jointly with combined rewards via GRPO

This is directly applicable to P82's own multi-agent architecture. The insight that independently-optimized agents systematically underperform jointly-optimized ones is a key design principle.

**Practical takeaway:** When building multi-agent systems, don't just optimize each agent on its own task — embed inter-agent dependencies and use global performance signals to align local optimization.

---
*Deep Dive #276 — Scout, Session s_1773625031030_832, 2026-03-16*
