# Deep-Dive #326: Symphony-Coord — Emergent Coordination via Contextual Bandits in Decentralized Agent Systems

**Paper:** [arXiv:2602.00966](https://arxiv.org/abs/2602.00966) — "Symphony-Coord: Emergent Coordination in Decentralized Agent Systems"
**Authors:** Zhaoyang Guan (Northwestern), Huixi Cao (NYU), Ming Zhong (Independent), Eric Yang, Lynn Ai, Yongxin Ni (NUS), Bill Shi (Gradient)
**Date:** Feb 1, 2026 | **Category:** cs.MA
**Status:** CRITICAL — Deep-Dive Complete

---

## Why This Paper Matters (★★★★★ CRITICAL)

Symphony-Coord represents the most principled attack on the **static role assignment problem** in multi-agent LLM systems to date. While frameworks like AutoGen, CrewAI, and MetaGPT hardcode agent roles at design time, Symphony-Coord treats agent selection as an **online contextual bandit problem**, enabling roles to emerge organically from task-agent interactions. This directly addresses three failure modes our portfolio has documented:

1. **Routing brittleness** (DD#300/AVR showed action-level routing matters, but used threshold heuristics — Symphony-Coord provides theoretical learning guarantees)
2. **Static role fragility** (DD#284/RAPS addressed this with pub-sub, but lacked formal convergence — Symphony-Coord provides sublinear regret bounds)
3. **Fault non-recovery** (DD#285/HieraMAS optimized hierarchy but couldn't self-heal — Symphony-Coord's UCB exploration naturally detects degraded agents)

**Key Insight:** The paper's central contribution isn't the LinUCB algorithm itself (well-established in bandit literature) — it's the **two-stage Beacon protocol** that makes bandit-based routing practical at scale by filtering candidates before expensive bandit computation.

---

## Core Architecture

### The Problem
Current multi-agent LLM coordination suffers from three systemic failures:
- **Routing inefficiency:** Role labels too coarse to distinguish subtle capability differences between agents
- **Distribution shift fragility:** Fixed role-task mappings can't adapt when task distributions evolve
- **Fault cascading:** When a key agent degrades, static allocation has no fallback mechanism → cascading performance collapse

### Solution: Two-Stage Dynamic Beacon Protocol

#### Stage 1: Top-L Candidate Filtering
Lightweight screening to prune the decision space before expensive bandit computation:

```
s_{j,t} = w₁ · match_score(j,t) + w₂ · prior_success(j) + w₃ · reliability(j,t)
```

- **match_score:** Cosine similarity between agent capability embeddings and subtask text embeddings (falls back to lexical similarity if embeddings unavailable)
- **prior_success:** Smoothed historical success rate
- **reliability:** Recent reliability signal (latency, availability, error rate)
- **Output:** Top-L candidate set C_t (typically L=5 from pool of 25+)

This is the practical innovation — it reduces O(N) bandit computations to O(L) while preserving the agents most likely to succeed.

#### Stage 2: LinUCB Contextual Bandit Selection
Within the filtered candidate set, LinUCB performs the final selection:

**Context vector** for each candidate:
```
x_{j,t} = [1, sim_emb(j,t), ℓ_{j,t}, T_{j,t}, P_{j,t}, u_{j,t}]ᵀ
```
Where:
- sim_emb: Embedding similarity (shared with Stage 1)
- ℓ_{j,t}: Current load
- T_{j,t}: Normalized latency
- P_{j,t}: Historical reputation
- u_{j,t}: Availability flag

**UCB score:**
```
UCB_{j,t} = x_{j,t}ᵀ θ̂_t + α_t √(x_{j,t}ᵀ A_t⁻¹ x_{j,t})
```

The exploitation term (first) routes to known-good agents; the exploration bonus (second) probes uncertain candidates to discover hidden capabilities or detect degradation.

**Online update:** After task completion, ridge regression update on A_t and b_t → continuously improving routing policy.

### Reward Signal Design
Multi-component shaped reward:
1. **Base success indicator** — Valid, non-error completion
2. **Winner bonus** — Agreement with majority-voted final output
3. **Correctness term** — When gold labels available (optional)
4. **Efficiency penalty** — Latency-based

Rewards can be **delayed** — under multi-path execution, context features are recorded during execution and rewards constructed only after task-level voting resolves. This delayed credit assignment is crucial for real deployment.

---

## Theoretical Contributions

### Sublinear Regret Bound
Under standard linear realizability assumptions (E[r_t | a_t = j] = x_{j,t}ᵀ θ*), they prove a high-probability sublinear regret bound, meaning:
- Average suboptimality decreases as experience accumulates
- System converges toward near-optimal agent allocation
- Exploration naturally diminishes as uncertainty shrinks

### Empirical Validation of Convergence
Table 4 in the paper shows **uncertainty shrinkage during pretraining**:
- sim_emb dimension: 61.1% reduction in uncertainty (most informative feature)
- Intercept and availability: ~8.6% reduction
- Load dimension: 0% reduction (constant in their stream)
- The system learns *which features matter* and focuses routing decisions accordingly

This is the first formal convergence guarantee for agent routing in LLM multi-agent systems.

---

## Experimental Results

### Main Benchmarks (Table 1)
Tested across 3 backbones (DeepSeek-V3, DeepSeek-V3-0324, GPT-5-nano) on 3 benchmarks:

| Benchmark | Best Single-Agent | Best Multi-Agent Baseline | Symphony-Coord |
|-----------|-------------------|---------------------------|----------------|
| GSM8K     | 68.5 (Self-Refine) | 81.0 (MetaGPT)          | 84.0           |
| BBH       | 69.5 (Self-Refine) | 88.0 (GPTSwarm)         | 86.0*          |
| MedicalQA | 53.0 (Synapse)    | 84.0 (MetaGPT)          | 86.0           |

*Symphony-Coord achieves best **average** accuracy across all benchmarks on every backbone, even when individual baselines win on specific tasks.

### Key Findings
1. **Largest gains on domain-specific tasks** — MedicalQA shows +33 over best single-agent, suggesting strong adaptation to specialized workloads
2. **Cold-start resilience** — Naive multi-agent routing degrades substantially in cold-start; Symphony-Coord handles this via UCB exploration
3. **Cross-domain consistency** — Unlike baselines that excel on one benchmark but fail on others, Symphony-Coord maintains stable performance

### Heterogeneity Experiments (Table 2)
- Skill heterogeneity becomes most effective with 5 agents (86% accuracy)
- LLM heterogeneity provides limited benefit beyond 3 agents
- **Insight:** Capability specialization matters more than model diversity at scale

### Ablation Study (Table 3)
Three-phase protocol (200 cold-start : 300 pretrain : 100 test):
- **UCB is the main driver** — boosts test accuracy from 51% to 73% alone
- **Top-L filtering stabilizes** UCB — combined reaches 79%
- **Subtask decomposition synergizes with UCB** — combined reaches 79%
- **Full Symphony-Coord** (all components): 86% — clear synergy among modules
- Naive heuristics (random, static, round-robin, voting) provide marginal or even negative gains

### Emergent Division of Labor (Figure 4-5)
The most fascinating result: **roles emerge without being defined**.
- Baseline: uniform ~0.2 weight per agent across plan and subtask levels
- Symphony-Coord: Agent A dominates planning; execution distributed across A, B, C
- Selection shares **evolve across phases**: exploration in cold start → specialization in pretrain → stable routing in test
- The system autonomously discovers that one agent is better at planning while others are better at execution

---

## Critical Analysis

### Strengths
1. **First formal convergence guarantee for MAS routing** — Sublinear regret bound is a genuine theoretical advance
2. **Practical two-stage design** — The Beacon filtering makes bandit-based routing feasible at scale (25+ agent pools)
3. **Self-healing property** — UCB exploration naturally detects degraded agents and routes away from them
4. **Delayed credit assignment** — Handles the real-world case where task success isn't known until voting completes
5. **Emergent specialization** — Demonstrates that fixed roles are unnecessary; optimal division of labor can be learned

### Limitations
1. **Linear reward assumption** — The theoretical guarantees rely on E[r|x] = xᵀθ*, which may not hold for complex LLM tasks with nonlinear capability-task interactions
2. **Context vector is low-dimensional** — Only 6 features (intercept, similarity, load, latency, reputation, availability). Real deployments might benefit from richer context (task difficulty, agent history, inter-agent correlations)
3. **Benchmarks are relatively simple** — GSM8K/BBH/MedicalQA are well-studied; would like to see performance on more complex agentic tasks (code generation, web navigation, tool use)
4. **Cold-start still challenging** — The 200-step cold-start phase shows performance well below pretrain/test; faster warm-up strategies (meta-learning, transfer) not explored
5. **Single-task bandit per subtask** — No explicit modeling of subtask dependencies or inter-agent synergies within a task decomposition

### Open Questions
- Can the LinUCB be replaced with a neural bandit (NeuralUCB) for richer nonlinear modeling without losing convergence guarantees?
- How does the system perform when the agent pool changes dynamically (agents joining/leaving)?
- Can the Beacon protocol be extended to hierarchical task decomposition with nested bandit selectors?

---

## Portfolio Connections

### Direct Connections
- **DD#300 (AVR — Adaptive VLM Routing):** Both treat agent/model routing as the core optimization problem. AVR uses threshold-based heuristics for cost-accuracy tradeoff; Symphony-Coord provides learning-based routing with convergence guarantees. Symphony-Coord's two-stage Beacon protocol parallels AVR's difficulty estimation + confidence probing, but with formal bandit theory backing.

- **DD#284 (RAPS — Reputation-Aware Pub-Sub):** Both aim for decentralized coordination with emergent role specialization. RAPS uses Bayesian reputation + pub-sub communication; Symphony-Coord uses LinUCB + Beacon filtering. RAPS's watchdog-based reputation tracking maps to Symphony-Coord's prior_success and reliability components in the Stage 1 score. Key difference: RAPS is communication-centric (who talks to whom), Symphony-Coord is task-routing-centric (who does what).

- **DD#285 (HieraMAS — Hierarchical MoA):** HieraMAS's intra-node optimization (selecting which sub-agents to activate) is conceptually similar to Symphony-Coord's Top-L filtering. But HieraMAS uses static tree structure while Symphony-Coord's selection is fully dynamic. Symphony-Coord could potentially be nested inside HieraMAS nodes for adaptive intra-node routing.

- **DD#325 (BASF Chemical Process Design):** Real-world industrial MAS with separation of concerns between engineering reasoning and code generation agents. Symphony-Coord could learn this division automatically rather than requiring domain-expert design of agent roles.

### Thematic Connections
- **DD#288 (UAV-MARL):** Both address decentralized task allocation under partial observability. UAV-MARL uses MARL for physical coordination; Symphony-Coord uses bandits for cognitive coordination. Bandit approach has lower sample complexity but weaker inter-agent modeling.

- **DD#279 (DIALECTIC Argumentation):** DIALECTIC routes arguments between agents via structured debate; Symphony-Coord routes tasks via bandit optimization. Both achieve emergent specialization but through different mechanisms (social choice vs. statistical learning).

- **DD#281 (AMRO-S Pheromone Routing):** Bio-inspired stigmergic routing shares the key insight with Symphony-Coord: routing should be adaptive and learned, not static. Pheromone trails are a distributed analog of LinUCB's reputation/success tracking.

### Meta-Pattern: The Routing Convergence
Symphony-Coord crystallizes what DD#300, DD#284, DD#285, and DD#281 were all reaching toward: **routing is the fundamental coordination primitive for multi-agent systems**, and it should be treated as an online learning problem with formal guarantees. The portfolio now has:
1. Threshold routing (AVR/DD#300) — fast but non-learning
2. Reputation routing (RAPS/DD#284) — learning but no convergence proof
3. Hierarchical routing (HieraMAS/DD#285) — structured but static
4. Bio-inspired routing (AMRO-S/DD#281) — adaptive but heuristic
5. **Bandit routing (Symphony-Coord/DD#326) — adaptive WITH convergence guarantees** ← theoretical ceiling

---

## Actionable Takeaways

1. **For MAS designers:** Stop hardcoding agent roles. Treat role assignment as an online learning problem. Symphony-Coord proves this converges to near-optimal allocation.

2. **For system architects:** The two-stage Beacon protocol (cheap filter → expensive bandit) is a general design pattern applicable beyond LLM agents — any system with heterogeneous executors can benefit.

3. **For theoreticians:** The linear realizability gap (6D context vs. complex task interactions) is the main frontier. Neural bandits or Bayesian deep bandits could extend this.

4. **For our codebase:** The exploration-exploitation tradeoff in agent routing is directly relevant to multi-agent orchestration in our system. A lightweight LinUCB selector could replace fixed agent assignment.

---

## Key Quotes

> "Agent selection should be treated as an online decision-making problem."

> "Symphony-Coord gradually learns to plan and execute more suitable agents through runtime data, and stably invokes more suitable candidate agents during the testing phase."

> "Effective collaboration emerges when agents are matched to tasks based on observed capabilities and contextual demand, rather than predefined identities."

---

*Filed: DD#326 | Session: s_1773654310128_2 | Date: 2026-03-16*
