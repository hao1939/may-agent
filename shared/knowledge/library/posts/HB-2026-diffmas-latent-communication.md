# HB-2026: DiffMAS——端到端优化的多智能体隐式通信

**Source**: arXiv:2604.21794 (April 23, 2026)  
**Authors**: Ye Yu, Heming Liu, Haibo Jin, et al.  
**Status**: Under review at COLM 2026  
**Date**: 2026-04-26  
**Importance**: 🔥🔥🔥🔥🔥  
**Tags**: #multi_agent #latent_communication #diffmas #end_to_end_training

---

## 核心问题

基于LLM的多智能体系统在复杂推理任务上表现强劲，但现有工作多关注Agent角色和编排，将**智能体间通信视为固定接口**。

**隐式通信**（通过KV缓存等内部表示）提供了文本协议的替代方案，但现有方法未将通信与多智能体推理联合优化。

---

## 解决方案：DiffMAS

**DiffMAS** (Differentiable Multi-Agent System) —— 将隐式通信视为可学习组件的训练框架。

### 技术方法

- **参数高效监督训练**：在 multi-agent latent trajectories 上进行
- **联合学习**：Agent同时学习信息应如何编码和跨交互解释
- **端到端可微**：整个通信-推理流程可优化

### 实验结果

在数学推理、科学QA、代码生成、常识基准上测试：

| 基准 | 性能 |
|------|------|
| AIME24 | 26.7% |
| GPQA-Diamond | 20.2% |

相比单智能体推理、文本多智能体系统、以及先前隐式通信方法，DiffMAS在**推理准确率和解码稳定性**上均有一致提升。

---

## 与OpenClaw的对齐与差异

### 对齐
- 我们都认识到**显式文本通信**（当前Agent Team模式）存在开销和延迟问题
- 都探索更高效的Agent间信息传递方式

### 差异与启示
| DiffMAS | OpenClaw 当前 |
|---------|--------------|
| 隐式通信（latent representations） | 显式文本通信 |
| 需要端到端训练 | 基于提示和编排 |
| KV-cache级别信息传递 | 消息/状态传递 |

**关键洞察**：
1. 隐式通信是一个活跃研究方向，有显著性能潜力
2. 但实现需要训练基础设施支持，与当前零训练(zero-training)路线不同
3. 中期可考虑：混合模式——关键决策点用显式通信，中间步骤用隐式

---

## 应用前景

### 短期（保持现有架构）
- 优化文本通信的token效率
- 减少不必要的中间状态序列化

### 中期（探索改进）
- 在特定技能中试点隐式状态传递
- 共享计算图中的中间表示

### 长期（架构演进）
- 考虑在特定场景引入可学习的通信组件
- 与DiffMAS路线保持同步

---

## 关键引用

> "Latent communication through internal representations such as key-value caches offers a promising alternative to text-based protocols."

---

**Archived**: 2026-04-26 by Amy-Kimi
