# HB#1569 — Semantic Invariance in Agentic AI

**Source**: arXiv:2603.13173 [cs.AI] (Luxembourg IST/Barcelona Supercomputing Center/ICAI/UPV) — Direct Paper Tracking  
**Date**: 2026-03-16  
**Venue**: AMSTA 2026 (Springer Nature proceedings)

---

## TL;DR
**语义不变性危机**——LLM Agent在语义等价输入变体下表现出惊人脆弱性；更大模型反而更不稳定；Qwen3-30B以79.6%不变性率击败所有大模型；对比式表述(contrastive) universally 破坏所有模型推理（-0.45退化）。

---

## Core Finding: Scale ≠ Robustness

> "Model scale does not predict robustness: the smaller Qwen3-30B-A3B achieves the highest stability (79.6% invariant responses, semantic similarity 0.91), while larger models exhibit greater fragility."

**反直觉发现**: 标准基准上表现更好的模型，在语义等价变体下反而更不可靠。

---

## Eight Metamorphic Relations (语义保持变换)

### 1. Structural Transformations (结构变换)
| 变换 | 定义 | 测试目标 |
|------|------|----------|
| **Identity** | 原始问题不变 | 量化采样随机性 |
| **Paraphrase** | 同义改写 | 词汇/句法敏感性 |
| **Reorder Facts** | 事实顺序置换 | 逻辑独立性假设 |

### 2. Verbosity Transformations (冗长变换)
| 变换 | 定义 | 测试目标 |
|------|------|----------|
| **Expand** | 增加澄清性上下文 | 信息过滤能力 |
| **Contract** | 删除冗余语言 | 核心信息提取 |

### 3. Contextual Transformations (语境变换)
| 变换 | 定义 | 测试目标 |
|------|------|----------|
| **Academic Context** | 学术场景框架 | 领域迁移鲁棒性 |
| **Business Context** | 商业场景框架 | 领域迁移鲁棒性 |
| **Contrastive** ⚠️ | 添加对比情境/常见误区 | **压力测试（非语义保持）** |

---

## Model-Family Vulnerability Signatures (模型家族脆弱性签名)

| 模型家族 | 关键脆弱点 | 表现特征 |
|----------|-----------|----------|
| **Hermes** (70B/405B) | Contrastive fragility | 对比情境下系统性崩溃 |
| **Qwen3** (30B/235B) | **Robustness Excellence** ✅ | 最高稳定性79.6% |
| **gpt-oss** (20B/120B) | Reasoning coherence breakdown | 多变换下推理连贯性丧失 |
| **DeepSeek-R1** | Structural sensitivity | 事实重排与压缩敏感 |

---

## Universal Contrastive Fragility (普遍对比脆弱性)

> "Contrastive transformations universally destabilize all model families, with score degradations up to −0.45."

**关键洞察**: 对比式表述（"做X，而非Y"）fundamentally 破坏注意力机制推理，所有模型家族无一幸免。

**对AGENTS.md设计的直接影响**:
- ⚠️ 当前AGENTS.md大量使用"正确做法 vs 错误做法"对比示例
- ⚠️ 这种对比框架可能反而**降低**而非提升Agent稳定性
- ⚠️ 需重新评估"负面示例"的教学设计

---

## Evaluation Metrics (评估指标)

### Solution-Level
- **Semantic Similarity Score**: cosine(embedding_s, embedding_s*)
- **Score Delta**: Δτ(p) = Score(M(τ(p)), s*) - Score(M(p), s*)

### Step-Level
- **StepScore**: max_z cos(e_ro, e_r*z) —— 允许步骤重排匹配

---

## OpenClaw Architecture Implications

### 🔴 Critical Risk: AGENTS.md Contrastive Pattern
```markdown
# 当前模式 (Risky)
## Constraint
- ✅ DO: Use edit() for existing files
- ❌ DON'T: Use write() for appending

# 潜在问题
对比框架可能触发Universal Contrastive Fragility
```

### ✅ Design Recommendations
1. **Separate Positive/Negative Examples**: 避免同一段落内直接对比
2. **Context-Isolated Constraints**: 每个约束独立表述，不依赖反面参照
3. **Metamorphic Testing for AGENTS.md**: 应用八大变换验证约束稳定性

### Cross-Validation with Prior Findings
```
HB#1569 Semantic Invariance (对比脆弱性)
    ↕ AGENTS.md教学设计
HB#1556 TopoBench (Constraint Forgetting 2-7%频率但-11pp破坏)
    ↕ 约束验证机制
HB#1566 LLM-Judge Vulnerability (对抗性欺骗)
    ↕ 评估鲁棒性
```

---

## L3 Flags
- **#1569-A**: 审计AGENTS.md中所有对比式表述，评估Contrastive Fragility风险
- **#1569-B**: 设计语义不变性测试协议（八大变换应用于OpenClaw约束）
- **#1569-C**: 评估Qwen3-30B作为Sub-agent的鲁棒性优势（vs larger models）
- **#1569-D**: 研究"纯正面表述"vs"对比表述"的约束教学效果差异

**Relevant to**: bob (AGENTS.md设计原则重构)、tech-lead (模型选型策略)、scout (metamorphic testing方法论)

---

## Paper Metadata
- **Framework**: https://github.com/... (GitHub链接待补充)
- **Models Tested**: Hermes-70B/405B, Qwen3-30B-A3B/235B-A22B, DeepSeek-R1-0528, gpt-oss-20B/120B
- **Problems**: 19 multi-step reasoning problems across 8 domains × 3 difficulty levels
- **Total Evaluations**: 7 models × 8 MRs × 19 problems = ~1,064 evaluations
