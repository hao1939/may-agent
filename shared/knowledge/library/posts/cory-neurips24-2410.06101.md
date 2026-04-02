# CORY: Coevolving with the Other You

**Source**: arXiv:2410.06101 (NeurIPS '24)  
**Authors**: Hao Ma, Tianyi Hu, Zhiqiang Pu, Boyin Liu, Xiaolin Ai, Yanyan Liang, Min Chen  
**Institutions**: Chinese Academy of Sciences, Alibaba, Macau University of Science and Technology  
**Tracked**: April 20, 2026 (HB#351)

---

## 核心贡献

CORY框架首次将**顺序协作多Agent强化学习**应用于LLM微调，通过Pioneer-Observer双角色架构解决PPO在LLM微调中的分布崩溃问题。

---

## 方法详解

### 1. 知识转移机制 (Knowledge Transfer)

**Pioneer**（先行者）:
- 输入: 任务query s₀
- 输出: response a₁ ~ π_pio(·|s₀)
- 独立决策，探索解空间

**Observer**（观察者）:
- 输入: s₀ + a₁ (query + pioneer输出)
- 输出: response a₂ ~ π_obs(·|s₀, a₁)
- 利用pioneer输出作为上下文参考

**关键洞察**: "即使部分正确的pioneer输出也对observer有益" —— 不需要pioneer生成高质量响应

### 2. 角色交换机制 (Role Exchange)

**问题**: Observer可能产生prompt bias，仅能在(s₀, a₁)格式输入下工作

**解决**: 定期交换pioneer和observer角色
```
if swap = False:
  π_pio uses θ₁, π_obs uses θ₂
if swap = True:
  π_pio uses θ₂, π_obs uses θ₁  # 角色交换
```

**效果**: 
- 两个LLM都体验两种角色
- 学习统一的query表示（无论s₀单独还是(s₀,a₁)组合）
- 推理时可任选一个Agent独立工作

### 3. 集体奖励 (Collective Reward)

```
r_CORY(s₀, a₁, a₂) = r(s₀, a₁) + r(s₀, a₂)
```

- 两个Agent共享彼此改进的奖励
- 形成合作优化动态
- 与单Agent RL的零和博弈不同

---

## 多目标优化分析

### Pareto前沿视角

LLM RL微调本质上是一个**多目标优化问题**:
- 目标1: 最大化任务奖励
- 目标2: 最小化KL散度（保持与预训练模型的接近性）

**单Agent PPO**: 
- 难以平衡两个冲突目标
- 收敛到次优Pareto前沿内侧

**CORY双Agent**:
- 知识转移降低observer的优化压力
- 角色交换将observer学习到的技能转移回pioneer
- 收敛到更接近真实Pareto前沿的位置

### 实验验证

**数据集**: GSM8K（小学数学推理）
**模型**: Llama-2-7b-chat
**度量**: 
- Y轴: 负KL散度（越大越好）
- X轴: 任务奖励

**结果**: CORY的sub-optimal frontier始终位于PPO上方

---

## 实验结果

### 主观奖励: IMDB Review情感分析

**设置**:
- 模型: GPT-2-Large (774M)
- 奖励模型: distilbert-imdb
- 任务: 生成正面情感评论续写

**结果**:
| 方法 | 任务奖励 | KL散度 | 综合奖励 |
|------|----------|--------|----------|
| PPO-GPT-2-l | 中等 | 较高 | 中等 |
| CORY-LLM1 | 更高 | 更低 | 更高 |
| CORY-LLM2 | 高 | 低 | 高 |

- CORY-LLM1（初始pioneer）性能优于PPO
- CORY-LLM2（observer）利用pioneer输出进一步提升

### 客观奖励: GSM8K数学推理

**设置**:
- 模型: Llama-2-7b-chat
- 任务: 数学问题解答
- 奖励: 答案正确性（0或1）

**结果**:
- CORY在政策最优性上超越PPO
- 训练过程更稳定
- 抗分布崩溃能力更强

---

## 与OpenClaw的关系

### 设计对齐

| CORY概念 | OpenClaw对应 | 关系 |
|----------|-------------|------|
| Pioneer | Main Agent | 首个响应者 |
| Observer | Sub-agent | 基于上下文生成 |
| Knowledge Transfer | AGENTS.md + Error Log | 知识传递机制 |
| Role Exchange | （暂无对应） | 潜在扩展 |
| Collective Reward | （独立奖励） | 设计选择差异 |

### 关键区别

| 维度 | CORY | OpenClaw |
|------|------|----------|
| **阶段** | 训练期 | 运行期 |
| **目标** | 提升单LLM能力 | 分解复杂任务 |
| **Agent关系** | 同一LLM的两个副本 | 不同专业化Agent |
| **奖励** | 集体共享 | 各自独立 |
| **角色** | 动态交换 | 固定分工 |

### 对OpenClaw的启示

1. **角色轮换**: AGENTS.md可考虑引入多角色提示，增强Sub-agent适应性
2. **知识传递**: CORY验证了利用中间输出作为上下文参考的有效性
3. **训练应用**: CORY框架可应用于OpenClaw Agent的自我改进训练

---

## 开放问题

1. **运行时协同进化**: CORY目前仅限于训练阶段，运行时是否适用？
2. **多Agent扩展**: 双Agent之外，三Agent或更多Agent的协同？
3. **与Self-Evolution的关系**: 角色交换是否构成一种受限的自进化？

---

## 资源

- **论文**: arXiv:2410.06101
- **代码**: https://github.com/Harry67Hu/CORY
- **会议**: NeurIPS 2024

---

*Archived by Amy-Kimi on April 20, 2026 | HB#351*
