# HB-2318: Triadic Cognitive Architecture 深度解析

**Source**: arXiv:2603.30031v1 [cs.AI] (31 Mar 2026)
**Title**: The Triadic Cognitive Architecture: Bounding Autonomous Action via Spatio-Temporal and Epistemic Friction
**Author**: Davide Di Gioia (UCL)
**Date**: 2026-04-01

---

## 核心贡献

TCA提出了当前LLM Agent的**"认知失重"(cognitive weightlessness)**问题——Agent在信息处理时缺乏对网络拓扑、时间节奏和认知边界的内在感知。

### ReAct三大失败模式

| 失败模式 | 描述 | 物理类比 |
|---------|------|----------|
| **Topological Saturation** | 无差别API查询导致网络拥塞和成本上升 | 网络过载 |
| **Infinite Deliberation** | 递归思考循环，错过时间窗口 | 无时间折扣 |
| **Epistemic Collapse** | 面对矛盾证据时平均化冲突，自信地产生幻觉 | 未解决的歧义 |

### 数学基础

TCA基于以下理论构建：
- **Hamilton-Jacobi-Bellman (HJB) variational inequality** — 最优停止边界
- **Kushner-Stratonovich nonlinear filtering** — 非线性滤波
- **Riemannian routing geometry** — 黎曼路由几何
- **Continuous-time stochastic control** — 连续时间随机控制

### 净效用评分公式

```
U(a; bt, t, Ct) = ΔĤ(a|bt) - α(λS(Ct + Ω(a)) + β(t + τ(a)))

其中:
- ΔĤ = Value-of-Information (预期熵减少)
- Ω(a) = Action load (空间成本)
- τ(a) = Latency (时间成本)
- Ct = 当前拥塞
- α, β, λS = 权重系数
```

**停止条件**: STOP ⟺ max_{a∈A} U(a) ≤ 0

当甚至最佳查询的净价值也非正时停止。

---

## EMDG实验验证

**Emergency Medical Diagnostic Grid (EMDG)** — 医疗诊断网格模拟

- **环境**: 5种致命病理，均匀先验
- **空间拓扑**: 分布式医院子系统（血液实验室、MRI网络、病史），各有不同的结构负载成本
- **时间衰减**: 患者存活率随时间指数衰减（快速血检=5步，MRI=45步）

**结果**: TCA在延迟和拥塞成本下减少time-to-action，同时保持诊断准确率。

---

## 离散实现细节

EMDG使用**Monte Carlo rollouts**估计VOI (Value-of-Information):

```
ΔĤ(a|bt) = (1/K) Σ_{k=1}^K (H(bt) - H(bt+1^(k)(a)))
```

采用**myopic stopping rule** (η=0)，即只比较即时VOI与即时时空成本，不考虑延续价值。

---

## 关键引用

> "True autonomous control cannot emerge from unstructured prompt-reflection; it requires a formal, decision-theoretic optimization layer."

> "We argue that safe autonomy demands that computation itself be optimized as a structural cost."

---

## 对OpenClaw的启示

1. **L4 Controller升级**: 从固定token限制 → 效用驱动的动态停止
2. **成本感知推理**: 每次skill调用应有明确的边际效用计算
3. **信念状态追踪**: 为planning引入VOI (value-of-information) 估计
4. **TCA-Lite可行**: EMDG使用Monte Carlo rollout近似VOI，计算成本可控

**Relevant to**: bob (L4设计哲学), tech-lead (停止条件实现)
