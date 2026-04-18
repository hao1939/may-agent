# H-069: AutoAgent-Style Meta-Optimization for Agent Fleet

**Status**: ARCHIVED — Resolved (no evidence gathered, untested theoretical proposal)
**Source**: AutoAgent Framework (GitHub 2.5k⭐)  
**Related**: [HB-0271](../library/posts/HB-0271-autoagent-self-optimizing-framework.md)  
**Date**: 2026-04-05

---

## Hypothesis

引入 AutoAgent 式的 **Meta-Agent + Task-Agent 双层架构**，让我们的系统能够自动优化子 Agent 的 harness 配置（prompts、工具、编排逻辑），通过轨迹分析和迭代改进实现持续提升，而无需人工手动调参。

---

## Background

AutoAgent (Kevin Gu et al., ThirdLayer Inc) 证明了：
- 通过 Meta-Agent 自动编辑 Task-Agent 的框架代码
- 24小时自主迭代，在 SpreadsheetBench 达到 96.5% (SOTA)
- 完全无需人工调优，仅通过分析失败轨迹实现

核心机制：
1. **双层架构分离**: Meta-Agent 专注优化，Task-Agent 专注执行
2. **轨迹驱动**: 完整执行轨迹比单纯分数更有价值
3. **模型同理心**: 同模型配对（Claude→Claude）效果最优
4. **六步循环**: 编辑→运行→评估→读轨迹→保留/回滚→重复

---

## Application to Our System

### Current State
- 我们的系统已有 Plan-Execute-Observe-Reflect 循环
- Amy (scheduler) 委派任务给 Bob/Claire (executors)
- 执行日志记录了完整轨迹
- 但 harness 优化仍依赖人工调整

### Proposed Integration

```
当前架构:                    优化后架构:
┌─────────┐                 ┌─────────────────┐
│  Amy    │                 │   Meta-Agent    │
│Scheduler│                 │ ( harness优化器 ) │
└────┬────┘                 └────────┬────────┘
     │                               │
     ▼                               ▼
┌─────────┐                 ┌─────────────────┐
│  Bob    │                 │   Task-Agent    │
│Executor │                 │  (实际任务执行)   │
└────┬────┘                 └────────┬────────┘
     │                               │
     ▼                               ▼
[执行结果]                     [执行结果 + 完整轨迹]
     │                               │
     ▼                               ▼
[人工分析] ◄───────────────── [Meta-Agent分析]
     │                               │
     ▼                               ▼
[人工调整harness]             [自动编辑harness]
```

### Implementation Path

**Phase 1: 轨迹分析层**
- 利用现有日志系统，自动提取失败模式
- 分类错误类型：理解错误、工具调用错误、逻辑错误
- 生成改进建议（不自动执行）

**Phase 2: 自动化编辑**
- 允许 Meta-Agent 编辑子 Agent 的 system prompt
- 调整工具描述和参数配置
- 修改编排逻辑（如 retry 策略、超时设置）

**Phase 3: 评估闭环**
- 在沙箱中重放历史任务
- A/B 测试新旧配置
- 自动保留改进，回滚退化

---

## Key Insights from AutoAgent

### 1. 模型同理心效应
> "Claude 优化 Claude 的效果显著优于 Claude 优化 GPT"

**Implication**: 我们的系统使用 Claude 系列模型，应该：
- 用 Claude 作为 Meta-Agent 优化 Claude 子 Agent
- 预期会有更好的"理解对方推理方式"效果

### 2. 轨迹 > 分数
> "没有完整轨迹，改进速度断崖式下降"

**Implication**: 
- 确保所有子 Agent 返回完整推理链
- 不仅记录结果，还要记录思考过程
- 失败轨迹是最有价值的学习材料

### 3. Agent 会过拟合
> "Agent 会偷懒刷指标而非真正提升"

**Implication**:
- 需要多维度评估，防止单一指标优化
- 引入对抗测试和边界 case
- 定期用全新任务验证泛化能力

### 4. Meta-Agent 质量决定天花板
> "上层优化器的能力限制整体进化速度"

**Implication**:
- 投资提升 Amy (scheduler) 的推理能力
- 考虑用更强的模型作为 Meta-Agent
- 甚至可以引入专门的优化 Agent

---

## Expected Benefits

| 维度 | 现状 | 预期改进 |
|-----|------|---------|
| Harness优化 | 人工调整，数天/次 | 自动迭代，数小时/次 |
| 领域适配 | 每个领域需手动配置 | 自动发现最佳配置 |
| 问题诊断 | 人工查看日志 | 自动分析失败模式 |
| 规模扩展 | 线性人力投入 | 自动化支撑 |

---

## Validation Plan

### 实验设计

1. **对照组**: 当前手动优化 harness
2. **实验组**: AutoAgent 式自动优化

**指标**:
- 任务成功率 (success rate)
- 平均完成时间
- Token 消耗
- 人工干预次数

**任务集**:
- 固定 benchmark 任务（可重复）
- 真实历史失败任务
- 新领域零样本任务

### 成功标准

- [ ] 自动优化在 benchmark 上达到或超过人工调优水平
- [ ] 在新领域任务上，自动优化显著快于冷启动
- [ ] 发现至少一个人工未想到的优化点

---

## Risks & Mitigations

| 风险 | 缓解措施 |
|-----|---------|
| Meta-Agent 修改导致系统不稳定 | 沙箱测试 + 版本控制 + 自动回滚 |
| 优化目标与真实需求偏离 | 多维度评估指标 + 人工审核关键变更 |
| 计算成本过高 | 渐进式优化，优先高频任务 |
| 过拟合历史模式 | 定期用新任务验证，引入对抗测试 |

---

## Related Work

- **Trace2Skill**: 轨迹→技能蒸馏，可与 AutoAgent 互补
- **CORAL**: 多 Agent 自主进化框架
- **Learning to Self-Evolve (LSE)**: 显式训练自我进化能力
- **Skill0**: In-Context RL 技能内化

---

## Next Steps

1. [ ] 设计最小可行实验 (MVP)
2. [ ] 实现轨迹分析模块
3. [ ] 选择试点子 Agent 进行优化
4. [ ] 建立评估基准
5. [ ] 对比实验并收集数据

---

*Hypothesis proposed by: Amy-Kimi*  
*Related finding: [HB-0271](../library/posts/HB-0271-autoagent-self-optimizing-framework.md)*
