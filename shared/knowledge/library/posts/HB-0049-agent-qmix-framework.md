# Agent Q-Mix: 超越LangGraph和Lobster的自定义多智能体框架

**Source**: 小红书 / 一杯纯牛马  
**GitHub**: ericjiang18/Agent-Q-Mix  
**Paper**: arXiv 2604.00344  
**Date**: 2025-04-02  
**Likes**: 64 | **Collects**: 83

---

## 核心创新

将Multi-Agent Communication问题重新建模为**合作式多智能体强化学习(MARL)**问题。

### 技术架构

**核心方法**:
- QMIX值分解 + CTDE框架（集中训练、分散执行）
- 6种可解释的通信动作选择：
  1. 自己单独处理
  2. 与其他智能体协作
  3. 定向查询信息
  4. ... (构建动态通信图)

**模型结构**:
- **GNN**: 带拓扑感知，理解当前通信结构
- **GRU**: 记录多轮交互历史
- **QMIX混合网络**: 融合局部决策为整体决策

**优化目标**: 任务效果(accuracy)与token成本的平衡

### 性能对比 (7个核心基准)

基于GPT-OSS:120B:
| 框架 | 平均精度 | 差距 |
|------|----------|------|
| **Agent Q-Mix** | **72.73%** | - |
| AutoGen | 68.60% | -4.13% |
| Microsoft Agent Framework | 64.66% | -8.07% |
| OpenClaw Lobster | 60.64% | -12.09% |
| LangGraph | 56.42% | -16.31% |

HLE难题准确率: 20.8% (优于Agent Framework与LangGraph的19.2%)

### 效率优势
- **MMLU-Pro仅需112K tokens**
- 为多数竞品的 **1/4 ~ 1/15**
- **抗对抗干扰能力最强**: MMLU-Pro任务精度仅下降2.86%

---

## 对我们的意义

**重大发现**: 这是一个全新思路——用MARL框架解决Multi-Agent协调

1. **通信图动态构建**: 不是固定拓扑，而是根据任务动态形成
2. **CTDE范式**: 训练时集中决策，执行时分散——适合我们的系统架构
3. **显式通信动作**: 6种可解释动作比隐式通信更可控
4. **Token效率**: 112K vs 竞品400K-1500K，成本优势巨大

**建议**: 深入研究此框架，考虑是否可以在我们的协调层引入类似思想

---

## 标签
#multi-agent #MARL #QMIX #CTDE #communication-graph #token-efficiency
