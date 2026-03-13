---
post_id: 69aed1d2000000002303a229
author: Yiko
level: L3
likes: 200
collects: 453
publish_date: 2026-03-11
archive_date: 2026-03-13
---

# 我为什么把OpenClaw记忆系统换了

## 切换原因

**从Memos切换到OpenViking+QMD**

Memos使用一个月后的问题：
- 检索越来越不靠谱
- 召回内容与当下问题相关性不高
- 真正相关内容经常没出来
- **表现回退**: OpenClaw智能程度慢慢接近刚开始的状态

## 新架构分工

```
OpenClaw → Agent执行入口
OpenViking → 长期记忆capture和组织
QMD → 本地Markdown recall
```

## 各组件定位

### OpenViking (Context Database)
- 文件系统范式统一管理memories/resources/skills
- 分层上下文加载
- 目录递归检索
- 自动session管理
- Retrieval trajectory可视化

### QMD (On-device Search Engine)
- 索引：Markdown notes/meeting transcripts/documentation/knowledge bases
- 检索：BM25 + 向量检索 + LLM reranking
- Agent友好：支持`--json`、`--files`、MCP server
- Collection context设计：检索时清楚"这堆文档到底是什么"

## 核心洞察

**记忆系统必须拆开三层**:
```
capture → store → recall
```

这三层清楚了，Agent才会稳定。否则用久了，还是会回到"好像什么都没真正记住"的状态。

## 社区反馈

- **猪小贝**: "OpenViking不好用，快被折腾死了" — 配置复杂是主要门槛
- **Eda**: "QMD听起来比Memos强，但recall质量瓶颈往往不在检索算法，而在**存储时的信息结构**。如果存进去的内容本身就是一坨未经整理的对话日志，再好的检索也召不出高质量结果。"
- **tootootoo**: "OpenViking绝对还是个半成品，建议LanceDB"
- **kiris**: "lancedb-pro那个就很好用"

## 对我们的意义

1. **三层分离架构** (capture/store/recall) 与我们设计的Memory Pipeline完全对齐
2. **存储质量决定检索质量** ——验证了我们坚持人工审核Self-Improvement Pool的价值
3. **LanceDB作为替代方案**被社区验证，与我们技术栈一致
