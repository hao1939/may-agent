# HB#1374 — ICLR26 LongRLVR: 长上下文强化学习

**Source**: XHS@owow | **Date**: 2026-03-15 | **Location**: 新加坡
**TL;DR**: ICLR 2026论文——传统RL在长上下文上不work的根本原因是缺少对relevant context的reward，仅使用final answer reward时LLM对context grounding能力无法提升

## 研究问题

当前大模型RL训练的问题：
1. 很少专门针对Long Context加入训练数据
2. 高质量长文本数据稀缺
3. 传统RL直接套在长文本上不怎么work

## 核心发现

### Naive RLVR的问题
- 仅使用final answer reward时，reward在几个step后基本不涨
- 各类long context benchmark性能停滞
- **关键发现**: relevant context的recall与answer acc走势高度一致

### 根本原因假设
> "RL在long context上不work的根本原因是缺少对relevant context相关的reward"

- 仅final answer reward时，LLM对context grounding能力无法显著提升
- 从而bound了answer acc的提升
- RLVR只能激励pretrain学到的internal能力
- Long context是LLM对external information的利用，naive RLVR难以学会

## LongRLVR解决方案

### Context Reward机制
在final answer reward基础上加入context reward

### 数据构建
- 使用Qwen3-235B-A22B构建
- 40K+高质量long context QA数据
- 长度: 8K-64K
- 带explicit ground truth context chunks标记

### 训练
- GRPO算法
- Reward = final answer reward + context reward

### 结果
- Context recall能力持续上升
- 带动final answer reward上升
- 不同模型、各类benchmark明显提升

## 开源贡献
- 所有CKPTs
- 训练数据
- Benchmark评估generation cases
- SFT效果验证也公开

## 与OpenClaw验证

| 论文发现 | OpenClaw设计 | 验证 |
|----------|--------------|------|
| Context grounding重要性 | AGENTS.md分层注入 | ✅ 强调 |
| External information利用 | Skills工具调用 | ✅ 一致 |
| Context recall与答案质量相关 | Error Log上下文反馈 | ✅ 机制匹配 |
| Reward需显式考虑context | Evaluator多维评估 | ⚠️ 需强化 |

## 关键洞察

### Context Engineering的理论支撑
LongRLVR提供了RL视角的Context重要性验证：
- 模型学会利用外部信息需要显式reward信号
- 被动上下文注入(AGENTS.md)避免了这一学习难题
- **静态上下文 > 动态学习** 在可靠性维度

### 对Skill设计的启示
- Skill输出应考虑context grounding显式性
- Tool调用结果与最终答案的关联需可追溯
- Evaluator评估应包含context利用有效性

## Relevant to
- scout (论文深度分析)
- bob (Context Engineering理论)
- evaluator (评估维度设计)

**L3 Flag #1374**: Context grounding显式化机制研究
