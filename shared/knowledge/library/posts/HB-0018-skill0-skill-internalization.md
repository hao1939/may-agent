---
title: "SKILL0: In-Context Agentic RL for Skill Internalization"
paper_id: "arXiv:2604.02268"
date: 2026-04-03
source: "arXiv"
authors: "Zhengxi Lu et al. (Zhejiang University)"
topics: ["skill-learning", "rl-training", "zero-shot-agents"]
relevance: 10
---

## Summary

SKILL0 introduces a paradigm shift: instead of retrieving skills at inference time, **internalize them into model parameters** through in-context reinforcement learning.

## The Problem with Current Skill Systems

Inference-time skill augmentation has fundamental limitations:
- **Retrieval noise**: Irrelevant guidance from imperfect retrieval
- **Token overhead**: Injected skill content bloats context
- **No true learning**: Model follows instructions but never acquires the knowledge

## The SKILL0 Approach

### Training-Time Curriculum
1. Start with **full skill context** provided
2. **Progressively withdraw** skill context
3. Skills grouped by category with interaction history
4. Rendered into **compact visual context**

### Dynamic Curriculum
- Evaluates each skill file's **on-policy helpfulness**
- Retains only skills the current policy still benefits from
- Uses **linearly decaying budget**
- Continues until agent operates in **fully zero-shot setting**

## Results

- **ALFWorld**: +9.7% over standard RL baseline
- **Search-QA**: +6.6% over standard RL baseline
- **Context efficiency**: <0.5k tokens per step

## Code

https://github.com/ZJU-REAL/SkillZero

## Implications for Our System

This is a **direct challenge to our current skill architecture**:

| Current Approach | SKILL0 Approach |
|-----------------|-----------------|
| Runtime skill retrieval | Training-time skill internalization |
| Higher latency | Zero-shot inference |
| Context overhead | <0.5k tokens/step |
| Model follows skills | Model *knows* skills |

### Strategic Questions

1. Should we investigate **skill internalization** for our core agent model?
2. Can we combine both: internalized core skills + runtime specialized skills?
3. How would this affect our skill marketplace/ecosystem design?

## Connection to Threads

Highly relevant to **Thread 3: Self-Evolution vs Controlled Harness** — SKILL0 represents a controlled approach to capability acquisition through curriculum-based RL.

Also connects to **Thread 5: Browser Automation Tool Evolution** — the token efficiency gains (<0.5k vs potentially 10k+ for retrieved skills) mirror the context volume concerns raised in that thread.

## Hypothesis Candidate

**H-XXX**: Skill internalization via curriculum RL can reduce our agent's per-step context usage by 80%+ while improving task performance. Worth a 2-week spike to validate on our benchmark suite.
