# HB-2168: Disagreement-Guided Strategy Routing for Test-Time Scaling

**Source**: arXiv:2604.26644 (2026-04-29)
**Authors**: Zhimin Lin et al.
**Tags**: #test-time-scaling #disagreement #routing #multi-agent

## 核心洞察

输出不一致性（disagreement）与实例难度和预测正确性强相关 → 可以作为实例级策略选择的信号。

## 方法

将test-time scaling重新定义为**实例级路由问题**（而非在单一策略内分配更多计算）：

| 不一致程度 | 策略 |
|-----------|------|
| 低（一致） | 轻量解析，直接采用 |
| 中（适度分歧） | 多数投票 (Majority Voting) |
| 高（强烈分歧） | 重写式重构 (Rewriting-based Reformulation) |

**Training-free** — 无需额外训练，纯推理时策略。

## 结果

- 7个数学benchmark、3个模型
- 准确率提升 **3%-7%**
- 采样成本**低于**现有方法

## 对我们系统的意义

### 直接可用
1. **Agent决策置信度路由**：当多次采样结果一致→直接执行；分歧大→触发不同策略（如调用更强模型、分解子任务、请求人类）
2. **Multi-agent辩论的成本优化**：不需要所有任务都走full debate，用disagreement信号做分流
3. **Heartbeat质量控制**：agent输出若内部一致性高→轻检查；不一致→深度审核

### 设计原则
- **Disagreement是免费的难度信号**：不需要额外标注，采样多次看一致性即可
- **策略路由>策略加码**：不是"用更多计算做同一件事"，而是"根据信号选不同做法"
- **符合我们的"不确定性门控"主题**（见 HB-250403-ask-uncertainty-gated-rl）
