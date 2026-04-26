# HB-260948: DiffMAS — 端到端多Agent语言系统优化

**Source**: arXiv:2604.21794  
**Title**: Learning to Communicate: Toward End-to-End Optimization of Multi-Agent Language Systems  
**Authors**: Ye Yu, Heming Liu, Haibo Jin, Xiaopeng Yuan, Peng Kuang, Haohan Wang  
**Date**: 2026-04-23  
**Status**: Under review at COLM 2026

---

## 核心问题

基于LLM的多Agent系统在复杂推理任务上表现强劲，但：
- 现有工作聚焦Agent角色和编排(orchestration)
- **Agent间通信被视为固定接口**
- 潜在通信(latent communication)通过内部表示(如KV缓存)是文本协议的有前景替代，但未与多Agent推理联合优化

---

## 解决方案: DiffMAS

**DiffMAS** = Differentiable Multi-Agent System

### 核心思想
将潜在通信视为可学习组件，通过多Agent潜在轨迹进行参数高效监督训练，使Agent联合学习：
- 信息应如何编码
- 跨交互如何解释信息

### 关键机制
- **Latent Trajectory Training**: 在潜在表示轨迹上训练
- **Parameter-Efficient**: 不冻结整个模型，只优化通信相关参数
- **End-to-End**: 通信与推理联合优化

---

## 实验结果

| 基准测试 | DiffMAS成绩 | 对比基线 |
|---------|------------|---------|
| AIME24 | **26.7%** | 单Agent推理、文本多Agent、先前潜在通信方法 |
| GPQA-Diamond | **20.2%** | 同上 |
| 数学推理 | 一致提升 | - |
| 科学QA | 一致提升 | - |
| 代码生成 | 一致提升 | - |
| 常识推理 | 一致提升 | - |

**关键发现**: 潜在通信 + 联合优化 > 文本通信 > 单Agent

---

## 技术对比

| 方法 | 通信形式 | 优化方式 |
|-----|---------|---------|
| 单Agent推理 | N/A | 独立优化 |
| 文本多Agent | 自然语言 | 固定协议 |
| 先前潜在通信 | KV缓存 | 独立优化 |
| **DiffMAS** | **KV缓存** | **端到端联合优化** |

---

## 对OpenClaw的意义

### 🔴 高优先级

1. **L2 Agent通信优化**
   - 当前L2 Agent间通过自然语言通信(text-based)
   - 潜在通信(latent communication)可减少token开销
   - 但需评估实现复杂度

2. **编排 vs 学习的权衡**
   - 当前: AGENTS.md定义固定编排规则
   - 论文: 通信协议可学习
   - 中间路线: 基于反馈微调通信模式？

### 🟡 中等优先级

3. **Session级别的联合优化**
   - DiffMAS在多Agent轨迹上训练
   - 我们的session数据是否可用于类似优化？
   - skribe的笔记是事后分析，非联合训练

4. **KV缓存作为通信媒介**
   - 技术实现复杂，需要模型层面支持
   - 短期可能不现实，但长期值得跟踪

---

## 架构启示

```
传统:  Agent A --[自然语言]--> Agent B
       独立推理 + 文本协议

DiffMAS: Agent A --[共享KV缓存]--> Agent B
        联合优化 + 潜在表示
```

**OpenClaw的中间路线**:
- Agent A --[结构化JSON]--> Agent B
- 比自然语言精确，比KV缓存可解释
- 未来可探索压缩/嵌入优化

---

## 相关链接

- Paper: https://arxiv.org/abs/2604.21794
- 同主题: HB-260943 (HiCrew分层多Agent)、HB-260942 (DIVERT评估)

---

**标签**: #multi-agent #latent-communication #end-to-end-optimization #distributed-reasoning
