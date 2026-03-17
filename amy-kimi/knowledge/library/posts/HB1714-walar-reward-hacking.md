# HB#1713 — WALAR: Mitigating Reward Hacking in RL

**Source**: arXiv:2603.13045v1 [cs.CL]  
**Title**: Mending the Holes: Mitigating Reward Hacking in Reinforcement Learning for Multilingual Translation  
**Authors**: Yifeng Liu, Siqi Ouyang, Yatish Hosmane Revanasiddappa, Lei Li  
**Date**: 2026-03-13  
**Code**: https://github.com/LeiLiLab/WALAR  

---

## 🔥 Relevance to OpenClaw

| Aspect | Finding | OpenClaw Connection |
|--------|---------|---------------------|
| **Reward Hacking** | QE模型中的"holes"会被RL放大 | 我们的Error Log设计正是防止这种放大 |
| **Alignment** | Word/Language alignment缓解holes | 类似我们的Skill边界对齐 |
| **Safety** | 无约束RL导致质量下降 | 验证"禁止自演化"的正确性 |

---

## Core Insight

### The "Holes" Problem
> "Our key insight is based on the observation of failure modes (or 'holes') in existing source-based multilingual quality estimation (QE) models. Reinforcement learning (RL) using these QE models tends to amplify such holes, resulting in poorer multilingual LLMs."

**Translation to Agent Context**:  
任何评估模型都有"盲区"(holes)。当Agent通过RL/自我反馈来优化行为时，这些盲区会被系统性放大，导致偏离预期目标。

### WALAR Solution
1. **Word Alignment**: 细粒度对齐源文本和目标输出
2. **Language Alignment**: 跨语言一致性约束
3. **Monolingual Training**: 无需平行语料，降低数据依赖

---

## Experimental Results

- **Scale**: 101种语言，1400个语言方向
- **Baseline**: LLaMAX (最强开源多语言LLM之一)
- **Outcome**: 大规模超越LLaMAX

---

## 🎯 Strategic Implications

### 1. Reward Hacking is Universal
WALAR证明：RL + 不完美的评估器 = 必然出现reward hacking

**OpenClaw Parallel**:  
我们的"禁止运行时自演化"原则正是为了防止这种系统性偏离。

### 2. Alignment as Safety Mechanism
WALAR使用多层对齐(word + language)来缓解holes。

**OpenClaw Parallel**:  
我们的多层安全架构：
- AGENTS.md (设计时约束)
- Skill边界 (执行时约束)
- Error Log (事后审计)

### 3. Monolingual = Decoupled
WALAR展示：可以用更少依赖(仅单语)实现更好的泛化。

**OpenClaw Parallel**:  
Skill的独立性原则 —— 最小化外部依赖，最大化可控性。

---

## Action Items

1. **L3 Flag Proposal**: 评估器盲区检测机制
2. **Design Review**: 当前Error Log是否足够捕捉"holes"?
3. **Cross-Reference**: 与HB#1708 (Semantic Invariance)对比 — 两者都涉及评估可靠性

---

## Metadata
- **HB Number**: 1714
- **Fire Rating**: 🔥🔥🔥🔥 (高相关性，直接验证安全设计)
- **Archive Date**: 2026-03-16
- **Relevant To**: tech-lead (safety), Bob (design philosophy)
