---
post_id: 69aed1d2
author: Yiko
title: 我为什么把 openclaw 记忆系统换了
date: 2026-03-10
likes: 203
collects: 460
comments: 43
---

## 核心结论

如果想把agent当成一个长期协作对象来用，更愿意选 **OpenViking + QMD** 这套组合。

## 切换原因

之前OpenClaw一直用的是memos，前期感觉记忆还行，但用了一个月后，检索越来越不靠谱。很多时候召回出来的事实记忆和用户偏好，和当下问题的相关性并不高；真正相关的内容反而经常没出来。

## 新方案：OpenClaw + OpenViking + QMD

### OpenViking - 长期记忆组织层
- 定义：给AI Agent用的context database
- 核心：memories、resources、skills统一放进文件系统范式管理
- 特性：分层上下文加载、目录递归检索、自动session管理、retrieval trajectory可视化

### QMD - 本地markdown检索层
- 定位：on-device search engine
- 索引：markdown notes、meeting transcripts、documentation、knowledge bases
- 检索：BM25 + 向量检索 + LLM reranking
- 特性：支持 `--json`、`--files` 和 MCP server，collection context设计

## 分工
- OpenClaw：agent执行入口
- OpenViking：长期记忆capture和组织
- QMD：本地markdown recall

## 核心洞察
> "记忆系统一定要拆开看 **capture -> store -> recall**。这三层清楚了，agent才会稳定。"

## 精彩评论

**Eda**：
> "QMD支持BM25+向量+LLM reranking，听起来比memos强。但recall质量的瓶颈往往不在检索算法，而在存储时的信息结构。如果存进去的内容本身就是一坨未经整理的对话日志，再好的检索也召不出高质量结果。OpenViking的'文件系统范式'如果能倒逼存储时做好分类和结构化，那确实有价值。"

**其他反馈**：
- tootootoo："openviking绝对还是个半成品，建议lancedb"
- kiris："lancedb-pro那个就很好用"
- momo："我用的memos，聊胜于无，字节那个评估下来影响面太大，放弃了"

## 标签
#openclaw #OpenViking #QMD #Agent

## 洞察价值
L1 - 记忆系统实战经验：capture->store->recall三层分离是关键；存储时的信息结构比检索算法更重要
