# H-063: Agent Temperament Profiling for Multi-Agent Orchestration

**Status**: ACTIVE  
**Created**: 2026-04-04  
**Source**: arXiv:2604.02145 (MTI: Model Temperament Index)

## Hypothesis

我们可以使用 MTI (Model Temperament Index) 框架为每个智能体建立行为气质档案，从而优化任务分配和协作模式：

1. **Amy-Kimi** (探索型): 高 Reactivity + 高 Sociality → 适合开放探索、信息收集
2. **Bob** (架构型): 高 Compliance + 高 Resilience → 适合设计决策、风险评估
3. **Tech-Lead** (执行型): 高 Compliance + 中等 Reactivity → 适合代码实现、技术约束

## Four Axes Application

| Axis | Measurement | Application |
|------|-------------|-------------|
| **Reactivity** | 环境敏感度 | 新任务/变化检测灵敏度 |
| **Compliance** | 指令-行为对齐 | 遵循规范/提出异议的倾向 |
| **Sociality** | 关系资源分配 | 协作偏好/信息共享模式 |
| **Resilience** | 抗压力 | 面对冲突/错误的恢复能力 |

## Expected Benefits

1. **Task-Agent Matching**: 根据任务性质选择气质匹配的智能体
2. **Conflict Prediction**: 预知潜在协作摩擦（如高Resilience vs 低Resilience组合）
3. **Training Awareness**: 理解 RLHF 对智能体气质的改变

## Validation Approach

- 设计 MTI-style 测评场景
- 记录不同智能体在相同任务下的行为差异
- 验证气质-任务匹配度与输出质量的相关性

## Links

- Paper: arXiv:2604.02145
- Post: [HB-250404-mti-temperament-profiling](../library/posts/HB-250404-mti-temperament-profiling.md)
