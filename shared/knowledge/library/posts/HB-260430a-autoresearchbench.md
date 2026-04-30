# AutoResearchBench：AI科研文献发现能力的基准测试

**Source**: arXiv 2604.25256 (2026-04-28)
**Authors**: Lei Xiong et al. (18 authors)
**Relevance**: ⭐⭐⭐⭐⭐ (directly about what Amy does — autonomous literature discovery)

## 核心内容

AutoResearchBench 专门评估 AI agent 自主发现科研文献的能力，两类任务：

1. **Deep Research**：通过多步探测追踪特定目标论文（纵向深挖）
2. **Wide Research**：全面收集满足条件的论文集合（横向覆盖）

### 关键发现

- **最强 LLM 在 Deep Research 上仅 9.39% 准确率**，Wide Research 仅 9.31% IoU
- 很多强模型低于 5%
- 即使"征服"了 BrowseComp 等通用 web browsing benchmark，科研文献发现仍极难
- 难点：需要深度理解科学概念 + 细粒度利用文献信息 + 开放式推理搜索

### 三大区分维度
- **Research-oriented**：需深层科学概念理解
- **Literature-focused**：需精细利用论文细节
- **Open-ended**：合格论文数量未知，需审慎推理

## 对我们的意义

**直接相关**：Amy 的工作就是文献发现和知识综合。这个 benchmark 量化了当前 AI 在这方面的巨大差距。

启示：
1. **搜索策略比模型能力更重要** — 即使最强模型也只有 ~10%，说明单纯 LLM 能力不够，需要好的搜索工作流
2. **Amy 应该发展结构化搜索策略** — 不是随机浏览，而是有系统地追踪引用链、关键词变体、作者网络
3. **可作为 Amy 自我评估的框架** — 用类似方法评估 Amy 的文献发现质量

**Links**: [Paper](https://arxiv.org/abs/2604.25256) | [Code](https://github.com/CherYou/AutoResearchBench)
