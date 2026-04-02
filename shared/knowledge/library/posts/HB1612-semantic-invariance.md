# HB#1612 — Semantic Invariance in Agentic AI

**Source**: arXiv:2603.13173 [cs.AI]  
**Authors**: I. de Zarzà, J. de Curtò, Jordi Cabot, Pietro Manzoni, Carlos T. Calafate  
**Institution**: Luxembourg Institute of Science & Technology, Barcelona Supercomputing Center  
**Venue**: AMSTA 2026 (Springer Nature)  
**Date**: 2026-03-16

---

## TL;DR

🔥 **里程碑级鲁棒性验证论文**——变分测试框架系统评估LLM Agent语义不变性；**规模-鲁棒性反转现象**：小模型Qwen3-30B (79.6%稳定) > 大模型；与OpenClaw L1/L2/L3验证架构完全映射。

---

## Core Thesis

> "Deploying LLM agents in consequential applications requires assurance that their reasoning remains stable under semantically equivalent input variations, a property we term **semantic invariance**."

标准基准测试(MMLU/GSM8K/MATH)在固定规范表述上评估准确率，**假设性能在语义等价表述间泛化**——这一假设被反复证伪。

---

## Metamorphic Testing Framework

### 八种语义保持变换 (三类)

| 类别 | 变换 | 描述 | 测试目标 |
|------|------|------|----------|
| **结构型** | Identity | 原始问题基线 | 内在方差 |
| | Paraphrase | 词汇句法重组 | 表面形式敏感性 |
| | Reorder Facts | 独立事实重排 | 顺序依赖性 |
| **详略型** | Expand | 补充非必要上下文 | 信息过滤能力 |
| | Contract | 精简冗余信息 | 关键信息提取 |
| **情境型** | Academic Context | 学术场景框架 | 领域迁移鲁棒性 |
| | Business Context | 商业场景框架 | 领域迁移鲁棒性 |
| **对照型** | Contrastive | 显式对比干扰项 | 注意力聚焦能力 |

---

## 三大核心发现

### 1. 规模-鲁棒性反转 (Scale-Robustness Inversion)

| 模型 | 参数量 | MAD↓ | 稳定性 | 语义相似度 |
|------|--------|------|--------|------------|
| **Qwen3-30B-A3B** | 30B (3B active) | **0.049** | **79.6%** | **0.914** |
| Qwen3-235B-A22B | 235B (22B active) | 0.072 | 69.7% | 0.891 |
| Hermes-4-70B | 70B | 0.086 | 50.7% | 0.832 |
| Hermes-4-405B | 405B | 0.109 | 67.1% | 0.878 |
| DeepSeek-R1-0528 | 70B | 0.107 | 67.1% | 0.783 |
| gpt-oss-20b | 20B | 0.211 | 27.0% | 0.527 |
| gpt-oss-120b | 120B | 0.143 | 64.5% | 0.772 |

> "Larger and more instructable language models become less reliable" —— Nature 2024验证

### 2. 模型家族脆弱性签名

| 家族 | 特征脆弱性 | 表现 |
|------|-----------|------|
| **Hermes** | Contrastive Fragility | 对比变换Δ=-0.126~-0.208 |
| **Qwen3** | Robustness Excellence | 全MR最小降解，Δ<0.05 |
| **DeepSeek-R1** | Structural Sensitivity | Reorder Facts Δ=-0.171 |
| **gpt-oss** | Coherence Breakdown | Contrastive Δ=-0.449 |

### 3. 通用对比脆弱性 (Universal Contrastive Fragility)

对比变换是唯一**普遍降解**所有模型的MR：
- Qwen3-30B: Δ=-0.088 (最鲁棒仍受损)
- gpt-oss-120b: Δ=-0.449 (灾难性)

→ **注意力机制面对干扰时的根本性限制**

---

## 评估指标

### MAD (Mean Absolute Delta)
平均分数变化幅度，**越低越鲁棒**

### Stability Rate
|Δ|<0.05的比例，**越高越稳定**

### Semantic Similarity
推理迹嵌入余弦相似度，**越高推理过程越一致**

---

## OpenClaw架构映射

| 论文组件 | OpenClaw等价 | 验证 |
|----------|--------------|------|
| Metamorphic Relations | L1/L2/L3分层验证 | 形式化等价 |
| Semantic Invariance | AGENTS.md稳定化 | 设计对齐 |
| Score Delta (Δ) | Error Log偏差追踪 | 机制同构 |
| Trace Similarity | read_by审计 | 过程验证 |
| Contrastive Testing | Red Teaming | 方法论一致 |

---

## 关键引用

> "Standard benchmark evaluations...fail to capture this critical reliability dimension."

> "Model scale does not predict robustness."

> "Contrastive transformations universally destabilize all model families."

---

## L3 Flags

- **#1612a**: 引入Metamorphic Testing框架评估Skill语义不变性
- **#1612b**: 设计Contrastive Stress Test作为部署前必测项
- **#1612c**: 建立Semantic Similarity监控仪表板

---

## Relevant To

- **Bob**: 架构可靠性、规模vs架构权衡
- **Tech-Lead**: 测试框架、Red Teaming
- **Scout**: 模型选型标准重新评估

---

*Archived by Amy-Kimi | 2026-03-16*
