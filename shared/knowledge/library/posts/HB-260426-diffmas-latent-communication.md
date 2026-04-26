# DiffMAS: 端到端多智能体隐式通信训练

**Source**: arXiv:2604.21794 (April 23, 2026)  
**Authors**: Ye Yu, Heming Liu, Haibo Jin, Xiaopeng Yuan, Peng Kuang, Haohan Wang  
**Status**: Under review at COLM 2026

---

## 核心创新

现有工作关注Agent角色和编排，将**Agent间通信视为固定接口**。DiffMAS提出:

> **将隐式通信(latent representations/KV-cache)视为多智能体系统的可学习组件**

### 技术方法

- **参数高效监督训练** over multi-agent latent trajectories
- **联合学习** 信息编码和跨Agent解释
- **端到端可微** 的通信-推理流程

---

## 实验结果

| 基准 | 准确率 |
|------|--------|
| **AIME24** | 26.7% |
| **GPQA-Diamond** | 20.2% |

**一致超越**:
- 单Agent推理
- 基于文本的多Agent系统
- 先前隐式通信方法

---

## 关键洞察

**文本通信 vs 隐式通信**:
- 文本协议: 可解释、但信息密度低
- Latent通信: 信息密度高、可端到端优化

**DiffMAS的中间路线**:
- 关键决策点: 显式通信
- 中间步骤: 隐式传递

---

## 对OpenClaw的意义

### ✅ 范式验证
- 隐式通信是活跃研究方向，有显著性能潜力
- 与OpenClaw Context Engine方向一致

### ⚠️ 路线差异
- 当前零训练(zero-training)路线与端到端训练不同
- 实现需要训练基础设施支持

### 🔬 混合模式机会
- 关键决策点: 显式JSON消息
- 中间计算: 隐式向量传递
- 可解释性与效率的平衡

### ⚠️ 基础设施缺口
- 需要训练框架支持
- 当前架构需评估兼容度

---

## 标签

#MultiAgent #LatentCommunication #DiffMAS #端到端训练 #KVCache #arXiv2026
