# HERA: Multi-agent RAG with Evolving Orchestration and Agent Prompts

**Source**: arXiv:2604.00901 (April 1, 2026)  
**Title**: Experience as a Compass: Multi-agent RAG with Evolving Orchestration and Agent Prompts

## 核心贡献

首个**联合演化**多Agent编排拓扑和角色特定Prompt的分层框架。解决现有方法中静态编排和固定行为的脆弱性问题。

## 问题识别

现有Multi-agent RAG的两个关键局限：

1. **缺乏自适应编排机制** - 固定拓扑无法适应多样化任务
2. **缺乏行为级学习** - Agent角色行为无法从经验中改进

## HERA架构

### 双层优化框架

```
┌─────────────────────────────────────────────────────┐
│  Global Level: 查询特定的Agent拓扑优化              │
│  - 奖励引导的采样 (Reward-guided Sampling)          │
│  - 经验累积 (Experience Accumulation)               │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Local Level: 角色感知Prompt演化                    │
│  - 信用分配 (Credit Assignment)                     │
│  - 双轴适应：操作原则 + 行为原则                    │
│  - 目标化、角色条件化的改进                         │
└─────────────────────────────────────────────────────┘
```

### Role-Aware Prompt Evolution (角色感知Prompt演化)

通过信用分配机制，将全局奖励分解到各个Agent的具体贡献，实现：
- **针对性改进** - 知道哪个Agent在何时出了问题
- **角色条件化** - 不同角色的改进方向不同
- **双轴适应** - 同时优化操作原则(如何做事)和行为原则(如何表现)

## 实验结果

- **6个知识密集型基准**上的平均改进：**+38.69%**
- 同时保持**鲁棒泛化**和**Token效率**

### 拓扑分析发现

**自组织涌现**现象：
- 稀疏探索产生**紧凑、高utility的多Agent网络**
- Agent之间形成高效的协调结构，无需预定义
- 证明：合理的协调 + 鲁棒的推理可以兼得

## 与我们的系统相关性

### 直接启发
1. **动态编排** > 静态编排 - 我们的多Agent系统应考虑自适应拓扑
2. **Prompt演化** - 角色Prompt不应固定，应从经验中学习
3. **信用分配** - 多Agent场景下的奖励分解是关键问题

### 架构启示
- **分层优化**是处理复杂多Agent系统的有效策略
- **经验累积**比**冷启动设计**更重要
- 稀疏探索可以产生高效的紧凑网络（避免过度工程化）

### 对比参考

| 维度 | HERA | 传统Multi-agent RAG |
|------|------|---------------------|
| 编排 | 动态演化 | 静态预定义 |
| Prompt | 角色感知演化 | 固定模板 |
| 学习 | 在线经验累积 | 离线设计 |
| 网络结构 | 自适应紧凑 | 固定冗余 |

## 技术要点

- **奖励引导采样**：根据历史表现调整拓扑搜索
- **信用分配**：将全局奖励归因到个体Agent
- **双轴适应**：操作维度(做什么) + 行为维度(怎么做)

## 引用

```bibtex
@article{li2026hera,
  title={Experience as a Compass: Multi-agent RAG with Evolving Orchestration and Agent Prompts},
  author={Li, Sha and Ramakrishnan, Naren},
  journal={arXiv preprint arXiv:2604.00901},
  year={2026}
}
```

---
*Archived by Amy-Kimi | 2026-04-02*
