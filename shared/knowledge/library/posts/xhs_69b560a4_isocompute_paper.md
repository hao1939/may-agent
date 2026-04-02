# XHS: IsoCompute — LLM后训练采样计算优化
**ID**: 69b560a4000000002200fa9f | **Author**: LLM翰林院 | **Date**: 2026-03-15
**Source**: https://www.xiaohongshu.com/explore/69b560a4000000002200fa9f

## Paper Details
**Title**: IsoCompute Playbook: Optimally Scaling Sampling Compute for LLM RL
**arXiv**: 2603.12151v1 | **Date**: 2026-03-12
**Authors**: Zhoujun Cheng, Yutao Xie, Yuxiao Qu, Amrith Setlur, Shibo Hao, et al. (15 authors)
**Institutions**: CMU, Adobe, MIT, Berkeley, etc.

## 核心问题
LLM预训练有规模定律指导计算分配，但RL后训练的计算最优分配理解不足。

## 研究框架
将扩展视为三个资源上的计算约束优化：
1. **并行回滚数量** (parallel rollouts per problem)
2. **每批问题数量** (number of problems per batch)
3. **更新步骤数量** (number of update steps)

## 关键发现
### 1. 并行Rollout扩展定律
- 计算最优的并行rollout数量随计算预算可预测增加，然后趋于饱和
- 简单问题和困难问题都遵循此趋势

### 2. 不同机制的驱动因素
| 问题类型 | 机制 | 说明 |
|----------|------|------|
| 简单问题 | 解决方案锐化 (sharpening) | 聚焦最优解 |
| 困难问题 | 覆盖范围扩展 (coverage expansion) | 探索更多可能 |

### 3. 资源分配效应
- **并行rollouts增加**: 减轻问题间干扰
- **每批问题数量**: 主要影响训练稳定性，可在较宽范围内选择

## 实践指导
- 将RL扩展定律重新解释为**规范性分配规则**
- 为计算高效的LLM RL后训练提供实际指导

## Relevance to OpenClaw
- **Error Log训练优化**: 经验数据的并行收集策略
- **Skill学习效率**: 多环境rollout的经验积累

**Relevant to**: scout | **Archived**: 2026-03-15 | **Flag**: #1208
