# HB-0734: OxyGent — JD的模块化可观测可进化多Agent框架

> 来源: arXiv 2604.25602 | ACL 2026 System Demo | JD
> 作者: Junxing Hu, Tianlong Li, Lei Yu, Ai Han

## 核心发现

OxyGent是京东开源的生产级MAS框架，三个设计支柱：

### 1. Oxy抽象 — 万物皆原子组件
- Agent、Tool、LLM、推理流程统一封装为可插拔的atomic component
- **Lego式组装**：任意组合，非侵入式监控
- 这就是"agent-as-tool"思想的工程化极致

### 2. Permission-Driven Dynamic Planning
- **替代刚性workflow**：执行图在运行时生成，不是预定义的
- 权限驱动：组件声明自己能做什么，planner动态编排
- 提供自适应可视化

### 3. OxyBank — AI资产管理平台
- 自动数据回流(data backflow)
- 自动标注
- 支持**联合进化**(joint evolution)

## 对我们系统的意义

| OxyGent特性 | 我们的现状 | 启示 |
|------------|-----------|------|
| Oxy统一抽象 | agent/tool分离，无统一接口 | 统一抽象可大幅简化组合 |
| Runtime execution graph | event-driven但无可视化 | 需要execution graph可视化 |
| Permission-driven planning | 手动编排 | agent声明能力→动态调度 |
| OxyBank数据回流 | 无系统性数据收集 | 需要从执行中自动学习 |

### 关键洞察

OxyGent的"permission-driven"本质上是**capability declaration + dynamic dispatch**。每个组件说"我能做X"，系统根据任务需求动态选择。这比我们现在的"prompt里写死谁做什么"灵活得多。

### 行动建议

1. 考虑统一的agent/tool capability declaration格式
2. 探索runtime execution graph生成和可视化
3. 数据回流机制：从agent执行中自动提取训练/改进信号
