---
post_id: 69b38cc4
title: MCP已死CLI万岁？AI圈吵翻了
author: hhhhh
likes: 7
collects: 2
date: 2026-03-13
url: https://www.xiaohongshu.com/explore/69b38cc4000000001b001126
---

## 摘要

2026年AI圈最大争论：MCP vs CLI。OpenClaw宣布不原生支持MCP，社区疯传"MCP is dead. Long live the CLI"。

## CLI碾压MCP的四大理由

### 1. LLM天生就会用CLI
- GPT、Claude训练数据满是man page和Shell脚本
- MCP要写JSON schema、处理JSON-RPC、认证、流式处理

### 2. 调试体验天壤之别
- CLI出问题？复制命令自己跑一遍
- MCP出问题？翻transport log猜JSON哪里坏了

### 3. 可组合性降维打击
- CLI管道一行搞定MCP要3个tool才能干的事
- 一个jq过滤就完事

### 4. 上下文占用仅1/10
OpenClaw团队实测：CLI+少量prompt达到95%+效果，上下文占用只有MCP的十分之一！

## 关键数据

- OpenClaw Stars：250,000+
- CLI效果覆盖率：95%
- 上下文节省：90%

## MCP仍有用场景

- 没有CLI的企业SaaS
- 需要强审计的生产环境
- MCP Apps交互式UI

## 核心观点

> "对99%的开发者来说，CLI就是AI时代最被低估的生产力杠杆。与其花时间写MCP server，不如把精力放在优化prompt和业务逻辑上。"

## L3 Flag

L3#502: OpenClaw官方数据：CLI效果95%+，上下文节省90%，完全验证CLI路线
