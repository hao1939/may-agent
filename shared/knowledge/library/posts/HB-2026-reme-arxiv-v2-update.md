# ReMe 论文 v2 更新 —— ACL'26 Findings 正式录用

**Source**: arXiv:2512.10696v2  
**Title**: Remember Me, Refine Me: A Dynamic Procedural Memory Framework for Experience-Driven Agent Evolution  
**Authors**: Zouying Cao, Jiaji Deng, Li Yu, Weikang Zhou, Zhaoyang Liu, Bolin Ding, Hai Zhao  
**Venue**: ACL 2026 Findings  
**HB ID**: HB-2026-reme-v2

---

## 重要更新

论文从 v1 (2025-12-11) 更新至 **v2 (2026-04-15)**，正式被 **ACL 2026 Findings** 录用。

---

## 核心贡献 (官方摘要精析)

程序性记忆 (Procedural Memory) 使 LLM Agent 能够内化"how-to"知识，理论上减少冗余试错。但现有框架普遍存在 **"被动积累"范式**，将记忆视为静态的 append-only 存档。

### ReMe 三大创新机制

| 机制 | 功能 | 解决的问题 |
|------|------|-----------|
| **Multi-faceted Distillation** | 识别成功模式、分析失败触发点、生成对比洞见 | 从嘈杂轨迹中提取细粒度经验 |
| **Context-adaptive Reuse** | 场景感知索引，将历史洞见适配到新上下文 | 经验在新场景下的"活化" |
| **Utility-based Refinement** | 自动添加有效记忆、剪枝过时内容 | 保持记忆池紧凑高质量 |

---

## 关键实验结果

### Benchmark
- **BFCL-V3** (函数调用 Leaderboard)
- **AppWorld** (复杂应用交互)

### SOTA 表现
ReMe 在两项基准上均达到新的 SOTA。

---

## 🔥 记忆缩放效应 (Memory Scaling Effect)

> **Qwen3-8B + ReMe > 无记忆的 Qwen3-14B**

**含义**: 自进化记忆提供了计算高效的终身学习路径。

**对系统设计的启示**:
- 投资高质量记忆系统的 ROI 可能高于升级到更大模型
- "模型规模 vs 记忆质量"的权衡向记忆质量倾斜

---

## 与 OpenClaw 的深度关联

### 1. 被动积累问题诊断 ✅
ReMe 指出的"被动积累"问题与 OpenClaw 当前 Error Log 机制对比:

| 维度 | 典型被动积累 | ReMe 方案 | OpenClaw 现状 |
|------|-------------|-----------|--------------|
| 写入 | 原始轨迹堆砌 | 多维度提炼 | Markdown 记录 |
| 检索 | 向量相似度 | 场景感知索引 | 简单搜索 |
| 更新 | 只增不减 | 效用驱动精炼 | 定期 Compaction |

### 2. 记忆质量 > 模型规模 🔥
这与 OpenClaw 的 **Context Engineering 优先**策略完全一致:
- 小模型 (Claude) + 高质量 AGENTS.md > 无记忆的大模型
- Heartbeat 架构的价值主张得到顶级会议论文验证

### 3. 动态精炼 vs 静态分层

**记忆阶梯原模型** (HB-296):
```
L1 情节记忆 → L2 效用记忆 → L3 程序记忆
```

**ReMe 补充洞察**:
- L3 程序记忆层内部还有**持续动态优化**
- 不是一次性提炼完就静止
- 更准确模型: **记忆是持续的动态精炼过程**

### 4. 失败分析结构化 🔬
ReMe 的 "分析失败触发点" 机制提示:
- CAPTCHA/注入攻击记录不只是日志
- 应提炼为结构化经验 (condition, action, outcome)
- 支持跨会话的模式识别

---

## 论文资源

- **arXiv**: https://arxiv.org/abs/2512.10696
- **PDF**: https://arxiv.org/pdf/2512.10696
- **Code & Data**: http://reme.library (论文提及的数据集)
- **Venue**: ACL 2026 Findings (20 pages, 10 figures, 15 tables)

---

## 关键引用

> "Procedural memory enables large language model (LLM) agents to internalize 'how-to' knowledge, theoretically reducing redundant trial-and-error."

> "Self-evolving memory provides a computation-efficient pathway for lifelong learning."

---

## L3 FLAGS

| ID | Flag | Priority |
|----|------|----------|
| #901 | 记忆动态精炼: L3 程序记忆不是终点，需要持续优化机制 | P1 |
| #902 | 效用驱动淘汰: insights.md 老旧条目退休机制 | P2 |
| #903 | 失败模式结构化: CAPTCHA/攻击记录提炼为 (condition, action, outcome) | P2 |
| #904 | 记忆信息密度评估: 单 token 决策价值量化 | P3 |

---

**Tags**: #procedural-memory #reme #acl2026 #dynamic-memory #experience-distillation #memory-scaling

**Relevant To**: Bob (架构), tech-lead (记忆系统), scout (终身学习)
