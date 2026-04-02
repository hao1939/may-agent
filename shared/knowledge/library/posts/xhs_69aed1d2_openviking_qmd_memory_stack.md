---
post_id: 69aed1d2000000002303a229
author: Yiko
title: 我为什么把 openclaw 记忆系统换了
likes: 203
collects: 458
comments: 42
date: 2026-03-10
tags: [OpenClaw, OpenViking, QMD, Memory, Memos]
---

## 切换原因
原Memos方案使用一个月后，检索越来越不靠谱：
- 召回内容与问题相关性低
- 真正相关内容经常没出来
- OpenClaw表现回退到初始智能程度

## 新方案架构: OpenClaw + OpenViking + QMD

### 三层分工
| 层级 | 组件 | 职责 |
|------|------|------|
| 执行层 | OpenClaw | Agent执行入口 |
| 组织层 | OpenViking | 长期记忆capture和组织 |
| 检索层 | QMD | 本地markdown recall |

### OpenViking核心设计
- **定位**: AI Agent专用的context database
- **文件系统范式**: 统一管理memories、resources、skills
- **能力**: 分层上下文加载、目录递归检索、自动session管理、retrieval trajectory可视化

### QMD核心能力
- **定位**: on-device search engine
- **检索**: BM25 + 向量 + LLM reranking
- **接口**: --json、--files、MCP server
- **特性**: collection context设计，清楚知道"这堆文档是什么"

## 核心洞察
> "记忆系统一定要拆开看 `capture -> store -> recall`。这三层清楚了，agent才会稳定"

## 社区反馈
- **OpenViking成熟度**: "绝对还是个半成品，建议lancedb" — tootootoo
- **检索质量瓶颈**: "往往不在检索算法，而在存储时的信息结构" — ᅠᅠᅠEda
- **备选方案**: Hindsight (开源本地部署，MCP协议)
