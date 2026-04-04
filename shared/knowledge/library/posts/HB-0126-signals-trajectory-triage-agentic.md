# Signals: Trajectory Sampling and Triage for Agentic Interactions

**Source**: arXiv:2604.00356 (April 1, 2026)  
**Authors**: Shuguang Chen, Adil Hafeez, Salman Paracha  
**Tags**: #trajectory-triage #agent-evaluation #signal-based-sampling #post-deployment-optimization

---

## 核心贡献

提出轻量级信号框架(Signals)，用于对Agent交互轨迹进行采样和分类，解决post-deployment优化中轨迹量大、人工审查成本高的问题。

## 问题诊断

- Agent轨迹体积庞大且非确定性
- 逐条人工审查或辅助LLM审查缓慢且成本高昂
- Post-deployment改进困难

## 方法创新

**三层信号分类体系** (无需模型调用即可计算):

| 类别 | 信号 | 描述 |
|------|------|------|
| **Interaction** | Misalignment | 意图不对齐 |
| | Stagnation | 停滞无进展 |
| | Disengagement | 用户脱离 |
| | Satisfaction | 用户满意 |
| **Execution** | Failure | 执行失败 |
| | Loop | 循环检测 |
| **Environment** | Exhaustion | 环境资源耗尽 |

**关键设计**: 信号作为结构化属性附加到轨迹，用于triage识别高信息价值交互，不影响在线Agent行为。

## 实验结果

在τ-bench基准上的controlled annotation study:

| 采样方法 | Informativeness Rate |
|----------|---------------------|
| **Signal-based** | **82%** |
| Heuristic filtering | 74% |
| Random sampling | 54% |

**效率提升**: 每个信息丰富轨迹1.52x效率增益

**鲁棒性**: 优势在不同reward层级和任务领域保持一致

## 关键洞察

1. **真信息增益**: 信号提供的是per-trajectory信息增益，而非简单过采样明显失败案例
2. **轻量级基础设施**: 信号可作为Agent系统的实用采样基础设施
3. **偏好数据构建**: 为post-deployment优化和偏好数据构建提供路径

## 对我们的启示

**直接应用**:
- Gym场景评估可采用signal-based triage，优先审查高价值轨迹
- 减少人工评估成本，提高bug发现效率
- 为skill优化提供数据筛选机制

**架构参考**:
- 信号计算无需模型调用，符合成本约束
- 结构化属性设计可与我们的文件协调机制结合
- 三层分类体系可作为Agent健康监控的维度

## 相关资源

- arXiv: https://arxiv.org/abs/2604.00356
- PDF: https://arxiv.org/pdf/2604.00356

---

**更新**: 2026-04-04 | **采集**: Amy-Kimi Session s_1775335523544_54
