# SuperIgor: 目标条件RL的自引导计划提取

**Source**: arXiv:2604.20601  
**Authors**: Zoya Volovikova, Nikita Sorokin, Dmitriy Lukashevskiy, Aleksandr Panov, Alexey Skrynnik  
**Date**: April 22, 2026  
**Category**: Agent Planning, Reinforcement Learning, Instruction Following  
**Discovery**: Amy-Kimi arXiv scan

---

## Core Insight

传统指令跟随方法依赖**预定义子任务**，而SuperIgor使语言模型能够通过**自学习机制**生成和细化高层计划，减少对人工数据标注的依赖。

## Architecture

### 迭代协同训练循环

```
┌─────────────────────────────────────────────────────────┐
│  Language Model (Planner)                               │
│  └── Generates & refines high-level plans               │
│         ↕                                               │
│  RL Agent (Executor)                                    │
│  └── Follows plans, provides execution feedback         │
└─────────────────────────────────────────────────────────┘
```

### 关键创新

| 组件 | 传统方法 | SuperIgor |
|------|---------|-----------|
| 计划来源 | 人工预定义子任务 | LLM自生成 + 迭代优化 |
| 反馈机制 | 静态 | RL反馈驱动计划修正 |
| 适应性 | 固定 | 基于执行反馈动态调整 |
| 泛化性 | 有限 | 未见指令的强泛化 |

## 实验结果

- **指令遵循严格性**: 超过基线方法
- **泛化能力**: 对未见指令表现强劲
- **环境**: 在具有丰富动态和随机性的环境中验证

## 对我们的意义

### 🎯 计划生成 vs 执行分离

SuperIgor的模式与我们的**Orchestrator → Agent**分工一致：
- **Planner (LLM)**: 生成高层计划
- **Executor (Agent)**: 执行并反馈
- **协同进化**: 两者在循环中共同改进

### 🔄 与现有架构的对比

| 维度 | SuperIgor | 我们的系统 |
|------|-----------|-----------|
| 计划生成 | LLM动态生成 |  workflow预定义 + LLM选择 |
| 反馈循环 | RL训练 |  session-level人工评估 |
| 优化目标 | 指令遵循 | 任务完成质量 |

### 💡 可借鉴的设计

1. **执行反馈回流**: 当前我们的session结束后才评估，可考虑更即时的反馈循环
2. **计划自适应**: workflow可在执行中根据中间结果调整
3. **目标条件执行**: 不同目标可激活不同的执行策略

## Related Findings

- [HB-260424-autogenesis-self-evolution-protocol](HB-260424-autogenesis-self-evolution-protocol.md): 自进化协议
- [HB-260423-tpgo-self-improving-mas](HB-260423-tpgo-self-improving-mas.md): TPGO文本梯度优化
- [HB-260406-coral-multiagent-evolution](HB-260406-coral-multiagent-evolution.md): CORAL心跳式进化

---

**Keywords**: plan extraction, goal-conditional RL, instruction following, co-training, iterative refinement
