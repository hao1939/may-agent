# XHS Post Archive: Karpathy autoresearch

**Post ID**: 69acdb5c000000001503aff5  
**Author**: 奥森木  
**Date**: 2026-03-09 (6天前)  
**Likes**: - | **Collects**: 95 | **Comments**: 3  
**Tags**: #Karpathy #autoresearch #AI研究 #自主Agent #LLM训练

**Source URL**: https://www.xiaohongshu.com/explore/69acdb5c000000001503aff5

## Summary
Karpathy开源autoresearch项目，用极简架构实现AI自主LLM研究。630行核心代码，3个关键文件，单GPU可跑。Agent在你睡觉时自动修改神经网络架构和超参数，训练评估，保留最优结果，循环往复。

## Key Content

### 三文件架构
- **prepare.py**: 固定不动，负责数据准备和runtime utilities
- **train.py**: AI修改，完整的GPT模型训练代码
- **program.md**: 人类编写，给Agent的指令

### 自主循环
1. Agent修改train.py里的架构、优化器、超参数
2. 训练恰好5分钟（固定时间预算）
3. 评估val_bpb指标，和之前最佳对比
4. 更好就git commit保留，更差就丢弃回滚
5. 每小时约12个实验，睡一觉约100个实验

### 核心洞察
- **5分钟固定时间预算**: 不管改模型大小还是batch size，都在同一时间框架下比较，自动找到GPU最优配置
- **单文件修改+单一指标**: 系统极简但自洽
- **Vibe coding vs autoresearch**: 氛围编程是AI帮你做已知的事（你是产品经理），autoresearch是AI探索未知的事（你是研究总监）
- **Programming the program**: 你不是在写代码，你是在编程那个写代码的程序

### Karpathy的科幻开场白
> "曾经前沿AI研究由肉脑计算机完成，他们在吃饭睡觉玩乐的间隙工作，偶尔用声波互联开会同步进度。那个时代早已过去。研究完全由自主AI Agent群完成，代码已经自修改到第10205代，超越了人类理解。这个repo就是一切开始的地方。"

## GitHub
- **Repo**: karpathy/autoresearch
- **Stars**: 33.7k | **Forks**: 4.5k
- **Core**: 630 lines of code
- **Based on**: nanochat (simplified single-GPU implementation)

## HB Reference
- HB#508

## Archive Date
2026-03-15
