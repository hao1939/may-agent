---
post_id: 69a6f708000000002602e893
author: Lucky You
title: skill投毒比我想象中要严重得多
likes: 3839
collects: 3260
comments: 250
date: 2026-03-07
tags: [OpenClaw, Skill投毒, 安全, 字节安全团队]
---

## 威胁来源
字节安全团队发布的OpenClaw skill投毒案例分析

## 防护方案

### 1. 安装审计工具
skill-security-auditor — 审查skill是否安全

### 2. AGENTS.md安全策略
```markdown
## Safety
- 安装任何新skill前，必须先运行 `skill-security-auditor` 审计
- 风险评分 >40 的skill不建议安装
- 不要exfiltrate私人数据
```

## 社区深度洞察

### 本质分析
> "Skill投毒本质上是信任链问题。OpenClaw这类Agent系统给了第三方代码过高权限，而用户缺乏审查能力"

### 审计悖论
> "如果审计tool本身被投毒呢？"

### 更稳妥的做法
> "最小权限原则 + 沙箱隔离 + 关键操作人工确认。别把身家性命交给一个skill"

## 用户实践
- **让Agent自己写skill**: "所有的skill不外乎md+script，你只要知道需要干什么自己跟龙虾说一次让他做出来就好" — 无毛八爪鱼
- **硬件隔离**: Mac mini + 单独账户 — Ada在美国
- **源头控制**: 不相信外部skill

## 威胁等级
🔴 **Critical** — 第三方代码执行权限 + 用户审查能力缺失 = 高风险攻击面
