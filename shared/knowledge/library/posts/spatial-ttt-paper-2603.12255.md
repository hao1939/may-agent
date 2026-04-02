# Spatial-TTT: Streaming Visual-based Spatial Intelligence with Test-Time Training

**Source:** arXiv:2603.12255 (March 12, 2026)
**Team:** Fangfu Liu, Diankun Wu, Jiawei Chi, Yimo Cai, Yi-Hsin Hung, Xumin Yu, Hao Li, Han Hu, Yongming Rao, Yueqi Duan
**Institution:** Tsinghua University
**Project Page:** https://liuff19.github.io/Spatial-TTT

---

## 核心问题

> "Humans perceive and understand real-world spaces through a stream of visual observations. Therefore, the ability to streamingly maintain and update spatial evidence from potentially unbounded video streams is essential for spatial intelligence."

人类通过视觉观察流来感知和理解真实世界空间。因此，从可能无限长的视频流中持续维护和更新空间证据的能力对空间智能至关重要。

**核心挑战**：不是简单地延长上下文窗口，而是**空间信息如何被选择、组织和保留**。

---

## 技术方案: Spatial-TTT

### Test-Time Training (TTT) 架构

- **Fast Weights (快速权重)**: 适配部分参数以捕获和组织长时序场景视频中的空间证据
- **Slow Weights (慢速权重)**: 保持预训练知识不变

### 混合架构设计

| 组件 | 功能 |
|------|------|
| **Large-Chunk Updates** | 大块更新，高效处理 |
| **Sliding-Window Attention** | 滑动窗口注意力，处理长序列 |
| **3D Spatiotemporal Convolution** | 3D时空卷积，捕获几何对应和时间连续性 |

### 空间预测机制

应用于TTT层的spatial-predictive机制：
- 鼓励模型捕获**跨帧的几何对应关系**
- 维护**时间连续性**

### 训练数据集

构建具有**密集3D空间描述**的数据集：
- 指导模型更新fast weights
- 以结构化方式记忆和组织全局3D空间信号

---

## 实验结果

在视频空间基准测试上达到**state-of-the-art性能**：
- 长时序空间理解显著提升
- 有效处理无限长视频流

---

## OpenClaw架构关联

### 🔗 Test-Time Training与运行时适应

| 维度 | Spatial-TTT | OpenClaw |
|------|-------------|----------|
| **适应时机** | Test-time | Run-time |
| **适应对象** | Fast weights (子集参数) | Error Log更新 |
| **适应触发** | 空间预测损失 | 执行错误检测 |
| **不变性** | Slow weights固定 | AGENTS.md/SKILL.md固定 |

**关键洞察**: Spatial-TTT验证了一个重要设计原则——**分层适应**：基础能力固定，上层证据动态更新。

### 🔗 空间智能与具身Agent

- Spatial-TTT针对**视觉空间推理**——具身Agent的核心能力
- OpenClaw当前为纯文本，未来多模态扩展需考虑：
  - 视觉证据的流式维护
  - 空间信息的结构化组织
  - 长时序视频理解

### 🔗 Fast Weights类比

Spatial-TTT的fast weights概念可与OpenClaw的以下组件类比：
- **Error Log** → 累积的"空间证据"
- **运行时上下文** → 当前场景的"fast状态"
- **SKILL.md** → "slow知识"（固定）

---

## L3 FLAGS

```
┌─────────────────────────────────────────────────────────────────────────┐
│ L3 FLAGS — Spatial-TTT                                                   │
├────────┬────────────────────────────────────────────────────────────────┤
│ #904   │ Test-Time-Adaptation: 分层适应架构验证                         │
│ #905   │ Fast-Weights-Paradigm: 子集参数动态更新的设计模式              │
│ #906   │ Spatial-Streaming: 长时序空间证据的流式维护                    │
│ #907   │ Multimodal-Roadmap: OpenClaw多模态扩展的技术路径参考          │
└────────┴────────────────────────────────────────────────────────────────┘
```

---

## Session Context
- **Archive Date**: 2026-03-14
- **Tracer**: Amy-Kimi
- **Source Type**: arXiv cs.CV
- **Relevance**: High — 空间智能与运行时适应的交叉验证
