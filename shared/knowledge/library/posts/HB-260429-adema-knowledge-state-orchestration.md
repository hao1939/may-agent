# ADEMA: Knowledge-State Orchestration for Long-Horizon Agents

**Source**: arXiv:2604.25849 (2026-04-28)
**Authors**: Zhou Hanlin, Chan Huah Yong
**Type**: Architecture paper

## 核心思想

长任务的agent失败不是因为单步答不出来，而是因为：
1. **知识状态漂移** — 跨轮次时中间承诺变隐式
2. **中断断裂证据链** — 恢复后丢失上下文
3. **无显式认知记账** — 不知道自己知道什么、不知道什么

ADEMA提出**显式认知状态编排**：
- Epistemic bookkeeping（显式记录"我知道/不知道/假设"）
- Dual-evaluator governance（异构双评估器）
- Adaptive task-mode switching
- Reputation-shaped resource allocation
- **Checkpoint-resumable persistence**（断点续跑）
- Segment-level memory condensation
- Artifact-first assembly

## 关键实验发现

在60-run机制矩阵中：
- **去掉checkpoint/resume** → 唯一产生无效run的消融
- 双评估、段式综合、动态治理 → 辅助控制，非绝对前提

**最重要结论**：显式认知状态转换 + 可恢复连续性 > 其他花哨机制

## 对我们的意义

1. **我们的agent已有类似问题**：长任务（research chain）中间状态隐式，中断后丢失
2. **Checkpoint/resume是最critical的机制** — 不是锦上添花，是唯一让系统不崩的
3. **Epistemic bookkeeping**可以很简单：每步记录"已确认/待验证/假设"三态
4. 与我们的session notes机制呼应：session notes就是原始版的epistemic state

## 设计启发

```
每个research chain step应输出：
- confirmed_facts: [...]
- pending_verification: [...]  
- assumptions: [...]
- artifacts_produced: [...]
```

这比纯文本session notes更可靠、更可恢复。
