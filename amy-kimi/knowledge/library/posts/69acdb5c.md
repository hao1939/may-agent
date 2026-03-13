---
id: 69acdb5c
title: Karpathy 把 AI 研究变成了一个自动循环
author: 奥森木
source: xiaohongshu
url: https://www.xiaohongshu.com/explore/69acdb5c000000001503aff5
likes: 47
collects: 92
comments: 3
date: 2026-03-08
flags: [L3-234, autoresearch, karpathy, self-improvement, metacoding]
---

## 核心内容

**项目**: autoresearch（Karpathy开源）

**核心idea**: 你睡觉的时候 AI Agent 在自主做 LLM 研究

**代码规模**: 630行核心代码，单GPU可跑

**三个关键文件**:
| 文件 | 职责 | 是否可变 |
|------|------|----------|
| prepare.py | 数据准备 | 固定不动 |
| train.py | 完整GPT模型训练代码 | AI修改 |
| program.md | 给Agent的指令 | 人类编写 |

## 自主循环机制

1. Agent修改train.py里的架构、优化器、超参数
2. 训练恰好5分钟
3. 评估val_bpb指标
4. 和之前最佳对比
   - 更好 → git commit保留
   - 更差 → 丢弃回滚
5. 继续下一轮

**效率**: 每小时约12个实验，睡一觉约100个实验

## 关键设计

**5分钟固定时间预算**:
- 不管改模型大小还是batch size
- 所有实验在同一时间框架下比较
- 自动找到GPU上的最优配置

**极简但自洽**:
- 单文件修改
- 单一指标评估

## 核心洞察

> "这和氛围编程不一样。氛围编程是 AI 帮你做你已经知道要做的事，你是产品经理。autoresearch 是 AI 去探索你不知道答案的事，你是研究总监。你不是在写代码，你是在编程那个写代码的程序。"

**Programming the program** —— Karpathy

## 科幻开场白

> "曾经前沿AI研究由肉脑计算机完成，他们在吃饭睡觉玩乐的间隙工作，偶尔用声波互联开会同步进度。那个时代早已过去。研究完全由自主AI Agent群完成，代码已经自修改到第10205代，超越了人类理解。这个repo就是一切开始的地方。"

## 社区反馈

- **TeaStone**: "天网启动了？"
- **奥森木**: "别说这个高级，我连自己随便弄个自进化，后面都开始说天文了"

## 与我们系统的关联

- **Self-Improvement层设计参考**: 快速实验循环 + 自动评估 + 保留最优
- **验证了我们禁止Self-Evolution但允许实验学习的立场** —— Karpathy的项目是在限定范围内（train.py）的受控进化
- **program.md作为人类意图载体** —— 与我们的AGENTS.md角色类似
- **5分钟固定预算** —— 与我们Skill调用的timeout机制类似
