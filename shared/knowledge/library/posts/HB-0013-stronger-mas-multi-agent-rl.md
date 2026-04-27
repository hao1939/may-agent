# Stronger-MAS: 多智能体强化学习协作框架

**来源**: 小红书 @王哥儿  
**发布时间**: 2025年4月  
**原文链接**: https://www.xiaohongshu.com/explore/69eb825f0000000035027f26

---

## 核心发现

论文《Stronger-MAS: Multi-Agent Reinforcement Learning for Collaborative LLMs》提出了一种将"人多力量大"的协作优势与强化学习能力结合的新方法。

### 关键创新

**1. AT-GRPO算法**（Agent and Round Grouping RL）
- 专为多智能体系统(MAS)设计的强化学习算法
- 解决MAS中的公平分组比较和信用分配问题
- 让强化学习真正赋能多智能体协作

**2. MAS训练系统**
- 支持不同MAS工作流的轨迹数据收集
- 可同时更新共享策略和独立策略
- On-policy强化学习更新

### 性能提升（惊人的数字）

| 任务类型 | 单智能体RL | Stronger-MAS | 提升 |
|---------|-----------|-------------|-----|
| 长远规划 | 14%-47% | **96.0%-99.5%** | +50-80% |
| 编程任务 | baseline | - | +3.87%-7.62% |
| 数学任务 | baseline | - | +9.0%-17.93% |

规划任务上的提升尤为显著——从不足50%到接近100%！

---

## 对我们的意义

1. **多Agent协作训练**: 我们的多agent系统可以引入类似的GRPO变体，解决协作中的信用分配问题

2. **规划任务突破**: 如果我们的agents涉及复杂规划，这种MAS+RL方法可能带来质变

3. **独立+共享策略**: 同时训练共享策略（通用能力）和独立策略（专业化）的架构值得借鉴

4. **On-policy更新**: 实时从实际协作轨迹中学习，而非仅依赖离线数据

---

**标签**: #multi-agent #reinforcement-learning #GRPO #collaboration #planning
