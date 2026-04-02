# Paper Analysis: DuCA — Dual-Horizon Credit Assignment

**Source**: arXiv:2603.01481 (档案库追踪发现，3次引用)  
**Title**: Harmonizing Dense and Sparse Signals in Multi-turn RL: Dual-Horizon Credit Assignment for Industrial Sales Agents  
**Authors**: Haojin Yang et al. (8 authors)  
**Date**: March 2, 2026  
**Tags**: #multi-turn-rl #credit-assignment #reward-design #sales-agent

---

## 核心问题

工业销售Agent需要在**长期商业目标**（转化率）和**即时语言约束**（流畅度、合规性）之间取得平衡。传统RL将异构目标合并为单一奖励，导致：
- 高幅度的session-level奖励淹没subtle的turn-level信号
- 训练不稳定或奖励作弊

---

## 核心贡献: DuCA框架

### 1. Horizon-Independent Advantage Normalization (HIAN)

**核心洞察**: 分别归一化turn-level和session-level优势，再融合

```
A_turn = GAE(r_turn, V_turn, λ_turn=0.95, γ_turn=0.99)
A_session = GAE(r_session, V_session, λ_session=1.0, γ_session=1.0)

Â_turn = (A_turn - μ(A_turn)) / σ(A_turn)
Â_session = (A_session - μ(A_session)) / σ(A_session)

A_total = w_turn·Â_turn + w_session·Â_session
```

**理论依据**: 朴素标量化会导致梯度抑制
- 稀疏业务奖励通常方差高 (σ_session ≫ σ_turn)
- A_turn/σ_session → 0，语言技能学习停滞
- HIAN解耦依赖，确保两者同时学习

### 2. 双粒度奖励设计

| 层级 | 类型 | 目标 | 信号 |
|------|------|------|------|
| Turn-level | Dense | 对话流畅度、重复惩罚、风格 | 每轮即时反馈 |
| Session-level | Sparse | 转化率、合规评分 | 仅会话结束时 |

### 3. 高保真用户模拟器

- 基于31,000真实销售对话构建
- 异构用户画像（价格敏感、怀疑型等）
- 条件生成策略 π_sim(u_t | s_t, ψ)

---

## 关键数据

| 指标 | DuCA vs GRPO | 改进 |
|------|--------------|------|
| 转化率(CVR) | 24.44% vs 22.88% | +6.82% |
| 句间重复率 | 2.71% vs 15.29% | -82.28% |
| 身份检测率 | 6.11% vs 9.28% | -27.35% |

---

## 与OpenClaw的关联

| DuCA概念 | OpenClaw对应 |
|----------|--------------|
| Turn-level奖励 | Skill执行即时反馈、Thinker反思 |
| Session-level奖励 | 任务完成度、用户满意度 |
| 双Value Head | Main Agent评估vs Sub-agent评估分离 |
| 用户模拟器 | Agent模拟器（未来工作） |

### 核心洞察

1. **奖励分离原则**: 不要混合不同时间尺度的信号
2. **独立归一化**: 防止高方差信号淹没低方差信号
3. **多轮对话需要专门优化**: 不是单轮RL的简单扩展

---

## 技术细节

### GAE参数选择
- Turn-level: γ=0.99, λ=0.95（标准参数，平衡bias-variance）
- Session-level: γ=1.0, λ=1.0（确保稀疏终端奖励均匀传播）

### 与GRPO对比
GRPO的组归一化无法处理异构奖励尺度，DuCA的独立归一化解决此问题。

---

*Flagged: L3-#624 | Relevant to: scout (多轮RL奖励设计)*
