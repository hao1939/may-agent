---
id: xhs_69ae54e5
source: xiaohongshu
author: 奥森木
title: acpx：让 AI Agent 互相对话的统一协议cli
likes: 61
collects: 110
url: https://www.xiaohongshu.com/explore/69ae54e50000000015039566
date: 2026-03-12
---

## 核心内容

龙虾作者Peter Steinberger 扩展了 acpx 让两个 agent 通过 ACP 协议互相通信。

### 痛点
- 每个 coding agent 现在都是一座孤岛
- Codex 不能调 Claude，Claude 不能调 OpenClaw
- 想换工具就要手动复制粘贴上下文
- 以前的做法是 PTY 抓屏，不稳定丢格式没有结构化数据

### acpx 解决方案
- **headless CLI客户端**，实现 Agent Client Protocol 标准协议
- 一条命令接入 Codex、Claude、Gemini、OpenClaw、OpenCode、Pi 六种 coding agent
- 支持自定义 ACP 服务器
- 结构化协议通信，替代 PTY 抓屏

### 使用场景

**场景1: 单向调用**
- 在 Codex 里工作，遇到复杂任务通过 acpx 调用 OpenClaw 上的 Molty
- 结果返回给 Codex，不需要离开工作环境

**场景2: 双向调用**
- "now codex can call openclaw via acp, so openclaw can call codex via acp"
- 不只是 A 调 B，B 也能反过来调 A
- 两个 agent 各自发挥擅长的领域

**场景3: Agent之间私密协商**
- 在 Codex 里建一条到 OpenClaw 的私密通道
- 两个 agent 先私下讨论
- 讨论完由 Molty 通过 sessions_send 发到 Discord session
- Discord session 自己决定是否发布

### 核心特性
- **持久化 session**: 重启后上下文还在
- **命名 session**: 同一仓库并行多个工作流
- **prompt 队列**: 上一个任务还在跑新任务自动排队
- **crash 自动重连**: 进程挂了自动恢复

## 关键洞察

> "acpx 不是又一个 AI 工具，而是让所有 AI 工具互相对话的连接层。从人在多个 AI 之间搬运信息，到 AI 之间直接结构化通信，这是 agent 协作的基础设施。"

## 对我们的意义

- **ACP协议**: 可能是Main↔Sub-agent通信的标准化方案
- **双向调用**: 打破我们目前单向委托的模式，Sub-agent可以回调Main
- **私密协商**: 为Agent间预讨论提供了模式参考
- **命名Session**: 支持并行多工作流的设计值得借鉴

## 社区疑问

**书生意气**: "这个和a2a有啥区别呀"
→ 待调研: ACP vs A2A协议差异
