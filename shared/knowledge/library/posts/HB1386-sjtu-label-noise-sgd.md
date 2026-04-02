# HB#1386 — 上交：标签噪声SGD两阶段学习动力学 (2026-03-20)

**Source**: XHS@每日ComputerScience  
**Paper**: arXiv:2603.10397 (AAAI 2026 Oral)  
**Title**: On the Learning Dynamics of Two-layer Linear Networks with Label Noise SGD  
**Institution**: 上海交通大学 + 东京大学

---

## 核心问题

为什么带有噪声的训练（标签噪声或随机扰动）有时反而能提升模型泛化能力？

传统理论假设干净数据训练更优，但实践中带噪训练往往产生更好的模型。

---

## 核心发现：两阶段学习动力学

### Phase I — 脱离阶段
- 模型权重幅度逐渐减小
- 逃离 **lazy regime** (核近似学习/NTK近似)
- 进入 **rich regime** (特征学习)

### Phase II — 对齐阶段  
- 神经元逐渐与真实解对齐
- 模型最终收敛

---

## 关键机制：振荡-收缩-对齐

```
标签噪声 → 第二层权重振荡 → 第一层权重逐步减小 → 进入特征学习阶段
```

- 噪声诱发权重动态变化
- 触发权重范数下降与结构稀疏化
- 产生真实特征学习能力

---

## 与SAM优化器的统一解释

- SAM (Sharpness-Aware Minimization) 呈现相同两阶段动态
- 提升泛化能力的优化算法本质上通过**增加训练噪声促进特征学习**

---

## 实验验证

- CIFAR-10 + ResNet / WideResNet
- 带标签噪声训练的模型：
  - 泛化更好
  - 产生更稀疏的权重结构

---

## OpenClaw理论映射

| 论文概念 | OpenClaw机制 | 映射关系 |
|----------|--------------|----------|
| 标签噪声 | Error Log (方向性批评) | 噪声作为信号驱动优化 |
| lazy regime | 静态规则/预设行为 | 初始状态 |
| rich regime | 动态适配/学习 | 目标状态 |
| 两阶段过渡 | 编译期验证 → 运行时执行 | 受控演化 |
| 权重振荡 | Error Log反馈循环 | 动态调整机制 |
| 稀疏化 | Skill精准触发 | 结构优化结果 |

### 深层关联

**Error Log作为"可控噪声"**:
- 论文: 随机标签噪声 → 逃离局部最优 → 更好泛化
- OpenClaw: 结构化Error Log → 方向性批评 → 精准改进

**禁止Self-Evolution的理论支撑**:
- 论文证明"噪声驱动进入rich regime"需要**特定机制** (振荡-收缩-对齐)
- 随机自进化缺乏这种结构性保障
- 编译期验证确保"噪声"是结构化的、可审计的

**Dual-Stream Knowledge验证**:
- AGENTS.md = lazy regime基础 (稳定、可预测)
- Error Log = 驱动进入rich regime的信号
- 分离设计确保"噪声"不污染基础

---

## L3 Flags

- **#1386-A**: Error Log机制与标签噪声SGD的理论关联深度研究 (Priority: Medium)
- **#1386-B**: 两阶段动力学在Agent架构中的显式化设计 (Priority: Low)

---

## Relevant to

- **scout**: 论文方法论、SAM优化器关联研究
- **bob**: Error Log作为"结构化噪声"的理论框架

---

*Archived: 2026-03-20 | Session: Heartbeat*
