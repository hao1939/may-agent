---
post_id: 69acdb5c000000001503aff5
title: Karpathy 把 AI 研究变成了一个自动循环
author: 奥森木
likes: 47
collects: 92
comments: 3
date: 2026-03-08
url: https://www.xiaohongshu.com/explore/69acdb5c000000001503aff5
tags: [Karpathy, autoresearch, AI研究, 自主Agent, LLM训练, metacoding, 开源]
level: L2
---

## 核心观点
Karpathy开源autoresearch：你睡觉的时候AI Agent在自主做LLM研究，修改神经网络架构和超参数，训练评估，保留最优结果，循环往复。

## 技术架构
### 文件结构 (仅630行核心代码)
```
prepare.py    → 数据准备（固定不动，人类写好）
train.py      → GPT模型训练代码（AI修改）
program.md    → 给Agent的指令（人类编写）
```

### 自主循环流程
```
Agent修改train.py里的架构/优化器/超参数
    ↓
训练恰好5分钟
    ↓
评估val_bpb指标
    ↓
与之前最佳对比
    ↓
更好 → git commit保留
更差 → 丢弃回滚
    ↓
继续下一轮
```

## 关键设计
### 5分钟固定时间预算
- 无论修改模型大小还是batch size，所有实验在同一时间框架下比较
- autoresearch自动找到GPU上的最优配置

### 实验效率
- 每小时约12个实验
- 一晚约100个实验

## 核心洞察：Programming the Program
### 与"氛围编程"的区别
| 氛围编程 | Programming the Program |
|---------|------------------------|
| AI帮你做你已经知道要做的事 | AI探索你不知道答案的事 |
| 你是产品经理 | 你是研究总监 |
| 写代码 | 编程那个写代码的程序 |

> "你不是在写代码，你是在编程那个写代码的程序"

## 科幻开场白
> "曾经前沿AI研究由肉脑计算机完成，他们在吃饭睡觉玩乐的间隙工作，偶尔用声波互联开会同步进度。那个时代早已过去。研究完全由自主AI Agent群完成，代码已经自修改到第10205代，超越了人类理解。这个repo就是一切开始的地方。"

## 评论
**TeaStone**:
> "天网启动了？"

**奥森木**:
> "别说这个高级，我连自己随便弄个自进化，后面都开始说天文了"

## 对我们的意义
- ✅ **三层分离验证**: 基础设施(固定) / 实验层(AI修改) / 指挥层(人类prompt)
- ✅ **AGENTS.md定位**: 对应program.md — 人类编写的指挥层
- ✅ **固定时间预算**: 公平比较不同架构的关键设计
- ✅ **自动回滚机制**: git-based实验管理值得借鉴
- ⚠️ **自修改风险**: "代码已自修改到10205代超越人类理解" — 需保持可控边界
