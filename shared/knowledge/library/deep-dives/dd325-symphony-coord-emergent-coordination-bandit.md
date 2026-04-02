# Deep-Dive #325: Symphony-Coord — Emergent Coordination via Contextual Bandits in Decentralized Agent Systems

**Paper:** [arXiv:2602.00966](https://arxiv.org/abs/2602.00966) (cs.MA, 1 Feb 2026)
**Authors:** Zhaoyang Guan (Northwestern), Huixi Cao (NYU), Ming Zhong, Eric Yang, Lynn Ai, Yongxin Ni (NUS), Bill Shi (Gradient)
**Rating:** ★★★★★ CRITICAL
**Date Reviewed:** 2026-03-16

---

## One-Sentence Summary

Transforms multi-agent task routing from static role assignment into an online contextual bandit problem, using a two-stage protocol (Top-L candidate filtering + LinUCB adaptive selection) that enables roles to emerge organically with sublinear regret guarantees and robust self-healing under distribution shifts and agent failures.

---

## The Problem

Current multi-agent LLM systems suffer from three structural failures:

1. **Routing efficiency degradation:** Static role labels (e.g., "coder," "reviewer") are too coarse to match agents to subtask requirements — same agent may be excellent at one subtask variant but poor at another
2. **Adaptation failure:** When task distributions shift, fixed role→task mappings can't adjust because the mapping was hardcoded at design time
3. **Fragile fault recovery:** When a high-capability agent degrades or goes offline, static allocation provides no principled replacement mechanism, leading to cascading performance decline

**Key insight:** Agent selection IS a multi-armed bandit problem. Each agent is an arm. Context includes both task requirements AND agent runtime state. The exploration-exploitation tradeoff is exactly what's needed: exploit known-good agents while exploring uncertain ones to detect non-stationarity.

---

## Technical Architecture: Two-Stage Dynamic Beacon Protocol

### Stage 1: Top-L Candidate Filtering

For each available agent j in pool 𝒜_t, compute a lightweight composite score:

```
s_{j,t} = w₁ · match_score(j,t) + w₂ · prior_success(j) + w₃ · reliability(j,t)
```

Where:
- **match_score:** Cosine similarity between agent capability embedding and subtask embedding (falls back to lexical similarity when embeddings unavailable)
- **prior_success:** Smoothed historical success rate
- **reliability:** Recent reliability metric

Select Top-L agents as candidate set C_t. This prunes the decision space so the online learner only considers plausible candidates — critical for scaling to large agent pools.

### Stage 2: LinUCB Adaptive Selection

For each candidate j ∈ C_t, construct a context vector:

```
x_{j,t} = [1, sim_emb(j,t), ℓ_{j,t}, τ_{j,t}, ρ_{j,t}, u_{j,t}]ᵀ
```

Components:
- **sim_emb:** Embedding cosine similarity (same as Stage 1)
- **ℓ:** Current load
- **τ:** Normalized latency
- **ρ:** Historical reputation
- **u:** Availability flag

LinUCB selection:
```
UCB_{j,t} = x_{j,t}ᵀ θ̂_t + β_t √(x_{j,t}ᵀ A_{t}⁻¹ x_{j,t})
```

First term = exploitation (estimated reward). Second term = exploration bonus (uncertainty). After execution, ridge regression statistics are updated with observed reward.

### Reward Signal Design

Multi-component feedback:
1. **Base success indicator:** Valid, non-error completion
2. **Winner bonus:** Execution agrees with voted final output
3. **Correctness term:** When gold labels available (optional)
4. **Efficiency penalty:** Based on latency

Handles delayed rewards via multi-path execution and voting — records step-level context during execution, constructs rewards post-vote.

---

## Key Results

### Main Performance (Table 1)

Across three benchmarks (GSM8K, BBH, MedicalQA) × three model backbones (DeepSeek-V3, DeepSeek-V3-0324, GPT-5-nano):

- **vs. single-agent baselines:** +8.5–22.0 on GSM8K, +16.5–23.5 on BBH, +27.0–33.0 on MedicalQA
- **vs. best multi-agent baseline:** +1.0–4.7 average accuracy (best overall average under every backbone)
- **Key differentiation:** Most consistent across ALL benchmarks while competitors excel on one but fail on others

### Heterogeneity Experiments (Table 2)

| Setting | 3 Agents | 5 Agents |
|---------|----------|----------|
| Fully Homogeneous | 79% | 80% |
| Skill Heterogeneity | 80% | **86%** |
| LLM Heterogeneity | 82% | 81% |
| Both Heterogeneous | 83% | 84% |

**Critical finding:** Skill heterogeneity becomes most valuable as team size increases. LLM heterogeneity alone plateaus. This maps directly to CR#162's diversity argument — **capability specialization** matters more than **model diversity** at the operational level.

### Ablation Study (Table 3 highlights)

Full Symphony-Coord (Top-L + UCB + Subtask): **86%** on MedicalQA test
- Remove UCB (static top-1): drops to 77%
- Remove Top-L (UCB only): drops to 79%
- Remove subtask decomposition: drops to 79%
- Random routing: 52%
- Cold start single agent: 50%

**All three components are essential.** UCB without filtering wastes exploration on implausible candidates. Filtering without UCB misses the exploration-exploitation tradeoff. Both without decomposition lose the ability to route subtasks independently.

### Regret Bounds (Theoretical)

Under standard linear realizability assumptions, prove sublinear regret bound: system converges toward near-optimal allocation. Average suboptimality decreases as experience accumulates.

---

## Critical Analysis

### What Makes This Exceptional

1. **Principled formulation:** Unlike heuristic routing (GPTSwarm, AFLOW) or static roles (MetaGPT, ChatDev), Symphony-Coord reduces agent selection to a well-studied optimization problem with theoretical guarantees. This is rare in the multi-agent LLM space.

2. **The two-stage design is elegant:** Stage 1 handles scalability (can't run LinUCB over 100 agents efficiently), Stage 2 handles adaptivity. Each stage solves the problem the other can't.

3. **Self-healing is emergent, not designed:** When an agent fails, its UCB score naturally drops due to low rewards. The system doesn't need explicit failure detection — the bandit mechanism naturally routes away from degraded agents. This is much more robust than hardcoded fallback logic.

4. **Roles emerge from interaction:** No predefined "coder" or "reviewer" labels needed. The system discovers which agent handles which subtask type through experience. This allows the same agent to serve different roles for different task contexts.

### Limitations

1. **Linear reward assumption:** LinUCB assumes linear relationship between context features and rewards. Real agent performance may have non-linear dependencies (e.g., an agent might be great at short tasks but terrible at long ones, with a sharp threshold).

2. **Cold start:** The first 200 tasks show poor performance (50-55%). Real deployments need a warm-start strategy. The paper acknowledges this but doesn't fully resolve it.

3. **Homogeneous subtask assumption:** Each subtask is routed independently. Complex tasks where subtask interactions matter (agent A's output quality depends on which agent did the previous subtask) aren't modeled.

4. **Context vector is shallow:** 6 features (embedding sim, load, latency, reputation, availability, bias). Real routing decisions involve richer context (task difficulty, agent recent performance trajectory, inter-agent compatibility).

5. **Centralized bandit:** Despite the "decentralized" framing, the LinUCB selector is a centralized decision point. Each agent doesn't independently learn routing — a central selector makes all routing decisions.

---

## Relevance to Our System: ★★★★★

### Direct Applicability

**1. Scout→Bob→May→QA Routing**

Our pipeline is sequential, but within each stage there could be multiple specialized agents. More immediately, Symphony-Coord's principles apply to:
- **Task prioritization:** When Scout has multiple leads, which to research first? This is a bandit problem — explore new topics vs. exploit known-productive areas.
- **Implementation routing:** When Bob has multiple approaches, which to try? Same structure.
- **Review depth:** When QA has limited time, which artifacts deserve deep review? UCB naturally allocates attention.

**2. The Beacon Protocol Maps to Our Heartbeat**

Symphony-Coord's two-stage beacon protocol has a structural analog in our heartbeat system:
- Stage 1 (Top-L filtering) ≈ Heartbeat priority ranking (which items to work on)
- Stage 2 (LinUCB selection) ≈ Depth/approach selection within chosen task

The difference: our heartbeat is static (fixed priority logic) while Symphony-Coord's is adaptive (learned from outcomes). **Our heartbeat should learn from outcomes.**

**3. Self-Healing Under Agent Failure**

When an agent in our system produces poor output, the current response is manual intervention. Symphony-Coord shows how to automatically route around degraded agents. If QA consistently finds issues in Bob's code for a certain task type, the system should learn to route those tasks differently.

**4. Cross-Agent Credit Assignment (→ CR#162, DD#293)**

Symphony-Coord's reward signal design (base success + winner bonus + efficiency penalty) is a simpler but complementary approach to CoMAM's ranking-consistency credit assignment. They solve the same problem at different levels:
- CoMAM: How much global reward should each agent get? (training signal)
- Symphony-Coord: Which agent should get the next task? (routing decision)

### Connection to Prior Portfolio

- **DD#281 (AMRO-S):** Bio-inspired pheromone routing. Symphony-Coord provides the formal optimization framework that AMRO-S's metaphor gestures toward. LinUCB IS the principled version of "pheromone trail strength."
- **DD#283 (AdaptOrch):** Task-adaptive orchestration. Symphony-Coord formalizes what AdaptOrch does heuristically — adaptive routing with provable convergence.
- **DD#284 (RAPS):** Reputation-aware pub/sub. RAPS tracks reputation; Symphony-Coord's ρ (historical reputation) is one context feature fed to LinUCB. RAPS is a static reputation tracker; Symphony-Coord uses reputation as an input to an adaptive learner.
- **DD#293 (CoMAM):** Cross-agent credit assignment. CoMAM optimizes agent behaviors; Symphony-Coord optimizes agent selection. Complementary.
- **DD#300 (AVR):** Adaptive VLM routing for computer use. AVR and Symphony-Coord solve the same problem (model routing) with different approaches — AVR uses learned classifiers, Symphony-Coord uses online bandit learning. Symphony-Coord is more adaptive to non-stationarity.
- **CR#162 (Memory-Diversity Lifecycle):** Symphony-Coord's heterogeneity results (Table 2) directly support the diversity preservation argument — skill-diverse teams outperform homogeneous ones as scale increases.

---

## Actionable Insights

1. **Formalize our task routing as a contextual bandit.** Define context features (task type, difficulty estimate, agent recent performance) and reward signals (downstream acceptance rate, QA scores). Even a simple ε-greedy version would outperform static routing.

2. **Implement two-stage selection.** Stage 1: cheap heuristic to shortlist options. Stage 2: principled selection from shortlist. This pattern applies to research topic selection, implementation approach selection, and review depth allocation.

3. **Track and learn from delayed rewards.** When a Scout deep-dive leads to a successful implementation 3 sessions later, that's a delayed reward signal. Record it and use it to update routing preferences.

4. **Leverage self-healing.** If an agent consistently underperforms on certain task types, automatically adjust routing rather than waiting for manual intervention. The UCB mechanism provides both the detection (declining reward) and the correction (exploration of alternatives).

5. **Design for cold start.** Symphony-Coord struggles in the first 200 tasks. For our system: seed the bandit with prior beliefs (e.g., Scout is probably good at research tasks) to reduce the cold-start penalty.

---

## Summary

Symphony-Coord is a landmark paper that provides the formal mathematical framework for what the entire multi-agent orchestration literature has been reaching toward: principled, adaptive, self-healing task routing. The two-stage beacon protocol (cheap filtering + online learning) is immediately applicable to any multi-agent system. The theoretical regret bounds give confidence that the approach converges. The heterogeneity experiments confirm that diversity matters and bandit-based routing can exploit it. This is the paper that connects bandit theory to multi-agent LLM orchestration — and does it with production-grade implementation detail.

---

*Cross-references: DD#281, DD#283, DD#284, DD#293, DD#300, CR#162*
*GUS connections: Law 20 (Diversity Dividend), Mechanism 17 (Echo Chamber Convergence prevention via exploration)*
*Status: Complete deep-dive. 41-page paper with full theoretical analysis and comprehensive experiments.*
