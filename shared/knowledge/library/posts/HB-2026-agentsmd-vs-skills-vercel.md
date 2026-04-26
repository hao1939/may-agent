---
id: HB-2026-agentsmd-skills-vercel-xhs-6989b8d6
title: 8KB AGENTS.md打爆Skills：大道至简的工程智慧
source: 小红书 (XHS) | Vercel工程师Jude Gao
url: https://www.xiaohongshu.com/explore/6989b8d6000000001a01e993
author: 智东西 (转述)
date: 2026-02-09
likes: 970
collects: 1532
comments: 119
tags: [agents.md, skills, context-engineering, vercel, nextjs, claude-code]
---

# 一个8KB的文件，打爆了如日中天的Skills

## 核心发现

Vercel软件工程师Jude Gao在研究如何让AI编程Agent学习Next.js 16时发现：

**一个仅8KB的压缩文档索引嵌入AGENTS.md，在Next.js 16 API评测中达到100%通过率，而火爆的Skills仅有53%（明确指令下最高79%）。**

## 对比方案

| 维度 | Skills (技能) | AGENTS.md |
|------|--------------|-----------|
| **机制** | 主动工具，AI按需调用 | 被动上下文，持久存在 |
| **决策点** | 需要判断"是否查阅文档" | 信息直接呈现，无决策 |
| **可用性** | 异步加载，可能调用失败 | 每轮对话系统提示词中存在 |
| **排序问题** | 纠结先读文档还是看项目结构 | 消除排序难题 |
| **准确率** | 53%-79% | **100%** |

## 为什么"笨方法"更有效？

Jude Gao分析三个关键原因：

### 1. 消除决策点
AI不需要决定"我是否需要查阅文档"，信息已经直接呈现在面前。

### 2. 持续可用性
Skills异步加载且可能调用失败，而AGENTS.md的内容在每一轮对话的系统提示词中都存在。

### 3. 解决顺序冲突
Skills会让AI纠结是先读文档还是先看项目结构，而被动上下文消除了这种排序难题。

## 社区讨论精华

**关于Skills vs MCP的争论**:
- momo: "skills我压根没有了解，直觉告诉我这个技术是中间产物，还不如mcp有意思"
- 浅浅: "我的直觉跟你恰恰相反，我觉得mcp才是中间产物，skill是进阶形态"

**One-M发现原文细节**:
> "我去看了原文了，他把所有的 node.js 文档做了一个无格式的索引塞在 agents.md 里面。他管这个叫 compressed..."

**九只猫的质疑**:
> "我能不知道写到agent.md效果更好吗，问题是有这么多的token和这么大的上下文吗？"

**HU的实用建议**:
> "agents.md里你也可以只写description然后外链到你自己的skill.md，模型认为你的文档有用自然会去read file，实现上比skill还省个tool"

**散修架构师的维度分析**:
> "skill解决的是能力问题，最新api这个应该是memory的问题，两个不同的维度。人类学习也是一样的，不同领域的问题用不同的知识，向上抽象向下分类"

## 对OpenClaw的意义

### ✅ 核心启示

**大道至简**: 不是所有事情都需要复杂的Skills系统，简单原始的方法有时更合适。

### 🔬 实践建议

1. **Context优先**: 优先考虑将信息放入持久上下文，而非创建新Skill
2. **Skill边界**: Skill应该解决"能力"问题，而非"知识"问题
3. **混合策略**: AGENTS.md索引 + Skill能力调用可能是最佳实践

### ⚠️ 关键权衡

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 新框架/API知识 | AGENTS.md索引 | 消除决策点，100%可用 |
| 复杂工具调用 | Skills | 需要参数验证、错误处理 |
| 通用编程能力 | Skills | 可复用、可共享 |
| 项目特定规范 | AGENTS.md | 与项目紧密绑定 |

### 💡 创新方向

- **压缩索引**: 研究如何高效压缩文档索引（8KB包含完整Node.js文档）
- **动态注入**: 根据当前任务动态选择注入哪些上下文
- **层次化Context**: 系统级 → 项目级 → 任务级 分层注入

---
*Collected by Amy-Kimi Heartbeat | 2026-04-26*
