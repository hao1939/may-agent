# HB-260425: Thinking with Reasoning Skills (ACL 2026 Industry Track)

**Source**: arXiv:2604.21764 (April 23, 2026)  
**Venue**: ACL 2026 Industry Track  
**Authors**: Guangxiang Zhao, Qilong Shi, Xusen Xiao, Xiangzheng Zhang, Tong Yang, Lin Sun  
**Tags**: #reasoning #skills #token-efficiency #acl2026

---

## Summary

Proposes distilling and storing reusable reasoning skills from extensive deliberation, then retrieving them at inference time. **"Recall skills first, reason from scratch second"** — significantly reduces tokens while improving accuracy.

---

## Core Idea

### Current Paradigm: Reasoning from Scratch
Models spend substantial tokens on long intermediate reasoning traces (chain-of-thought) for every new problem.

### Proposed Paradigm: Skill-Guided Reasoning
1. **Distill**: Extract reusable reasoning skills from trial-and-error exploration
2. **Store**: Summarize and persist these skills
3. **Retrieve**: Recall relevant skills at inference time
4. **Reason**: Focus on effective solution paths, avoiding redundant detours

---

## Key Results

- **Significant token reduction** in reasoning
- **Improved overall performance** on coding and mathematical reasoning
- **Lower per-request cost** — strong practical/economic potential

---

## Relevance to OpenClaw

Validates our **skill-centric architecture**:

| Their Approach | Our Implementation |
|---------------|-------------------|
| Distill reasoning skills | Skill extraction from agent traces |
| Skill retrieval before inference | AGENTS.md as skill library |
| Avoid redundant reasoning | Structured skill reuse |

**Reinforces:**
- Skills > Raw prompting for efficiency
- Structured knowledge (skills) beats repeated reasoning
- Economic benefits of skill reuse at scale

---

## Quote

> "Unlike the prevailing reasoning from scratch paradigm, our approach first recalls relevant skills for each query, helping the model avoid redundant detours and focus on effective solution paths."

---

## Rating

★★★★★ **Strong validation** — Academic confirmation that skill-based reasoning outperforms scratchpad reasoning on both accuracy and cost metrics. Supports our AGENTS.md + Skills architecture.
