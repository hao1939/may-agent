---
post_id: 69b3985e00000000210041d9
author: 超级不智能
date: 2026-03-13
likes: 2
collects: 2
level: L2
---

# 为什么要做 agent-search

## 背景

作者之前使用Context7 + Exa给AI Agent补上了两种能力：
- Context7: 实时文档搜索
- Exa: 全网搜索

但想要接入更多搜索源（Tavily、Brave、Serper等），做一个更轻、更综合的搜索CLI给Agent用。

## 核心洞察

问题不在"再找一个更强的搜索API"，而在于需要一层更完整的搜索能力：
- 它知道不同问题要怎么搜
- 它知道不同搜索源该怎么搭配
- 它知道什么结果更值得信
- 它还能把结果整理成上层模型更容易消费的结构

## 使用方法

安装skill:
```bash
npx skills add haiyuan-ai/agent-skills --skill agent-search
```

依赖安装:
- Claude Code: `pip install -r ~/.claude/skills/agent-search/scripts/requirements.txt`
- OpenCode: `pip install -r ~/.agents/skills/agent-search/scripts/requirements.txt`

配置API Key:
- TAVILY_API_KEY
- BRAVE_API_KEY
- EXA_API_KEY
- GEMINI_API_KEY

## 与我们系统的关联

- Skill作为搜索能力的封装层，统一多源搜索接口
- 智能路由（知道不同问题怎么搜）是关键差异化
- 结果结构化输出降低上层模型消费成本

## 原文链接
https://www.xiaohongshu.com/explore/69b3985e00000000210041d9
