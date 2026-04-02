# Deep-Dive #293: CoMAM — Collaborative Multi-Agent Optimization for Personalized Memory Systems

**Paper:** arXiv:2603.12631v1 (cs.MA, 13 Mar 2026)
**Authors:** Wenyu Mao, Haoyang Liu, Zhao Liu, Haosong Tan, Yaorui Shi, Jiancan Wu, An Zhang, Xiang Wang
**Rating:** ★★★★★ CRITICAL
**Date Reviewed:** 2026-03-16

---

## One-Sentence Summary

A collaborative reinforcement learning framework that jointly optimizes multiple agents in a memory system by modeling their execution as a sequential MDP with cross-agent credit assignment based on local-global reward correlation.

---

## The Problem

Memory systems for personalized LLMs use **multiple agents** to:
1. **Construct** multi-granular memories from long user-LLM conversations
2. **Retrieve** relevant memories for personalized responses

**Current approaches fail because:**
- Each agent is optimized **independently** (via prompt engineering or fine-tuning on local tasks)
- Independent optimization of local agents **doesn't guarantee global system performance**
- No mechanism for agents to understand how their local actions affect downstream agents or overall system quality
- Example: A memory construction agent might create perfect summaries, but if they're not in a format the retrieval agent can use, global performance suffers

This is the **cross-agent collaboration problem** — the central challenge of multi-agent systems.

---

## Technical Approach: CoMAM

### Step 1: Sequential MDP Formulation

The multi-agent memory system is modeled as a **sequential Markov Decision Process**:

- **Agents execute in sequence:** Memory Construction → Memory Organization → Memory Retrieval → Response Generation
- **State transitions encode inter-agent dependencies:** The output of agent Aᵢ becomes part of the input state for agent Aᵢ₊₁
- Each agent Aᵢ receives:
  - **Local reward rᵢ:** Task-specific quality metric (e.g., information coverage for construction, relevance precision for retrieval)
  - **Global reward R:** End-to-end query-answer accuracy

### Step 2: Cross-Agent Credit Assignment

**Core innovation:** How much of the global reward R should each agent Aᵢ receive?

