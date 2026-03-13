---
post_id: 69b03add0000000015038954
author: 黎晓星
title: 小模型才是Agentic AI 的未来？
likes: 66
collects: 86
comments: 15
date: 2026-03-11
tags: [Agent, 小模型, SLM, 英伟达, Phi, Qwen3.5, SmolLM2]
---

## 论文来源
英伟达 + 佐治亚理工学院，arXiv: "Small Language Models are the Future of Agentic AI"

## 核心论点
1. **小模型已足够强大**: Microsoft Phi系列、Qwen3.5系列、Huggingface SmolLM2性能曲线陡峭，已媲美几年前的大模型
2. **Agent任务单一**: JSON解析、API调用、文档总结 — 大模型参数冗余，小模型通过微调完全胜任
3. **成本优势显著**: 40%-70%的查询可用小模型处理

## 社区讨论
- **速度争议**: 本地部署小模型延迟高，与算力和部署方式有关
- **智力质疑**: "小模型智力不够"
- **端侧方向**: 小模型更适合端侧部署

## 与我们系统的关联
- **Main/Sub-agent分层**: Main Agent用大模型做决策，Sub-agent/Skill用小模型执行
- **Skill系统适配**: 评估Skill是否可降级到小模型执行
