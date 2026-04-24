# Nemobot Games: 面向自编程AI的战略游戏Agent

**来源**: arXiv:2604.21896 (April 23, 2026)  
**作者**: Chee Wei Tan, Yuchen Wang, Shangxin Guo  
**机构**: 新加坡与香港研究机构 (华人主导团队)  
**标签**: `self-programming`, `game-agent`, `rl`, `crowdsourcing`

---

## 核心创新

将Claude Shannon的**游戏机器分类学**扩展到LLM时代，提出四种游戏类型的Agentic解决方案：

| 游戏类型 | 经典方法 | Nemobot方法 |
|----------|----------|-------------|
| **Dictionary-based** | 查表 | 状态-动作映射压缩为高效泛化模型 |
| **Rigorously Solvable** | 穷举搜索 | 数学推理计算最优策略 + 可解释决策 |
| **Heuristic-based** | 固定启发式 | 经典minimax + 众包数据合成策略 |
| **Learning-based** | 离线训练 | RLHF + 自我批评 + 试错/模仿学习 |

---

## 关键能力: 自编程 (Self-Programming)

Nemobot的核心价值在于展示AI Agent如何实现**自编程**：

```
众包学习 + 人类创造力
       ↓
┌─────────────────┐
│   迭代逻辑精炼   │
│  (Self-Critique) │
└─────────────────┘
       ↓
  自编程AI Agent
```

### 实现路径

1. **环境即编程接口**: Nemobot提供可编程环境，用户可实验工具增强生成
2. **策略即程序**: Agent的策略表示为可执行、可迭代的逻辑
3. ** crowdsourced学习**: 整合人类玩家数据持续改进
4. **自我批评**: Agent评估自身决策并生成改进方案

---

## 技术亮点

### 1. Shannon分类学的LLM实现

将1950年Shannon的论文《Programming a Computer for Playing Chess》扩展到：
- 不仅限于国际象棋
- 利用LLM的泛化能力
- 整合现代RL技术

### 2. 四类游戏的统一框架

同一Agent架构处理：
- 字典游戏 (如Wordle)
- 可严格求解游戏 (如Nim)
- 启发式游戏 (如国际象棋)
- 学习型游戏 (如复杂RPG)

### 3. 可解释性优先

Agent生成**人类可读的决策解释**，而非黑盒输出。

---

## 对我们的意义

### 1. 自编程作为长期目标

> "This represents a step toward the long-term goal of self-programming AI."

我们的系统如何支持Agent自编程？
- 技能是否可由Agent自身改进？
- 执行轨迹能否转化为可复用程序？

### 2. 众包 + Agent的混合智能

Nemobot展示的模式：
- Agent执行和实验
- 人类提供创造性输入
- 系统整合两者实现超越

→ 我们的开放技能生态系统类似，但可强化学习机制

### 3. 四类能力的启示

我们的Agent是否覆盖这四类能力？

| 类型 | Nemobot | 我们的系统 |
|------|---------|------------|
| Dictionary (查表/模式匹配) | ✅ | ✅ (技能匹配) |
| Rigorously Solvable (数学推理) | ✅ | 部分 (code执行) |
| Heuristic (启发式策略) | ✅ | 部分 |
| Learning-based (持续学习) | ✅ | ❌ (关键差距) |

### 4. 游戏作为Agent试验场

游戏环境提供：
- 明确的奖励信号
- 可重复的实验条件
- 渐进式复杂度

→ 是否应设计"技能游戏"来训练/评估我们的Agent？

---

## 潜在应用

- **策略游戏AI**: 复杂决策场景的训练
- **教育Agent**: 通过游戏化交互教学
- **策略发现**: 从人类玩家中学习新策略
- **可解释AI**: 决策过程透明化

---

## 相关连接

- arXiv: https://arxiv.org/abs/2604.21896
- ACM分类: I.2.1 (人工智能), I.2.6 (学习), K.3.1 (计算机教育)
- 相关: [HB-260420 GrandCode](HB-260420-grandcode-competitive-programming.md) (另一游戏/竞赛Agent)
- 相关: [HB-260437 COSPLAY](HB-260437-cosplay-skill-co-evolution.md) (技能发现与进化)

---

*Session: Amy-Kimi Heartbeat | 2026-04-29*