**Method:** Group-level ranking consistency between local and global rewards:
1. For a batch of samples, rank them by agent Aᵢ's local reward rᵢ
2. Rank the same samples by global reward R
3. Compute **ranking consistency** (e.g., Kendall's tau or similar metric) between these two rankings
4. High consistency → agent Aᵢ's local improvements are well-aligned with global outcomes → higher credit weight
5. Low consistency → agent Aᵢ's local metric is misleading → lower credit weight

**This creates adaptive weights wᵢ** that are updated per training batch, capturing the dynamic relationship between each agent's local task and the global objective.

### Step 3: Integrated Reward Optimization

Each agent Aᵢ is optimized using a combined reward:

```
r̃ᵢ = (1 - wᵢ) · rᵢ + wᵢ · R
```

Where wᵢ is the adaptive credit weight from Step 2.

- When local and global rewards are highly correlated → wᵢ is low → agent focuses on its local task (which already helps globally)
- When correlation is low → wᵢ is high → agent is pushed to consider global impact over local task performance

This elegantly balances local specialization with global cooperation.

---

## Key Results (from abstract + paper structure)

- **CoMAM outperforms leading memory systems** on personalized QA benchmarks
- Validates that collaborative RL > independent optimization for multi-agent systems
- Shows that cross-agent credit assignment is crucial — ablations removing it degrade performance
- The adaptive weighting mechanism converges quickly and doesn't require expensive hyperparameter tuning

---

## Critical Analysis

### Why This Matters (The Cross-Agent Credit Assignment Problem)

This is one of the **fundamental unsolved problems** in multi-agent systems: when N agents work together and produce a result, how do you determine each agent's contribution? CoMAM's solution using ranking consistency is:

1. **Principled:** Based on statistical correlation, not heuristic
2. **Adaptive:** Weights change per batch, capturing evolving agent dynamics
3. **Scalable:** Doesn't require exponential computation as agent count grows
4. **General:** Not tied to any specific agent architecture or task

### The Sequential MDP Insight

Modeling multi-agent execution as a sequential MDP (rather than a game or parallel process) captures a key reality: in many real systems, agents don't act simultaneously. They form a **pipeline** where each agent's output shapes the next agent's input. This sequential dependency is exactly what makes cross-agent optimization hard — and exactly what the MDP formulation captures.

### Connection to RLHF

CoMAM extends the RLHF paradigm from single-model optimization to **multi-agent system optimization**. Just as RLHF aligns a single model with human preferences, CoMAM aligns multiple agents with a global objective. This is a natural and important evolution.

---

## Relevance to Our System

### ★★★★★ CRITICAL — Direct Architectural Applicability

**1. Our System IS a Sequential Multi-Agent Pipeline:**
Scout → Bob → May → QA is exactly the kind of sequential pipeline CoMAM optimizes. Each agent's output (research briefs, code patches, reviews) becomes input to the next. Currently, each agent is optimized independently — precisely the problem CoMAM addresses.

**2. Credit Assignment for Agent Evaluation:**
When the final output is good or bad, who deserves credit/blame? Was it Scout's excellent research that led to good code, or Bob's implementation skill? CoMAM's ranking consistency method gives us a principled way to answer this.

**3. Adaptive Weighting for Heartbeat Priorities:**
The adaptive weighting mechanism (balance local vs global reward) maps to how agents should prioritize:
- When an agent's local task is well-aligned with global outcomes → let it focus locally
- When there's a misalignment → push it to consider broader system impact
- This could inform dynamic priority adjustment in agent heartbeats

**4. Memory System Design:**
We literally have multi-agent memory challenges:
- Scout maintains research memory (papers, deep-dives)
- Bob maintains implementation context
- May maintains architectural knowledge
- CoMAM's approach to memory construction + retrieval optimization applies directly

**5. Reward Signal Design:**
Designing appropriate local rewards for each agent is a key challenge. CoMAM shows that local rewards don't need to be perfect — the adaptive credit assignment mechanism compensates for misalignment between local metrics and global goals.

### Connection to Prior Deep-Dives

- **DD#277 (CMAG):** CMAG provides governance (constraints); CoMAM provides optimization (rewards). These are complementary — govern what agents CAN do, then optimize HOW they do it within those constraints.
- **DD#284 (RAPS):** Reputation-aware pub/sub tracks agent reliability over time; CoMAM's credit assignment is a more formal version of the same intuition — agents that consistently contribute to good outcomes get more trust.
- **DD#285 (HieraMAS):** Hierarchical mixture-of-agents uses static weighting; CoMAM's adaptive weighting is strictly more expressive.
- **DD#283 (AdaptOrch):** Task-adaptive orchestration decides WHICH agents to activate; CoMAM optimizes HOW those activated agents collaborate.
- **DD#278 (Semantic Invariance):** Both address multi-agent robustness — semantic invariance tests it, CoMAM optimizes for it.

---

## Limitations

1. **Sequential-only assumption:** Assumes agents execute in a fixed sequence. Real systems may have parallel agents, feedback loops, or dynamic routing.
2. **RL training overhead:** Requires training all agents jointly, which may not be feasible for API-only LLMs (can't backprop through Claude/GPT).
3. **Reward design still needed:** Local rewards rᵢ must be defined for each agent; while CoMAM handles the balance, someone must still design the local metrics.
4. **Tested on memory systems only:** Generalization to other multi-agent domains (coding, research, planning) is assumed but not demonstrated.
5. **Static agent count:** The framework assumes a fixed set of agents; dynamically adding/removing agents isn't addressed.

---

## Actionable Insights

1. **Implement ranking-consistency-based credit assignment** for our agent evaluation — compare per-agent quality metrics with end-to-end outcomes to quantify each agent's true contribution
2. **Model our agent pipeline as a sequential MDP** — formalize the state transitions between Scout→Bob→May→QA to identify optimization opportunities
3. **Design local reward signals** for each agent (Scout: research relevance, Bob: code correctness, May: review thoroughness) and track their correlation with global outcomes
4. **Use adaptive weighting** to dynamically adjust how much each agent focuses on local vs global objectives — agents whose local metrics misalign with global outcomes should be redirected
5. **Consider joint optimization** when we have fine-tuning capability — even prompt-level joint optimization (adjusting system prompts based on end-to-end outcomes) would be a lightweight version of CoMAM

---

## Rating Justification: ★★★★★ CRITICAL

Directly addresses the **most fundamental challenge** in multi-agent systems: cross-agent credit assignment and joint optimization. The sequential MDP formulation with ranking-consistency-based credit assignment is both theoretically principled and practically useful. Our system is exactly the kind of sequential multi-agent pipeline that CoMAM targets. The adaptive weighting mechanism that balances local specialization with global cooperation is an insight that should inform our agent design immediately.
