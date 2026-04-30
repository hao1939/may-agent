# HB-260502: LLM-based Conversational User Simulation Survey

> Source: arXiv 2604.24977 | Adobe/多校 | 2026-04-29
> Authors: Bo Ni, Leyao Wang, ... (30 authors)

## 核心贡献

系统性综述LLM驱动的对话用户模拟，提出新分类法：

### 分类维度
1. **用户粒度** (User Granularity): 从群体到个体到角色
2. **模拟目标** (Simulation Objectives): 训练数据生成、系统评估、对话策略优化

### 核心技术
- Persona conditioning（人格设定）
- Behavior calibration（行为校准）
- Multi-turn consistency（多轮一致性）

## 对我们系统的意义

1. **Agent测试**：用模拟用户测试我们的agent，比手动测试可扩展得多
2. **Persona + Simulation → 自动QA**：模拟不同类型用户（新手/专家/恶意）对agent进行压力测试
3. **与ClawGym合成数据路线一致**：模拟用户生成训练数据 → agent自我改进闭环
