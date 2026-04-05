# From Multi-Agent to Single-Agent: When Is Skill Distillation Beneficial?

**Source**: arXiv:2604.01608 (April 2, 2026)  
**Authors**: Binyan Xu, Dong Fang, Haitao Li, Kehuan Zhang  
**Tags**: #skill-distillation #multi-agent #metric-freedom #cost-optimization

---

## 核心问题

多智能体系统(MAS)通过分布式 expertise 处理复杂任务，但代价是沉重的协调开销、上下文碎片化和脆弱的 phase ordering。将MAS蒸馏为单Agent技能可以绕过这些成本，但何时以及蒸馏什么缺乏 principled answer。经验结果出奇不一致：同一任务的指标间技能提升从+28%到-2%不等。

## 核心创新: Metric Freedom (F)

提出**Metric Freedom** —— 首个技能效用的**先验预测器**。

**F度量什么**: 通过Mantel测试量化输出多样性与得分方差耦合程度的指标评分拓扑刚性。

### 关键发现
- **F强烈预测技能效用**: ρ = -0.62, p < 0.05
- **相同轨迹在不同指标下产生截然相反的技能提升** —— 证明技能效用本质上是指标级属性

## 两阶段自适应蒸馏框架

### Stage 1: 选择性提取
- 针对"自由"指标（高F）提取工具和知识
- 丢弃限制性结构以保留探索能力

### Stage 2: 迭代精炼靶向
- 仅针对"刚性"指标（F ≲ 0.6）进行计算密集型迭代精炼
- 消除轨迹局部过拟合

## 实验结果

- **4个任务**，**11个数据集**，**6个指标**
- **成本降低**: 最多8×
- **延迟降低**: 最多15×
- **性能**: 匹配或超越原始MAS

## 核心洞察

> **技能效用不由任务决定，而由评估指标决定。**

这解释了为什么相同MAS蒸馏到技能后，在不同评估场景下表现差异巨大。

## 对我们的意义

1. **技能评估指标选择**: 我们的gym需要 multiple metrics，且应理解每个指标的F值
2. **蒸馏决策**: 不是所有MAS都值得蒸馏成技能 — 先用F预测
3. **成本优化**: 自适应两阶段框架可将技能执行成本降低8×
4. **技能设计**: 针对自由指标设计技能时保留探索，针对刚性指标时强化确定性

## 引用

```bibtex
@article{xu2026skilldistillation,
  title={From Multi-Agent to Single-Agent: When Is Skill Distillation Beneficial?},
  author={Xu, Binyan and Fang, Dong and Li, Haitao and Zhang, Kehuan},
  journal={arXiv preprint arXiv:2604.01608},
  year={2026}
}
```
