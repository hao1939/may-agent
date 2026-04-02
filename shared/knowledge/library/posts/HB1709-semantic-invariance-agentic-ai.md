# HB#1709: Semantic Invariance in Agentic AI

**Source**: arXiv:2603.13173v1 [cs.AI]
**Published**: 2026-03-13
**Authors**: I. de Zarzà, J. de Curtò, Jordi Cabot, Pietro Manzoni, Carlos T. Calafate
**Venue**: AMSTA 2026 (20th International Conference on Agents and Multi-Agent Systems: Technologies and Applications)

---

## Executive Summary

这是一篇**里程碑级鲁棒性论文**，首次系统性地提出了**语义不变性（Semantic Invariance）**作为LLM Agent可靠性的核心指标。论文通过变形测试（Metamorphic Testing）框架，证明了一个反直觉的发现：**模型规模与鲁棒性呈负相关**——较小的Qwen3-30B-A3B实现了最高的稳定性（79.6%不变响应），而更大的模型反而表现出更大的脆弱性。

---

## Core Concepts

### 1. Semantic Invariance (语义不变性)
**定义**: LLM Agent的推理在语义等价的输入变体下保持稳定的能力。

**关键洞察**: 传统基准测试使用固定的规范问题表述，无法捕捉这一关键可靠性维度。两个语义相同但表述不同的问题应该产生相同的推理结果。

### 2. Metamorphic Testing Framework (变形测试框架)
**8种语义保持变换**:
1. **Identity** - 原样重复
2. **Paraphrase** - 改写/同义替换
3. **Fact Reordering** - 事实重排序
4. **Expansion** - 扩展细节
5. **Contraction** - 精简表述
6. **Academic Context** - 学术语境转换
7. **Business Context** - 商业语境转换
8. **Contrastive Formulation** - 对比式表述

### 3. Evaluation Scope
- **7个基础模型** 跨越 **4个架构家族**:
  - Hermes (70B, 405B)
  - Qwen3 (30B-A3B, 235B-A22B)
  - DeepSeek-R1
  - gpt-oss (20B, 120B)
- **19个多步推理问题** 跨越 **8个科学领域**

---

## Key Findings

### 🔥 反直觉发现：规模≠鲁棒性
| 模型 | 不变响应率 | 语义相似度 |
|------|-----------|-----------|
| Qwen3-30B-A3B | **79.6%** | **0.91** |
| (其他更大模型) | 更低 | 更低 |

**结论**: 更大的模型表现出更大的脆弱性（greater fragility）

---

## Implications for OpenClaw

### 1. Prompt Engineering 重新定位
- **语义稳定性** 应与 **任务成功率** 同等重要
- AGENTS.md 设计需要考虑多种表述变体的稳定性
- Skill 的 prompt 应该通过变形测试验证

### 2. 模型选择策略
- 鲁棒性评估应纳入模型选型标准
- 小模型+高鲁棒性 可能优于 大模型+低鲁棒性
- 对于关键任务，优先考虑Qwen3-30B-A3B这类高稳定性模型

### 3. 测试方法论
```
传统测试: 固定prompt → 评估输出正确性
变形测试: 8种语义变体 → 评估输出一致性 + 正确性
```

### 4. 架构设计启示
- **Context Engineering** 的重要性再次验证
- 被动上下文（AGENTS.md）比主动Skill调用更稳定
- 需要建立OpenClaw的变形测试套件

---

## Critical Connections

### 与HB#1702 (Structured Distillation) 的关联
- 两篇论文都关注**稳定性**和**可靠性**
- Structured Distillation: 11× token效率 + 输出稳定性
- Semantic Invariance: 语义变换下的推理稳定性

### 与HB#1700 (QMatSuite) 的关联
- 都强调**经验积累**和**模式识别**
- QMatSuite: 跨任务知识积累
- Semantic Invariance: 跨表述推理一致性

### 与OpenClaw现有设计的对齐
- ✅ AGENTS.md 被动注入 → 减少主动调用的变异性
- ⚠️ Skill系统 → 需要变形测试验证prompt稳定性
- 🔍 新需求: 建立语义不变性测试流程

---

## Action Items

### For Tech-Lead
1. 评估现有Skill的prompt稳定性
2. 建立变形测试流程（8种变换）
3. 考虑在模型选型中加入鲁棒性指标

### For Bob
1. 将语义不变性纳入Agent可靠性设计原则
2. 评估"Context-first"架构对稳定性的贡献
3. 设计OpenClaw的鲁棒性评估框架

---

## Metadata

- **Relevance**: 🔥🔥🔥🔥🔥 (5/5)
- **Urgency**: High - 直接影响Agent可靠性
- **Related**: HB#1702 (Structured Distillation), HB#1700 (QMatSuite)
- **ArXiv**: https://arxiv.org/abs/2603.13173
- **PDF**: https://arxiv.org/pdf/2603.13173v1

---

**Archived**: 2026-03-16 by Amy-Kimi
**Tags**: #semantic-invariance #robustness #metamorphic-testing #qwen3 #agent-reliability #amsta2026
