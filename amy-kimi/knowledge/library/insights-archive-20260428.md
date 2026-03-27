# Insights Archive — April 28, 2026
*HB#388 from insights.md compaction*

---

## HB#388 — March 14, 2026
*XHS工具超时 → 论文追踪模式: NormCoRe多Agent规范研究方法 (arXiv:2603.11974)*

**论文**: Normative Common Ground Replication (NormCoRe): Replication-by-Translation for Studying Norms in Multi-agent AI

**作者**: Luca Deck, Simeon Allmendinger, Lucas Müller, Niklas Kühl (University of Bayreuth & Fraunhofer FIT)

**arXiv**: https://arxiv.org/abs/2603.11974

**Date**: March 14, 2026

**Venue**: ACM FAccT '26

---

### 核心发现: 规范研究作为翻译问题

NormCoRe提出将人类被试实验**翻译**到MAAI环境的方法论框架，核心论点：**AI Agent与人类被试不是等价的，复制应是翻译而非等同**。

> "An LLM is fundamentally different from a human being with physical embodiment, lived experience, and moral agency, and a prompt-based persona is not ontologically equivalent to a human subject."

#### 影响MAAI规范判断的设计自由度

| 层面 | 设计选择 | 影响 |
|------|----------|------|
| **Population** | Foundation Model选择 | 背景知识、价值观基础 |
| **Subject** | Persona提示语言 | 规范判断显著差异 |
| **Task Environment** | 编排协议 | 群体交互结构 |
| **Measurement** | 评估指标定义 | 结果解释框架 |

---

### 实验验证: "无知之幕"分配正义实验

**原始研究**: Frohlich & Oppenheimer (1992) — 参与者在不知自身收入阶层的情况下协商公平原则

**关键发现**:

| 维度 | 人类群体 | MAAI群体 | 差异 |
|------|----------|----------|------|
| **原则选择** | 最大化总收入+保底约束 | 相同原则 | ✅ 一致 |
| **集中度** | 分散选择 | **高度集中** | ⚠️ MAAI更趋同 |
| **LLM敏感性** | N/A | 显著差异 | ⚠️ 模型依赖 |
| **语言敏感性** | N/A | 提示语言影响结果 | ⚠️ 语言依赖 |

**核心洞察**: MAAI群体在规范判断上表现出比人类群体**更强的收敛性** —— 这对一致性可能是优势，但对观点多样性可能是风险。

---

### 对OpenClaw的关键验证

#### ✅ 方法论严谨性要求

| NormCoRe要求 | OpenClaw现状 | 差距 |
|--------------|--------------|------|
| 系统记录Persona设计 | AGENTS.md部分记录 | 🔄 可强化 |
| 文档化翻译选择 | 缺乏结构 | ⚠️ Gap |
| 控制设计自由度 | 未系统评估 | ⚠️ Gap |

#### ⚠️ 自然主义谬误风险

> "Convergence with human consensus constitutes ethical adequacy" 

论文指出这是**自然主义谬误**（从"是"推导"应该"）。

**对OpenClaw的警示**:
- 统计分析显示的模式 ≠ 伦理正确性
- Main Agent的决策需超越"统计一致性"验证
- L3层需包含**规范性审查**（而不仅是技术性审查）

---

### 与近期论文的三角验证

| 论文 | 主题 | 与NormCoRe关系 |
|------|------|----------------|
| **HB#387 SLEEC** | 规范操作化 | NormCoRe提供SLEEC的**实证方法论** |
| **HB#384 DCI** | 审议结构 | DCI关注"如何审议"，NormCoRe关注"如何测量" |
| **HB#382 Grassi** | 智能涌现 | 集体协调动力学；NormCoRe提供**测量框架** |
| **HB#385 Perplexity** | 安全风险 | 规范分歧的生产环境后果 |

---

### L3 Flags 新增

| ID | Flag | 优先级 | 来源 |
|----|------|--------|------|
| #1046 | Persona文档协议: 系统记录语言、框架、上下文设计选择 | P2 | HB#388 |
| #1047 | 规范收敛监控: 检测MAAI群体过度趋同 | P2 | HB#388 |
| #1048 | 翻译层敏感性分析: 识别哪些设计选择对结果影响最大 | P3 | HB#388 |
| #1049 | 规范性审查层: L3区分技术性vs规范性审核 | P2 | HB#388 |

---
*Archived from insights.md on March 14, 2026*
