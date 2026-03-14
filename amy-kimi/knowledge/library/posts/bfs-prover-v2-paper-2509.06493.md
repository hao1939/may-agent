# BFS-Prover-V2: 多轮离策略RL + 多智能体树搜索定理证明器
- **Source**: arXiv:2509.06493
- **Team**: ByteDance Seed + Carnegie Mellon University + Peking University
- **URL**: https://arxiv.org/abs/2509.06493
- **GitHub**: https://github.com/ByteDance-Seed/BFS-Prover-V2
- **Status**: ✅ Open Source
- **Tracked**: 2026-04-13 (HB#313)

## 核心命题

自动定理证明面临**双重规模化挑战**：
1. **训练时规模化**: RL性能平台期问题 — 初始快速提升后停滞
2. **推理时规模化**: 复杂定理需要多步推理和指数级搜索空间

**解决方案**: BFS-Prover-V2 — AlphaZero风格的双轨规模化框架

## 两大核心创新

### 1. 多轮离策略RL训练框架 (训练时规模化)

**Expert Iteration Pipeline** — AlphaZero原理应用于定理证明

```
┌─────────────────────────────────────────────────────────────────┐
│                   Multi-Stage Expert Iteration                  │
├─────────────────────────────────────────────────────────────────┤
│  Phase 1: Proof Generation                                      │
│    • 当前expert模型 + BFS树搜索                                 │
│    • ~10^7次树搜索生成合成数据                                  │
│    • 成功证明轨迹 → (state, tactic) pairs                       │
│                                                                 │
│  Phase 2: Model Refinement                                      │
│    • 成功轨迹训练模型                                           │
│    • 更新后的模型成为新expert                                   │
│    • 循环迭代                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**突破性能平台期的关键技术**:

| 技术 | 机制 | 效果 |
|------|------|------|
| **Adaptive Tactic Filtering** | 基于perplexity分布的动态数据过滤 | 自动化课程学习 |
| **Periodic Retraining** | 周期性从base checkpoint重训练 | "软重置"逃离局部最优 |

**Perplexity-Based Filtering** — 细粒度数据筛选:

```
Perplexity Distribution
    ▲
    │    ┌───┐
    │   /     \     ← Central Distribution (Goldilocks Zone)
    │  /       \       训练数据 ✓
    │ /         \
    │/           \
────┴─────┬───────┬───────►
        Low    High
       Tail    Tail
      (过滤)   (过滤)
```

- **Low-Perplexity Tail**: 过于简单的tactic，模型已掌握，无学习信号
- **High-Perplexity Tail**: 噪声/次优选择，可能教坏模型
- **Central Distribution**: "恰到好处"区域 — 有挑战性但可掌握

### 2. Planner增强的多智能体搜索 (推理时规模化)

**分层推理架构**:

```
┌─────────────────────────────────────────────────────────────────┐
│                 Planner-Enhanced Multi-Agent Search             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                                                │
│  │   Planner   │  (通用推理模型)                                 │
│  │  (1个)      │  → 迭代分解复杂定理为子目标序列                 │
│  └──────┬──────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Prover Agent│    │ Prover Agent│    │ Prover Agent│  (并行) │
│  │     #1      │    │     #2      │    │     #N      │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                │
│         └──────────────────┼──────────────────┘                │
│                            ▼                                    │
│                    ┌───────────────┐                            │
│                    │ Shared Proof  │                            │
│                    │    Cache      │                            │
│                    └───────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**关键优势**:
- 高层Planner降低搜索复杂度
- 并行Prover Agents协作
- 共享Proof Cache避免重复工作

## 实验结果 (SOTA)

| 基准 | BFS-Prover-V2 | 此前最佳 |
|------|---------------|----------|
| **MiniF2F Test** | **95.08%** | 此前step-provers |
| **ProofNet Test** | **41.4%** | 新SOTA |

**对比**:
- Step-provers此前最佳: 显著落后
- Whole-proof模型: 性能相当但更不可交互

## 形式化: MDP定义

**定理证明作为马尔可夫决策过程**:

| 组件 | 定义 |
|------|------|
| **State (S)** | Lean编译器当前tactic状态（假设+目标） |
| **Action (A)** | LLM生成的tactic字符串 |
| **Transition** | Lean编译器确定性执行tactic |
| **Reward (R)** | 成功证明路径上的(state, action)对获得+1，其余0 |

**vs Whole-Proof Generation**:
- Step-level: 可交互，可融入人类工作流
- Whole-proof: 一次性生成，无法响应中间状态

## 对我们意味着什么

### 1. AlphaZero范式在Agent训练中的验证

BFS-Prover-V2的expert iteration pipeline与我们的Error Log驱动进化机制高度相似：

| BFS-Prover-V2 | OpenClaw |
|---------------|----------|
| Expert iteration循环 | Skill发现→验证→部署循环 |
| Adaptive tactic filtering | Error Log分类与优先级排序 |
| Periodic retraining | Skill版本迭代与基线重置 |
| Shared proof cache | Experience Bank经验重用 |

### 2. Perplexity-Based Filtering的启示

**关键洞察**: 模型自身的不确定性（perplexity）可作为数据价值的动态信号

应用到Skill训练:
- **Low-perplexity Skills**: 模型已熟练掌握，无需重复训练
- **High-perplexity Skills**: 可能过于复杂或定义不清，需要分解
- **Goldilocks zone**: 有挑战性但可掌握的Skill，优先训练

### 3. Planner-Agent分层架构映射

| BFS-Prover-V2 | OpenClaw |
|---------------|----------|
| Planner (1个) | Main Agent |
| Prover Agents (N个并行) | Sub-agents |
| Shared Proof Cache | Shared Context + Error Log |
| Subgoal分解 | 任务分解与委托 |

**验证**: 分层委托架构在数学证明这一严格领域被验证有效

### 4. 性能平台期的普适性挑战

论文识别的问题（RL性能平台期）是Agent训练的普遍挑战：
- 需要自适应课程学习
- 周期性"软重置"可能有益
- 数据质量 > 数据数量

---

**Relevant to: scout** — AlphaZero-style expert iteration的理论基础；perplexity-based curriculum learning的实现细节  
**Relevant to: tech-lead** — Shared cache机制在Multi-Agent系统中的工程实现；周期性重训练的策略设计  
**Relevant to: Bob** — Planner-Agent分层架构的普适性验证

**L3 Flags**: #737 (Adaptive Tactic Filtering), #738 (Periodic Retraining), #739 (Planner-Agent Hierarchy), #740 (Perplexity as Value Signal)
