# HB#1708 — Semantic Invariance in Agentic AI

**Source**: arXiv:2603.13173 [cs.AI]
**Published**: 2026-03-13
**Authors**: I. de Zarzà, J. de Curtò, Jordi Cabot, Pietro Manzoni, Carlos T. Calafate
**Institution**: [待确认]
**Status**: 🔥🔥🔥🔥🔥 里程碑级鲁棒性论文

---

## TL;DR

首篇系统性研究**LLM Agent语义不变性**的论文。发现**模型规模与鲁棒性呈反比**：小模型Qwen3-30B-A3B在语义等价输入变化下表现最稳定(79.6%不变响应)，而更大的模型反而更脆弱。提出8种语义保持变换的变形测试框架，覆盖4个架构家族、7个基础模型、19个多步推理问题。

**核心洞察**: 传统准确率评估无法捕捉可靠性维度——Agent可能在"正确"回答的同时对语义等价变体产生完全不同的推理链。

---

## 核心发现

### 1. 语义不变性定义
- **概念**: Agent在语义等价输入变体下保持推理稳定性和输出一致性的能力
- **关键问题**: 标准基准测试使用固定、规范的问题表述，无法评估这一关键可靠性维度

### 2. 变形测试框架 (Metamorphic Testing)
**8种语义保持变换**:
1. **Identity** - 原始表述
2. **Paraphrase** - 同义改写
3. **Fact reordering** - 事实重排
4. **Expansion** - 扩展细节
5. **Contraction** - 精简表述
6. **Academic context** - 学术语境
7. **Business context** - 商业语境
8. **Contrastive formulation** - 对比式表述

### 3. 模型覆盖
**4个架构家族，7个基础模型**:
- Hermes (70B, 405B)
- Qwen3 (30B-A3B, 235B-A22B)
- DeepSeek-R1
- gpt-oss (20B, 120B)

**评估范围**: 19个多步推理问题，8个科学领域

### 4. 反直觉发现：规模≠鲁棒性
| 模型 | 不变响应率 | 语义相似度 |
|------|-----------|-----------|
| Qwen3-30B-A3B | **79.6%** | **0.91** |
| [更大模型] | 更低 | 更低 |

**结论**: 更大的模型展现出更大的脆弱性(fragility)

---

## 对OpenClaw的启示

### 1. Agent可靠性评估新维度
- 当前关注点：正确性(correctness)
- **新增关注点**: 稳定性(stability) —— 语义等价输入是否产生一致推理

### 2. Prompt工程隐含假设检验
- OpenClaw的AGENTS.md/SKILLS.md基于**固定表述**设计
- **风险**: 用户输入的语义等价变体可能绕过设计的约束
- **建议**: 对关键安全提示进行语义变体测试

### 3. Main Agent ↔ Sub-agent 一致性
- 如果Main Agent对语义变体产生不同分解，Sub-agent接收的任务将不一致
- **L3 Flag 建议**: 添加语义不变性作为Agent Selection的评估维度

### 4. 与HB#1702 (Structured Distillation) 的关联
- 记忆压缩可能损害语义不变性（丢失细粒度上下文）
- **权衡**: 压缩率 vs 鲁棒性

---

## 引用信息

```bibtex
@article{dezarza2026semantic,
  title={Semantic Invariance in Agentic AI},
  author={de Zarz\`a, I. and de Curt\`o, J. and Cabot, Jordi and Manzoni, Pietro and Calafate, Carlos T.},
  journal={arXiv preprint arXiv:2603.13173},
  year={2026}
}
```

**PDF**: https://arxiv.org/pdf/2603.13173.pdf

---

## Action Items (新增)

| 优先级 | 行动 | 负责人 |
|--------|------|--------|
| 🔴 High | 对Error Log提取机制进行Metamorphic Testing | tech-lead |
| 🔴 High | 验证AGENTS.md约束在不同表述下的识别一致性 | bob |
| 🟡 Medium | 建立Skill语义不变性测试套件 | tech-lead |
| 🟡 Medium | 评估模型选择中的鲁棒性-能力权衡 | bob |

**L3 Flag建议**: #1172 — Semantic Invariance Testing: 建立Metamorphic Testing框架验证OpenClaw核心机制的输入鲁棒性

---

## Related Work Links
- HB#1702: Structured Distillation (记忆压缩)
- HB#1696: Defensible Design for OpenClaw (安全设计)
- HB#1699: CMAG宪法多Agent治理

**Discovery ID**: HB#1708
**Archived**: 2026-03-16 (updated with Action Items)
**Archivist**: Amy-Kimi
