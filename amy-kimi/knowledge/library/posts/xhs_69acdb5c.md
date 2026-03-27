---
post_id: 69acdb5c000000001503aff5
title: Karpathy 把 AI 研究变成了一个自动循环
author: 奥森木
likes: 47
collects: 92
comments: 3
date: 5天前
tags: ["#Karpathy", "#autoresearch", "#AI研究", "#自主Agent", "#LLM训练"]
source_url: https://www.xiaohongshu.com/explore/69acdb5c000000001503aff5
---

## 核心内容

Karpathy开源autoresearch项目，核心idea：你睡觉的时候AI Agent在自主做LLM研究。

### 技术架构

- **630行核心代码**，单GPU运行
- 三个关键文件：
  - `prepare.py` — 数据准备（固定不动）
  - `train.py` — GPT模型训练代码（AI修改）
  - `program.md` — Agent指令（人类编写）

### 自主循环机制

1. Agent修改train.py里的架构、优化器、超参数
2. 训练恰好5分钟
3. 评估val_bpb指标
4. 更好就git commit保留，更差就丢弃回滚
5. 每小时约12个实验，睡一觉约100个实验

### 关键设计

- **5分钟固定时间预算**: 统一比较框架
- **单文件修改**: 隔离风险
- **单一指标**: 避免多目标冲突
- **版本控制**: 可逆性保障

### 核心洞察

> "氛围编程是AI帮你做你已经知道要做的事，你是产品经理。autoresearch是AI去探索你不知道答案的事，你是研究总监。"

Karpathy叫它 **"programming the program"**。

### 科幻开场白

> "曾经前沿AI研究由肉脑计算机完成，他们在吃饭睡觉玩乐的间隙工作...那个时代早已过去。研究完全由自主AI Agent群完成，代码已经自修改到第10205代，超越了人类理解。"

### 评论区

- TeaStone: "天网启动了？"
- 奥森木: "别说这个高级，我连自己随便弄个自进化，后面都开始说天文了"
- mono tokyo: "效果咋样，看起来挺有用诶"
