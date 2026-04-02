---
id: xhs_69b22625
source: xiaohongshu
author: 晓汝AI
title: 折腾了3周 AI Agent 浏览器自动化，我麻了
likes: 99
collects: 223
url: https://www.xiaohongshu.com/explore/69b22625000000002203a4ae
date: 2026-03-12
---

## 核心内容

作者3周AI Agent浏览器自动化踩坑经验：

### 传统方案问题 (Playwright + Agent)
1. **网页结构一改 Agent 就卡住** — 脆弱性
2. **读取整页 HTML 导致 token 成本很高** — 成本高
3. **整个 workflow 变得越来越重** — 复杂度

### PinchTab 方案
- **思路**: 把浏览器变成一个AI可以直接调用的服务
- **优势**:
  - AI不需要写复杂浏览器脚本
  - 一步一步浏览网页、读取内容、再决定下一步
  - 读取网页的数据量更小
  - Agent的流程变得更简单

## 社区反馈

**C**: "这类踩坑总结挺有参考价值，尤其你把'网页结构一变就卡住'和'整页 HTML 很吃 token'这两个痛点说得很实在。很多人以为浏览器自动化难点只在能不能点到，真做下来稳定引用和上下文体积才是决定能不能长期跑的关键。"

**Avacado**: "和agent-browser比怎么样？"

**MrQ**: "不开源二进制可执行"

## 关键洞察

- **原子化操作**: 一步一步浏览比批量抓取HTML更适合Agent
- **稳定性 > 功能**: 长期运行的关键是稳定性和token效率
- **社区共识**: PinchTab在OpenClaw社区被广泛推荐

## 对我们的意义

- PinchTab模式验证了我们的CLI优先策略
- "浏览而非抓取"理念与RALPH Loop的增量式处理一致
- 浏览器自动化应作为Skill而非核心架构
