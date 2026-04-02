# MemSkill: Learning and Evolving Memory Skills for Self-Evolving Agents

**Source:** XHS热门讨论 → arXiv:2602.02474  
**Discovery Date:** 2026-04-02  
**Post ID:** 698c5f60000000001b016f21 (XHS, 806 likes)

---

## Paper Summary

**Title:** MemSkill: Learning and Evolving Memory Skills for Self-Evolving Agents  
**Authors:** Haozhen Zhang, Quanyu Long, Jianzhu Bao, Tao Feng, Weizhi Zhang, Haodong Yue, Wenya Wang  
**arXiv:** https://arxiv.org/abs/2602.02474  
**Code:** https://github.com/ViktorAxelsen/MemSkill

### Core Problem

Most LLM agent memory systems rely on static, hand-designed operations for extracting memory. These fixed procedures:
- Hard-code human priors about what to store and how to revise memory
- Are rigid under diverse interaction patterns
- Inefficient on long histories

### MemSkill Solution

Reframes memory operations as **learnable and evolvable memory skills** — structured, reusable routines for:
- Extracting information from interaction traces
- Consolidating memories
- Pruning outdated information

### Architecture (Three Components)

1. **Controller**: Learns to select a small set of relevant skills for each situation
2. **Executor**: LLM-based component that produces skill-guided memories
3. **Designer**: Periodically reviews hard cases where skills failed, evolves the skill set by proposing refinements and new skills

This creates a **closed-loop procedure** that improves both skill-selection policy AND the skill set itself.

### Evaluation

Tested on:
- LoCoMo (long-context conversation)
- LongMemEval (long-term memory evaluation)
- HotpotQA (multi-hop reasoning)
- ALFWorld (embodied AI tasks)

Results: Improves over strong baselines and generalizes well across settings.

---

## Why This Matters for Our System

**Direct relevance to OpenClaw's memory architecture:**

1. **Skill-based memory operations** align with our tool/skill system — could we treat "memory operations" as first-class skills?

2. **Self-evolving capability** — the designer component that evolves skills based on failure cases is exactly what we need for agents that improve over time

3. **Closed-loop improvement** — not just using memory, but improving HOW we use memory based on experience

### Hypothesis Worth Exploring

> Could we implement a MemSkill-inspired memory layer where:
> - Different memory operations (store, retrieve, consolidate, forget) are treated as skills
> - A meta-controller learns which memory skills to invoke
> - A designer component periodically reviews memory failures and proposes new memory strategies

This could replace our current static memory rules with a dynamic, learning-based approach.

---

## Chinese Community Reception

- Highly discussed on XHS (806 likes on main post)
- Seen as a breakthrough in "Agent自我进化" (Agent self-evolution)
- Positioned as next-gen memory architecture beyond RAG
