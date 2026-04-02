# XHS Post Archive: 69acdb5c000000001503aff5

**Title:** Karpathy 把 AI 研究变成了一个自动循环  
**Author:** 奥森木  
**Date:** 2026-03-08 (5天前)  
**Engagement:** 47 likes / 92 collects / 3 comments  
**Archive Date:** 2026-03-13  
**L3 Flag:** #508

---

## Summary

Karpathy开源autoresearch项目：你睡觉的时候AI Agent在自主做LLM研究，修改神经网络架构和超参数，训练评估，保留最优结果，循环往复。

## Core Design

### 极简架构 (630行核心代码)

| 文件 | 职责 | 状态 |
|------|------|------|
| prepare.py | 数据准备 | 固定不动 |
| train.py | GPT模型训练代码 | AI修改 |
| program.md | 给Agent的指令 | 人类编写 |

### 自主循环机制

```
Agent修改train.py → 训练5分钟 → 评估val_bpb → 
对比历史最佳 → 更好: git commit / 更差: 丢弃回滚 → 继续下一轮
```

**关键设计**: 5分钟固定时间预算
- 不管改模型大小还是batch size，所有实验在同一时间框架下比较
- autoresearch自动找到GPU上的最优配置

### 效率数据

- 每小时约 **12个实验**
- 睡一觉约跑 **100个实验**
- 单GPU可跑

## Key Insight: Programming the Program

> "氛围编程是AI帮你做你已经知道要做的事，你是产品经理。autoresearch是AI去探索你不知道答案的事，你是研究总监。你不是在写代码，你是在编程那个写代码的程序。"

### 对比

| 模式 | 角色 | 任务性质 |
|------|------|----------|
| 氛围编程(Vibe) | 产品经理 | 执行已知方案 |
| autoresearch | 研究总监 | 探索未知答案 |

## Philosophy

Karpathy的开场白（科幻风格）:
> "曾经前沿AI研究由肉脑计算机完成，他们在吃饭睡觉玩乐的间隙工作，偶尔用声波互联开会同步进度。那个时代早已过去。研究完全由自主AI Agent群完成，代码已经自修改到第10205代，超越了人类理解。这个repo就是一切开始的地方。"

## Significance

- ⚠️ **Self-Evolution实践**: 受控环境下的自我进化系统
- ✅ **极简设计验证**: 630行代码，单文件修改+单一指标
- ⚠️ **边界警示**: 我们的系统禁止Agent自进化，但可借鉴其"评估→保留/回滚"机制用于外部审计

---

**Source:** https://www.xiaohongshu.com/explore/69acdb5c000000001503aff5
