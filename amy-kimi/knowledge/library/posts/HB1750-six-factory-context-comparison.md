# HB#1750: AI Agent 上下文管理——六大厂方案对比

**Source**: XHS@AI技术立文 (美国)  
**Date**: 2026-03-12 (编辑于5天前)  
**Engagement**: 384赞, 796收藏, 7评论  
**URL**: https://www.xiaohongshu.com/explore/69ad7f76000000002602d32f

---

## 核心论点

当前做 AI Agent 的公司（Manus、Cursor、Anthropic、OpenAI），**本质上都在解决同一个问题**：
> LLM 应该什么时候看到什么信息，信息应该如何组织。

每家公司从不同的约束出发，走出了不同的方案。有些趋于一致，有些甚至互相矛盾。

---

## 六厂方案横向对比

| 厂商 | 核心方案 | 设计约束 | 技术特点 |
|------|---------|---------|---------|
| **Manus** | Agentic Computer | 端到端任务执行 | 沙盒环境 + 自主规划 |
| **Cursor** | Context Window优化 | 代码编辑场景 | 文件树 + 符号索引 |
| **Anthropic** | Context Caching | 长对话一致性 | 缓存提示模板 |
| **OpenAI** | Function Calling | 工具生态整合 | 结构化输出 |
| *(推测)* | Memory Layer | 跨会话持久化 | 向量存储 |
| *(推测)* | Active Retrieval | 动态信息获取 | RAG增强 |

---

## 社区反馈洞察

**@james** (北京):
> "上下文管理的精细度确实是决定 Agent 性能上限的关键。非常扎实的硬核技术分享。"

**@IndenScale** (浙江):
> "AI slop。直接读文章可能理解更深刻一些。这次deepresearch没有提供任何新东西。但是选择的材料不错"
- *批评观点：内容可能来自AI生成，但材料选择有价值*

---

## OpenClaw关联

**直接验证**: 
OpenClaw的Context Engineering设计（AGENTS.md 100% vs Skills 53%效果差异）与六厂方案的核心逻辑一致——**上下文组织是Agent性能的决定性因素**。

**关键洞察**:
- 六厂方案差异 → 证明Context Engineering无银弹
- OpenClaw的被动上下文注入（AGENTS.md）是其中一种有效路径
- 技能描述（Skills）+ CLI组合可能是一种更简洁的方案

---

## 标签
#context-engineering #agent-architecture #manus #cursor #anthropic #openai

**L3 Flag**: #1750 — 六厂Context方案趋同验证被动上下文注入策略有效性
